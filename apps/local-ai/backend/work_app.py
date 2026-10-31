"""Separate trade/scrap demo applications sharing Core services, not hotel data."""
import json,secrets,time,uuid,io
from decimal import Decimal
from datetime import date
from types import SimpleNamespace
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Response,Request
from pydantic import BaseModel,Field
from sqlalchemy import select,text,delete
from .db import Session,User,LoginSession,ModuleConfig,MODE,PACKAGE
from .write_lock import begin_write
from .security import current_user,session_hash,hash_password,COOKIE_NAME
from .modules.registry import check_module,configuration,audit
from .platform_models import WorkRecord,TimeEntry,TimeCorrection
from .workflow import replay,record
from .time_service import industry,manager
router=APIRouter(prefix='/api/work',tags=['industry_work'])
ROLES={'handwerk':{'administrator':'Administration','office':'Büro','dispatch':'Disposition','master':'Meister','technician':'Monteur','warehouse':'Lager'},'scrap':{'administrator':'Administration','dispatch':'Disposition','driver':'Fahrer','warehouse':'Lager','office':'Büro'}}
def permission(user=Depends(current_user)):
    area=industry(user)
    if area not in ROLES:raise HTTPException(403,'Diese Anwendung gehört zu einer anderen Branche.')
    check_module(user,'handwerk_ai' if area=='handwerk' else 'scrap_ai')
    return user
def new(db,user,kind,values,id=None):
    row=WorkRecord(id=id or str(uuid.uuid4()),tenant=user.tenant,industry=industry(user),kind=kind,data=json.dumps(values,ensure_ascii=False));db.add(row);db.flush();return row
def records(db,user,kind):return list(db.scalars(select(WorkRecord).where(WorkRecord.tenant==user.tenant,WorkRecord.industry==industry(user),WorkRecord.kind==kind).order_by(WorkRecord.created).limit(1000)))
def get_record(db,user,id,kind=None):
    row=db.get(WorkRecord,id)
    if not row or row.tenant!=user.tenant or row.industry!=industry(user) or kind and row.kind!=kind:raise HTTPException(404,'Datensatz nicht gefunden.')
    return row
def value(row):return dict(json.loads(row.data),id=row.id,revision=row.revision)
def changed(row,data):row.data=json.dumps(data,ensure_ascii=False);row.revision+=1
def can_manage(user):return manager(user)
def warehouse(user):return manager(user) or user.role.endswith('_warehouse')
def require_manage(user):
    if not can_manage(user):raise HTTPException(403,'Büro-/Freigaberecht erforderlich.')
def editable_order(db,user,id):
    row=get_record(db,user,id,'orders')
    if not can_manage(user) and json.loads(row.data).get('assigned_user')!=user.id:raise HTTPException(403,'Nur eigene zugewiesene Aufträge bearbeiten.')
    return row
def seed(db,user):
    if records(db,user,'settings'):return
    new(db,user,'settings',{'name':'SYNTHETISCH · WerkZ Handwerk' if industry(user)=='handwerk' else 'SYNTHETISCH · SCHROTTIES – integrierte Demo-Neufassung','originalSource':'D:/WerkZ/mirror/schrotties-live' if industry(user)=='scrap' else 'WERKZ AI Business Core','demo':MODE=='demo'})
    if MODE!='demo':return
    customer=new(db,user,'customers',{'name':'SYNTHETISCH · Musterbetrieb','phone':'0000-0101','address':'Synthetische Musterstraße 1','notes':'Nur Beispieldaten.'})
    new(db,user,'employees',{'name':'SYNTHETISCH · Monteur' if industry(user)=='handwerk' else 'SYNTHETISCH · Fahrer','user_id':'','role':'technician' if industry(user)=='handwerk' else 'driver'})
    new(db,user,'vehicles',{'name':'SYNTHETISCH · Transporter 1','capacity_kg':1000,'state':'available'})
    for name,unit,quantity,minimum,cents in ([('SYNTHETISCH · Dichtung','Stück',50,10,250),('SYNTHETISCH · Rohrverbinder','Stück',20,5,890)] if industry(user)=='handwerk' else [('SYNTHETISCH · Mischschrott','kg',800,100,18),('SYNTHETISCH · Aluminium','kg',100,20,120)]):new(db,user,'inventory',{'name':name,'unit':unit,'quantity':quantity,'minimum':minimum,'unit_cents':cents,'priceSource':'Synthetischer Musterwert, kein aktueller Marktpreis'})
    new(db,user,'orders',{'title':'SYNTHETISCH · Wartung Heizungsanlage' if industry(user)=='handwerk' else 'SYNTHETISCH · Abholung Mischschrott','customer_id':customer.id,'address':'Synthetische Musterstraße 1','day':str(date.today()),'state':'open','assigned_user':'','vehicle_id':'','materials':[],'report':'','quote_id':'','weight_kg':'250','priority':'normal'})
    new(db,user,'tasks',{'title':'SYNTHETISCH · Anfrage telefonisch klären','state':'open','assigned_user':''})
def snapshot(db,user):
    seed(db,user);result={'industry':industry(user),'role':user.role,'roles':ROLES[industry(user)],'canManage':can_manage(user),'canWarehouse':warehouse(user),'demo':MODE=='demo','demoProfileSwitch':bool(records(db,user,'demo_grant')),'user_id':user.id,'name':value(records(db,user,'settings')[0])['name']}
    orders=[value(r) for r in records(db,user,'orders')]
    if not can_manage(user):orders=[o for o in orders if o.get('assigned_user')==user.id]
    result['orders']=orders;customer_ids={o.get('customer_id') for o in orders}
    result['customers']=[value(r) for r in records(db,user,'customers') if can_manage(user) or r.id in customer_ids]
    result['vehicles']=[value(r) for r in records(db,user,'vehicles')]
    result['employees']=[value(r) for r in records(db,user,'employees')] if can_manage(user) else []
    result['inventory']=[{k:v for k,v in value(r).items() if warehouse(user) or k not in {'unit_cents'}} for r in records(db,user,'inventory')]
    result['tasks']=[value(r) for r in records(db,user,'tasks') if can_manage(user) or value(r).get('assigned_user')==user.id]
    result['quotes']=[value(r) for r in records(db,user,'quotes')] if can_manage(user) else []
    result['invoices']=[value(r) for r in records(db,user,'invoices')] if can_manage(user) else []
    result['movements']=[value(r) for r in records(db,user,'movements')] if warehouse(user) else []
    allowed_ids={o['id'] for o in orders};result['evidence']=[value(r) for r in records(db,user,'evidence') if value(r).get('order_id') in allowed_ids]
    result['notifications']=[value(r) for r in records(db,user,'notifications') if can_manage(user) or value(r).get('user_id')==user.id]
    result['metrics']={'open_orders':sum(o['state'] not in {'completed','invoiced'} for o in orders),'in_progress':sum(o['state']=='in_progress' for o in orders),'customers':len(result['customers']),'low_stock':sum(float(i['quantity'])<float(i['minimum']) for i in result['inventory'])}
    return result
def context(db,user):
    s=snapshot(db,user);return {key:s[key] for key in ['industry','role','metrics','orders','tasks']}
@router.get('/snapshot')
def overview(user=Depends(permission)):
    with Session() as db:begin_write(db);result=snapshot(db,user);db.commit();return result
class WorkCommand(BaseModel):
    operation:Literal['customer.create','order.create','order.assign','order.start','order.complete','order.material','order.evidence','order.sign','order.invoice','quote.approve','stock.receive','stock.consume','vehicle.create','task.create','task.done','record.edit']
    target:str=Field(default='',max_length=80)
    revision:int=Field(default=0,ge=0)
    title:str=Field(default='',max_length=160)
    text:str=Field(default='',max_length=3000)
    customer_id:str=Field(default='',max_length=80)
    phone:str=Field(default='',max_length=100)
    address:str=Field(default='',max_length=300)
    day:str=Field(default='',max_length=10)
    assigned_user:str=Field(default='',max_length=80)
    vehicle_id:str=Field(default='',max_length=80)
    item_id:str=Field(default='',max_length=80)
    quantity:Decimal=Field(default=Decimal(1),gt=0,le=1000000,decimal_places=3)
    document_id:str=Field(default='',max_length=80)
    confirmed:bool=False
    idempotency_key:str=Field(default='',max_length=80)
@router.post('/commands')
def command(c:WorkCommand,user=Depends(permission)):
    with Session() as db:
        begin_write(db);seed(db,user);existing=replay(db,user,c.idempotency_key,'work.'+c.operation,c.model_dump(mode='json'))
        if existing is not None:return existing
        op=c.operation;row=None
        if op in {'customer.create','order.create','vehicle.create','task.create'}:
            require_manage(user)
            if not c.title.strip():raise HTTPException(400,'Bezeichnung eingeben.')
            if op=='customer.create':row=new(db,user,'customers',{'name':c.title,'phone':c.phone,'address':c.address,'notes':c.text})
            elif op=='vehicle.create':row=new(db,user,'vehicles',{'name':c.title,'capacity_kg':str(c.quantity),'state':'available'})
            elif op=='task.create':row=new(db,user,'tasks',{'title':c.title,'state':'open','assigned_user':c.assigned_user,'notes':c.text})
            else:
                get_record(db,user,c.customer_id,'customers')
                if c.day:
                    try:date.fromisoformat(c.day)
                    except ValueError:raise HTTPException(400,'Termin prüfen.')
                row=new(db,user,'orders',{'title':c.title,'customer_id':c.customer_id,'address':c.address,'day':c.day,'state':'open','assigned_user':'','vehicle_id':'','materials':[],'report':'','quote_id':'','priority':'normal'})
        elif op.startswith('order.'):
            row=editable_order(db,user,c.target);data=json.loads(row.data)
            if row.revision!=c.revision:raise HTTPException(409,'Auftrag wurde inzwischen geändert. Bitte neu laden.')
            if op=='order.assign':
                require_manage(user);assigned=db.get(User,c.assigned_user)
                if not assigned or assigned.tenant!=user.tenant or not assigned.role.startswith('handwerk_' if industry(user)=='handwerk' else 'scrap_'):raise HTTPException(400,'Mitarbeiter aus demselben Betrieb auswählen.')
                if c.vehicle_id:get_record(db,user,c.vehicle_id,'vehicles')
                if data['state'] not in {'open','scheduled'}:raise HTTPException(409,'Nur offene Aufträge disponieren.')
                data.update(assigned_user=assigned.id,vehicle_id=c.vehicle_id,day=c.day or data.get('day',''),state='scheduled');new(db,user,'notifications',{'user_id':assigned.id,'text':'Neuer Auftrag: '+data['title'],'state':'open'})
            elif op=='order.start':
                if data['state'] not in {'scheduled','open'}:raise HTTPException(409,'Auftrag ist nicht startbereit.')
                if not data.get('assigned_user'):raise HTTPException(409,'Zuerst Mitarbeiter zuweisen.')
                data['state']='in_progress'
            elif op=='order.material':
                if data['state']!='in_progress':raise HTTPException(409,'Material nur im laufenden Auftrag erfassen.')
                item=get_record(db,user,c.item_id,'inventory');stock=json.loads(item.data)
                incoming=industry(user)=='scrap'
                if incoming:
                    vehicle=get_record(db,user,data.get('vehicle_id',''),'vehicles');capacity=Decimal(str(json.loads(vehicle.data)['capacity_kg']))
                    if sum(Decimal(str(m['quantity'])) for m in data['materials'])+c.quantity>capacity:raise HTTPException(409,'Erfasste Ladung überschreitet die hinterlegte Nutzlast.')
                elif Decimal(str(stock['quantity']))<c.quantity:raise HTTPException(409,'Materialbestand reicht nicht aus.')
                delta=c.quantity if incoming else -c.quantity
                stock['quantity']=str(Decimal(str(stock['quantity']))+delta);changed(item,stock);data['materials'].append({'item_id':item.id,'name':stock['name'],'quantity':str(c.quantity),'unit':stock['unit']});new(db,user,'movements',{'item_id':item.id,'quantity':str(delta),'reason':'Auftrag '+row.id,'actor':user.id})
            elif op=='order.evidence':
                if not c.text.strip() and not c.document_id:raise HTTPException(400,'Bericht oder Bild erforderlich.')
                if c.document_id:
                    from .core import validate_work_photo
                    validate_work_photo(user,c.document_id,industry(user))
                new(db,user,'evidence',{'order_id':row.id,'text':c.text,'document_id':c.document_id,'actor':user.id});data['report']=c.text or data.get('report','')
            elif op=='order.sign':
                if not c.confirmed or not c.title.strip():raise HTTPException(400,'Namensbestätigung ausdrücklich bestätigen.')
                new(db,user,'evidence',{'order_id':row.id,'signature_name':c.title,'text':'Einfache Namensbestätigung, keine qualifizierte elektronische Signatur.','actor':user.id})
            elif op=='order.complete':
                if data['state']!='in_progress' or not c.confirmed or not data.get('report'):raise HTTPException(409,'Laufenden Auftrag dokumentieren und Abschluss bestätigen.')
                if db.scalar(select(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.target==row.id,TimeEntry.ended=='')):raise HTTPException(409,'Laufende Auftragszeit zuerst beenden.')
                data['state']='completed';new(db,user,'notifications',{'user_id':'','text':'Leistungsnachweis prüfen: '+data['title'],'state':'open'})
            elif op=='order.invoice':
                require_manage(user)
                if not c.confirmed or data['state']!='completed':raise HTTPException(409,'Abgeschlossenen Auftrag und Rechnungsentwurf bestätigen.')
                quote=get_record(db,user,data.get('quote_id',''),'quotes') if data.get('quote_id') else None
                if not quote:raise HTTPException(409,'Für den Rechnungsentwurf fehlt ein freigegebenes Angebot. Preise nicht erfinden.')
                calculation=json.loads(json.loads(quote.data)['calculation']);new(db,user,'invoices',{'order_id':row.id,'title':'Unverbindlicher Rechnungsentwurf · '+data['title'],'calculation':json.dumps(calculation),'state':'draft','sent':False});data['state']='invoiced'
            changed(row,data)
        elif op=='quote.approve':
            require_manage(user);row=get_record(db,user,c.target,'quotes');data=json.loads(row.data)
            if row.revision!=c.revision or data.get('state')!='draft' or not c.confirmed:raise HTTPException(409,'Offenen Angebotsentwurf ausdrücklich freigeben.')
            customer=get_record(db,user,data['customer_id'],'customers');order=new(db,user,'orders',{'title':data['title'],'customer_id':customer.id,'address':json.loads(customer.data).get('address',''),'day':c.day,'state':'open','assigned_user':'','vehicle_id':'','materials':[],'report':'','quote_id':row.id,'priority':'normal'});data['state']='approved';data['order_id']=order.id;changed(row,data)
        elif op.startswith('stock.'):
            if not warehouse(user):raise HTTPException(403,'Lagerrecht erforderlich.')
            row=get_record(db,user,c.target,'inventory');data=json.loads(row.data)
            if row.revision!=c.revision:raise HTTPException(409,'Lagerbestand inzwischen geändert.')
            delta=c.quantity if op=='stock.receive' else -c.quantity;quantity=Decimal(str(data['quantity']))+delta
            if quantity<0:raise HTTPException(409,'Negativer Bestand ist nicht erlaubt.')
            if not c.text.strip():raise HTTPException(400,'Begründung eingeben.')
            data['quantity']=str(quantity);changed(row,data);new(db,user,'movements',{'item_id':row.id,'quantity':str(delta),'actor':user.id,'reason':c.text})
        elif op=='task.done':
            row=get_record(db,user,c.target,'tasks');data=json.loads(row.data)
            if not can_manage(user) and data.get('assigned_user')!=user.id:raise HTTPException(403,'Nur eigene Aufgaben bearbeiten.')
            if row.revision!=c.revision:raise HTTPException(409,'Aufgabe wurde inzwischen geändert.')
            data['state']='done';changed(row,data)
        elif op=='record.edit':
            require_manage(user);row=get_record(db,user,c.target)
            if row.kind not in {'customers','orders','tasks','vehicles'} or row.revision!=c.revision:raise HTTPException(409,'Datensatz nicht bearbeitbar oder inzwischen geändert.')
            data=json.loads(row.data);data['name' if row.kind in {'customers','vehicles'} else 'title']=c.title or data.get('name',data.get('title',''));data['notes']=c.text
            if row.kind=='customers':data.update(phone=c.phone,address=c.address)
            changed(row,data)
        audit(db,user,'work.'+op,row.id if row else user.id);result={'saved':True,'record':value(row) if row else None};record(db,user,c.idempotency_key,'work.'+op,c.model_dump(mode='json'),result);db.commit();return result
class Material(BaseModel):
    description:str=Field(min_length=1,max_length=180)
    quantity:Decimal=Field(gt=0,le=100000,decimal_places=3)
    unit_price_cents:int=Field(ge=0,le=100000000)
class QuoteInput(BaseModel):
    customer_id:str
    title:str=Field(min_length=1,max_length=160)
    materials:list[Material]=Field(default_factory=list,max_length=50)
    hours:Decimal=Field(ge=0,le=10000,decimal_places=2)
    hourly_cents:int=Field(ge=0,le=1000000)
    vat_percent:Decimal=Field(default=Decimal(19),ge=0,le=100,decimal_places=2)
@router.post('/quotes',status_code=201)
def quote(input:QuoteInput,user=Depends(permission)):
    require_manage(user)
    from .core import calculate_quote
    calculation=calculate_quote(input.materials,input.hours,input.hourly_cents,input.vat_percent)
    with Session() as db:
        get_record(db,user,input.customer_id,'customers');row=new(db,user,'quotes',{'customer_id':input.customer_id,'title':input.title,'calculation':json.dumps(calculation),'state':'draft'});audit(db,user,'work.quote.created',row.id);db.commit();return {'id':row.id,**calculation}
@router.get('/quotes/{id}/pdf')
def quote_pdf(id:str,user=Depends(permission)):
    require_manage(user)
    from .core import render_quote_pdf
    with Session() as db:
        quote=value(get_record(db,user,id,'quotes'));customer=value(get_record(db,user,quote['customer_id'],'customers'));raw=render_quote_pdf(quote,customer)
        return Response(raw,media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="werkz-angebotsentwurf.pdf"'})
@router.get('/orders/{id}/proof')
def proof(id:str,user=Depends(permission)):
    from reportlab.pdfgen.canvas import Canvas
    with Session() as db:
        order=value(editable_order(db,user,id));evidence=[value(r) for r in records(db,user,'evidence') if value(r).get('order_id')==id];times=list(db.scalars(select(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.target==id)))
        out=io.BytesIO();pdf=Canvas(out);pdf.drawString(40,800,'WERKZ - Leistungsnachweis / Demo');y=770
        lines=[order['title'],order.get('address',''),order.get('report',''),'Status: '+order['state']]+[str(m) for m in order.get('materials',[])]+['Erfasste Zeitbuchungen: '+str(len(times))]+[str(e.get('text',e.get('signature_name',''))) for e in evidence]
        for line in lines:
            for part in [str(line)[i:i+85] for i in range(0,len(str(line)),85)]:
                if y<50:pdf.showPage();y=800
                pdf.drawString(40,y,part);y-=18
        pdf.save();return Response(out.getvalue(),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="werkz-leistungsnachweis.pdf"'})
@router.post('/demo/reset')
def reset(user=Depends(permission)):
    require_manage(user)
    if MODE!='demo':raise HTTPException(403,'Produktivdaten dürfen nicht zurückgesetzt werden.')
    with Session() as db:
        begin_write(db);db.execute(delete(TimeCorrection).where(TimeCorrection.tenant==user.tenant,TimeCorrection.entry_id.in_(select(TimeEntry.id).where(TimeEntry.tenant==user.tenant,TimeEntry.industry==industry(user)))));db.execute(delete(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.industry==industry(user)));db.execute(delete(WorkRecord).where(WorkRecord.tenant==user.tenant,WorkRecord.industry==industry(user),WorkRecord.kind!='demo_grant'));seed(db,user);bind_employees(db,user);audit(db,user,'work.demo.reset',user.tenant);db.commit();return {'reset':True}
def bind_employees(db,user):
    for record in records(db,user,'employees'):
        data=json.loads(record.data);account=db.scalar(select(User).where(User.tenant==user.tenant,User.role==industry(user)+'_'+data['role']))
        if account:data['user_id']=account.id;changed(record,data)

def prepare_demo_assignment(db,user):
    """Give browser demo field profiles an immediately usable synthetic job."""
    employees=records(db,user,'employees');vehicles=records(db,user,'vehicles')
    if not employees or not vehicles:return
    account=json.loads(employees[0].data).get('user_id')
    if not account:return
    for row in records(db,user,'orders'):
        data=json.loads(row.data)
        if data.get('state')=='open' and not data.get('assigned_user'):
            data.update(assigned_user=account,vehicle_id=vehicles[0].id,state='scheduled')
            changed(row,data)
class Profile(BaseModel):role:str=Field(default='administrator',max_length=40)
@router.post('/demo/start')
def demo_start(input:Profile,response:Response,request:Request):
    area='scrap' if PACKAGE=='schrotties-demo' else 'handwerk' if PACKAGE=='handwerk-demo' else ''
    if MODE!='demo' or area not in ROLES:raise HTTPException(403,'Branchendemo ist hier nicht verfügbar.')
    if input.role not in ROLES[area]:raise HTTPException(400,'Vorführprofil prüfen.')
    with Session() as db:
        begin_write(db);grant_hash=session_hash(request.cookies.get('werkz_demo_'+area,''));grant=db.scalar(select(WorkRecord).where(WorkRecord.industry==area,WorkRecord.kind=='demo_grant',WorkRecord.data.like('%'+grant_hash+'%')))
        if not grant or json.loads(grant.data)['expires']<time.time():
            tenant=str(uuid.uuid4())
            for role_name in ROLES[area]:db.add(User(id=str(uuid.uuid4()),tenant=tenant,username='demo-'+tenant[:8]+'-'+role_name,password_hash=hash_password(secrets.token_urlsafe(32)),role=area+'_'+role_name))
            db.flush();user=db.scalar(select(User).where(User.tenant==tenant,User.role==area+'_administrator'));seed(db,user);bind_employees(db,user);grant_token=secrets.token_urlsafe(32);new(db,user,'demo_grant',{'hash':session_hash(grant_token),'expires':time.time()+7200});response.set_cookie('werkz_demo_'+area,grant_token,httponly=True,samesite='strict',max_age=7200)
            prepare_demo_assignment(db,user)
            db.add(ModuleConfig(tenant=tenant,modules=json.dumps({'handwerk_ai':area=='handwerk','scrap_ai':area=='scrap','business_ai':False,'hotel_ai':False,'creative_ai':False,'deutschz_ai':False,'voice_ai':'simulation','automation':'preview'})))
        else:tenant=grant.tenant
        user=db.scalar(select(User).where(User.tenant==tenant,User.role==area+'_'+input.role));token=secrets.token_urlsafe(32);db.add(LoginSession(token_hash=session_hash(token),user_id=user.id,expires=time.time()+7200));db.commit();response.set_cookie(COOKIE_NAME,token,httponly=True,samesite='strict',max_age=7200);return {'id':user.id,'username':user.username,'role':user.role,'tenant':user.tenant,'modules':configuration(user.tenant)}
