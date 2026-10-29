import json,secrets,uuid,hashlib,re,time
from datetime import datetime,timedelta,timezone,date
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Request,Response
from pydantic import BaseModel,Field
from sqlalchemy import select,text,delete
from .db import Session,User,MODE,now
from .security import current_user,session_hash
from .modules.registry import guard,audit
from .modules.hotel.service import get,rows,require,serialize,notify,uid,seed
from .modules.hotel.models import Guest,Room,Reservation,Hotel,GuestRequest,MaintenanceTicket
from .platform_models import GuestPreference,GuestNote,PortalAccess,PortalSession,PortalOrder,HotelMenu
from .workflow import replay,record

router=APIRouter(tags=['hotel_guest_service'])
hotel_permission=guard('hotel_ai')
PREFERENCES={'language':{'de','en'},'contact':{'reception','phone','portal'},'restaurant':{'interested','not_interested'},'excursions':{'interested','not_interested'},'wellness':{'interested','not_interested'},'room':{'quiet','high_floor','accessible_request'},'address':{'formal','informal'}}
def seed_menu(db,tenant):
    if MODE!='demo' or db.scalar(select(HotelMenu.id).where(HotelMenu.tenant==tenant)):return
    for name,category,price,department,allergens in [('Synthetische Frühstücksbox','food',1200,'kitchen','Gluten, Ei - synthetische geprüfte Stammdaten'),('Synthetisches Mineralwasser','drink',350,'restaurant','Keine kennzeichnungspflichtigen Allergene laut synthetischen Stammdaten'),('Zusätzliche Handtücher','towels',0,'housekeeping',''),('Zimmerreinigung anfragen','cleaning',0,'housekeeping',''),('Reinigung aussetzen','skip_cleaning',0,'housekeeping',''),('Defekt melden','defect',0,'maintenance',''),('Wellnessanfrage','wellness',0,'wellness',''),('Rückruf erbeten','callback',0,'reception',''),('Ausflugs- / Mietwageninformationen','information',0,'reception','')]:db.add(HotelMenu(id=uid(),tenant=tenant,name=name,category=category,price_cents=price,department=department,allergens=allergens))
class PreferenceInput(BaseModel):
    category:str=Field(max_length=30)
    value:str=Field(max_length=50)
    scope:Literal['stay','conversation','permanent']='stay'
    stay_id:str
    consent:str=Field(default='',max_length=250)
    days:int=Field(default=30,ge=1,le=365)
@router.post('/api/hotel/guests/{id}/preferences',status_code=201)
def preference(id:str,input:PreferenceInput,user=Depends(hotel_permission)):
    require(user,'reception')
    if input.category not in PREFERENCES or input.value not in PREFERENCES[input.category]:raise HTTPException(400,'Nur ausdrücklich angebotene, servicebezogene Auswahlwerte sind zulässig.')
    if input.scope=='permanent' and len(input.consent.strip())<10:raise HTTPException(400,'Dauerhafte Präferenz benötigt dokumentierte freiwillige Freigabe und Information.')
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'));get(db,Guest,id,user.tenant);stay=get(db,Reservation,input.stay_id,user.tenant)
        if stay.guest_id!=id:raise HTTPException(400,'Aufenthalt gehört nicht zu diesem Gast.')
        expiry=str(date.today()+timedelta(days=input.days)) if input.scope=='permanent' else stay.departure if input.scope=='stay' else str(date.today()+timedelta(days=1))
        row=GuestPreference(id=uid(),tenant=user.tenant,guest_id=id,stay_id=stay.id,category=input.category,value=input.value,scope=input.scope,consent=input.consent if input.scope=='permanent' else '',expires=expiry);db.add(row);audit(db,user,'hotel.preference.created',row.id);db.commit();return serialize(row)
@router.delete('/api/hotel/preferences/{id}')
def delete_preference(id:str,user=Depends(hotel_permission)):
    require(user,'reception')
    with Session() as db:
        row=get(db,GuestPreference,id,user.tenant);db.delete(row);audit(db,user,'hotel.preference.deleted',id);db.commit();return {'deleted':True}
class NoteInput(BaseModel):
    stay_id:str
    category:Literal['service','conversation','handover']='conversation'
    text:str=Field(min_length=1,max_length=1200)
    days:int=Field(default=1,ge=1,le=30)
@router.post('/api/hotel/guests/{id}/notes',status_code=201)
def note(id:str,input:NoteInput,user=Depends(hotel_permission)):
    require(user,'reception')
    if re.search(r'(?i)sexuell|sexual|fetisch|diagnose|hiv|religion|politisch|sexuelle orientierung',input.text):raise HTTPException(400,'Besonders sensible Angaben gehören nicht in allgemeine Servicenotizen.')
    with Session() as db:
        get(db,Guest,id,user.tenant);stay=get(db,Reservation,input.stay_id,user.tenant)
        if stay.guest_id!=id:raise HTTPException(400,'Aufenthaltsbezug prüfen.')
        row=GuestNote(id=uid(),tenant=user.tenant,guest_id=id,stay_id=stay.id,actor=user.id,category=input.category,text=input.text,expires=str(date.today()+timedelta(days=input.days)));db.add(row);audit(db,user,'hotel.note.created',row.id);db.commit();return serialize(row)
@router.delete('/api/hotel/notes/{id}')
def delete_note(id:str,user=Depends(hotel_permission)):
    require(user,'reception')
    with Session() as db:row=get(db,GuestNote,id,user.tenant);db.delete(row);audit(db,user,'hotel.note.deleted',id);db.commit();return {'deleted':True}
@router.get('/api/hotel/guests/{id}/card')
def guest_card(id:str,user=Depends(hotel_permission)):
    require(user,'reception')
    with Session() as db:
        guest=get(db,Guest,id,user.tenant);stays=[r for r in rows(db,Reservation,user.tenant) if r.guest_id==id];today=str(date.today());active=[r for r in stays if r.state in {'confirmed','checked_in'}]
        prefs=[serialize(p) for p in rows(db,GuestPreference,user.tenant) if p.guest_id==id and p.expires>=today and (p.scope=='permanent' or any(s.id==p.stay_id and s.state=='checked_in' for s in active))]
        notes=[serialize(n) for n in rows(db,GuestNote,user.tenant) if n.guest_id==id and n.expires>=today]
        allowed=[p for p in prefs if p['scope']=='permanent' and p['consent'] or p['scope']=='stay']
        suggestions=[f"Der Gast hat {p['category']} = {p['value']} ausdrücklich mitgeteilt. Bei passender Gelegenheit diskret Unterstützung anbieten." for p in allowed]
        return {'guest':serialize(guest),'stays':[serialize(s) for s in stays],'preferences':prefs,'notes':notes,'serviceSuggestions':suggestions,'externalSources':'Keine aktuellen Wetter-, Veranstaltungs- oder Angebotsquellen verbunden.','personalizationUsesRawNotes':False}
class Confirmation(BaseModel):confirmed:bool=False
@router.get('/api/hotel/guest-qr/{id}')
def guest_qr(id:str,request:Request,user=Depends(hotel_permission)):
    require(user,'reception')
    import qrcode,qrcode.image.svg
    from urllib.parse import urlencode
    with Session() as db:room=get(db,Room,id,user.tenant)
    target=str(request.base_url)+'?'+urlencode({'guestPortal':'1','room':room.number})
    image=qrcode.make(target,image_factory=qrcode.image.svg.SvgPathFillImage)
    return Response(image.to_string(),media_type='image/svg+xml')
@router.post('/api/hotel/reservations/{id}/portal-code')
def issue_code(id:str,input:Confirmation,user=Depends(hotel_permission)):
    require(user,'reception')
    if not input.confirmed:raise HTTPException(400,'Zugangsausgabe bestätigen.')
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'));reservation=get(db,Reservation,id,user.tenant)
        if reservation.state!='checked_in':raise HTTPException(409,'Portalzugang nur für aktuell eingecheckten Aufenthalt.')
        for old in rows(db,PortalAccess,user.tenant):
            if old.reservation_id==id:old.revoked=1
        code=secrets.token_urlsafe(18);expiry=min(datetime.now(timezone.utc)+timedelta(days=7),datetime.fromisoformat(reservation.departure+'T23:59:00+00:00'));access=PortalAccess(id=uid(),tenant=user.tenant,reservation_id=id,code_hash=session_hash(code),expires=expiry.isoformat());db.add(access);audit(db,user,'hotel.portal.code.issued',id);db.commit();return {'room':get(db,Room,reservation.room_id,user.tenant).number,'code':code,'expires':access.expires,'showOnce':True,'url':'/?guestPortal=1'}
attempts={}
class GuestLogin(BaseModel):
    room:str=Field(min_length=1,max_length=10)
    code:str=Field(min_length=10,max_length=100)
@router.post('/api/guest/login')
def login(input:GuestLogin,response:Response,request:Request):
    from .db import PACKAGE
    if PACKAGE!='hotel-demo':raise HTTPException(404,'Gästeportal gehört zur Hotel-Anwendung.')
    key=request.client.host if request.client else 'local';now_value=time.time();start,count=attempts.get(key,(now_value,0));count=count+1 if now_value-start<900 else 1
    attempts[key]=(start if now_value-start<900 else now_value,count)
    if count>30:raise HTTPException(429,'Zu viele Anmeldeversuche. Bitte später erneut versuchen.')
    with Session() as db:
        access=db.scalar(select(PortalAccess).where(PortalAccess.code_hash==session_hash(input.code),PortalAccess.revoked==0))
        if not access or access.expires<now():raise HTTPException(401,'Zimmer und Zugangscode prüfen.')
        reservation=get(db,Reservation,access.reservation_id,access.tenant);room=get(db,Room,reservation.room_id,access.tenant)
        if reservation.state!='checked_in' or room.number!=input.room:raise HTTPException(401,'Zimmer und Zugangscode prüfen.')
        token=secrets.token_urlsafe(32);db.add(PortalSession(token_hash=session_hash(token),access_id=access.id,expires=access.expires));db.commit();response.set_cookie('werkz_hotel_guest',token,httponly=True,samesite='strict',max_age=86400);attempts.pop(key,None);return {'authenticated':True,'room':room.number}
def guest_session(request:Request):
    from .db import PACKAGE
    if PACKAGE!='hotel-demo':raise HTTPException(404,'Gästeportal nicht verfügbar.')
    with Session() as db:
        session=db.get(PortalSession,session_hash(request.cookies.get('werkz_hotel_guest','')))
        if not session or session.expires<now():raise HTTPException(401,'Gästezugang erforderlich oder abgelaufen.')
        access=db.get(PortalAccess,session.access_id)
        if not access or access.revoked or access.expires<now():raise HTTPException(401,'Gästezugang abgelaufen.')
        from .modules.registry import configuration
        if not configuration(access.tenant).get('hotel_ai'):raise HTTPException(403,'Hotelmodul ist deaktiviert.')
        reservation=db.get(Reservation,access.reservation_id)
        if not reservation or reservation.state!='checked_in':raise HTTPException(401,'Gästezugang endet beim Check-out.')
        return {'tenant':access.tenant,'reservation_id':reservation.id,'room_id':reservation.room_id}
@router.get('/api/guest/overview')
def guest_overview(access=Depends(guest_session)):
    with Session() as db:
        seed_menu(db,access['tenant']);db.commit()
        orders=[serialize(o) for o in rows(db,PortalOrder,access['tenant']) if o.reservation_id==access['reservation_id']]
        return {'hotel':db.get(Hotel,access['tenant']).name,'room':get(db,Room,access['room_id'],access['tenant']).number,'menu':[serialize(m) for m in rows(db,HotelMenu,access['tenant']) if m.available],'orders':orders,'info':{'breakfast':'Demo-Frühstück: 07:00–10:00 Uhr (synthetische Hotelkonfiguration).','billing':'Keine automatische Zimmerbelastung, Zahlung oder externe Buchung.'}}
class GuestOrderInput(BaseModel):
    item_id:str
    unit_price_cents:int=Field(ge=0,le=1000000)
    quantity:int=Field(default=1,ge=1,le=10)
    special:str=Field(default='',max_length=1000)
    allergy:bool=False
    confirmed:bool=False
    idempotency_key:str=Field(default='',max_length=80)
@router.post('/api/guest/orders',status_code=201)
def order(input:GuestOrderInput,access=Depends(guest_session)):
    if not input.confirmed:raise HTTPException(400,'Leistung, Gesamtpreis und Sonderwunsch vor Bestellung bestätigen.')
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'));item=get(db,HotelMenu,input.item_id,access['tenant'])
        if not item.available:raise HTTPException(409,'Leistung ist nicht mehr verfügbar.')
        if item.price_cents!=input.unit_price_cents:raise HTTPException(409,'Preis hat sich geändert. Angebot neu laden und ausdrücklich bestätigen.')
        # Reservation-scoped key: guest access is not a staff principal.
        synthetic=type('Principal',(),{'id':None,'tenant':access['tenant']})
        if input.idempotency_key:
            old=db.scalar(select(PortalOrder).where(PortalOrder.tenant==access['tenant'],PortalOrder.reservation_id==access['reservation_id'],PortalOrder.id==str(uuid.uuid5(uuid.NAMESPACE_URL,access['reservation_id']+input.idempotency_key))))
            if old:
                if old.item!=item.name or old.quantity!=input.quantity or old.special!=input.special or bool(old.allergy)!=input.allergy:raise HTTPException(409,'Vorgangsschlüssel wurde für eine andere Bestellung verwendet.')
                return serialize(old)
        row=PortalOrder(id=str(uuid.uuid5(uuid.NAMESPACE_URL,access['reservation_id']+input.idempotency_key)) if input.idempotency_key else uid(),tenant=access['tenant'],reservation_id=access['reservation_id'],category=item.category,item=item.name,quantity=input.quantity,price_cents=item.price_cents*input.quantity,special=input.special,allergy=int(input.allergy),department=item.department)
        db.add(row);notify(db,access['tenant'],item.department,'Neue Gästeanfrage: '+item.name+' · Zimmer '+get(db,Room,access['room_id'],access['tenant']).number)
        if item.category=='defect':
            ticket=MaintenanceTicket(id=uid(),tenant=access['tenant'],room_id=access['room_id'],title='Gästemeldung: '+input.special[:140],priority='high');db.add(ticket)
        db.commit();return serialize(row)
class Advance(BaseModel):
    revision:int=Field(ge=0)
    state:Literal['accepted','preparing','en_route','delivered','cancelled','unavailable']
    allergy_ack:bool=False
@router.get('/api/hotel/guest-orders')
def department_orders(user=Depends(hotel_permission)):
    from .modules.hotel.service import scopes
    with Session() as db:
        permissions=scopes(user);orders=[]
        for order in rows(db,PortalOrder,user.tenant):
            if order.department not in permissions and 'management' not in permissions and not (order.department=='housekeeping' and 'housekeeping_own' in permissions):continue
            reservation=get(db,Reservation,order.reservation_id,user.tenant);room=get(db,Room,reservation.room_id,user.tenant)
            if 'housekeeping_own' in permissions:
                from .modules.hotel.service import HousekeepingTask,own_employee
                employee=own_employee(db,user)
                if not employee or not any(t.room_id==room.id and t.employee_id==employee.id for t in rows(db,HousekeepingTask,user.tenant)):continue
            orders.append(dict(serialize(order),room=room.number))
        return orders
@router.post('/api/hotel/guest-orders/{id}')
def advance(id:str,input:Advance,user=Depends(hotel_permission)):
    from .modules.hotel.service import check_revision
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'));row=get(db,PortalOrder,id,user.tenant)
        if not any(o['id']==id for o in department_orders(user)):raise HTTPException(403,'Bestellung nicht für diese Abteilung.')
        check_revision(row,input.revision);allowed={'received':{'accepted','cancelled','unavailable'},'accepted':{'preparing','cancelled','unavailable'},'preparing':{'en_route','cancelled'},'en_route':{'delivered'},'delivered':set(),'cancelled':set(),'unavailable':set()}
        if input.state not in allowed[row.state]:raise HTTPException(409,'Ungültiger Bestellstatuswechsel.')
        if row.allergy and input.state in {'accepted','preparing'} and not row.allergy_ack and not input.allergy_ack:raise HTTPException(409,'Allergiehinweis muss gesondert an Küche übergeben und bestätigt werden.')
        if input.allergy_ack:row.allergy_ack=1
        row.state=input.state;audit(db,user,'hotel.guest-order.'+input.state,row.id);db.commit();return serialize(row)
@router.post('/api/guest/logout')
def guest_logout(request:Request,response:Response):
    with Session() as db:
        row=db.get(PortalSession,session_hash(request.cookies.get('werkz_hotel_guest','')))
        if row:db.delete(row);db.commit()
    response.delete_cookie('werkz_hotel_guest');return {'loggedOut':True}
