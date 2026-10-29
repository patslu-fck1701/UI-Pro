import io,json,uuid
from datetime import date,timedelta
from decimal import Decimal,ROUND_HALF_UP
from xml.sax.saxutils import escape
from sqlalchemy import select
from ...db import MODE
from .models import Customer,Order,Invoice,Quote,Callback,Seed
from ..registry import audit

def seed(db,tenant):
    if MODE!='demo' or db.get(Seed,tenant):return
    today=date.today()
    customers=[Customer(id=str(uuid.uuid4()),tenant=tenant,name='SYNTHETISCH · '+name,phone='0000-000'+str(i),address='Demoanschrift '+str(i),notes='Ausschließlich synthetische Beispieldaten.') for i,name in enumerate(['Musterbetrieb Nord','Beispielhaus Süd','Demo-Werkstatt'],1)]
    db.add_all(customers);db.flush()
    db.add_all([Order(id=str(uuid.uuid4()),tenant=tenant,customer_id=customers[i%3].id,title='SYNTHETISCH · '+title,status=status,priority=priority,appointment=today.isoformat()+'T'+hour,notes='Synthetischer Vorführauftrag.') for i,(title,status,priority,hour) in enumerate([('Heizungswartung','open','normal','10:00'),('Wasserleitung prüfen','in_progress','urgent','12:00'),('Armatur austauschen','completed','normal','14:00')])])
    db.add_all([Invoice(id=str(uuid.uuid4()),tenant=tenant,customer_id=customers[0].id,number='DEMO-001',amount_cents=119000,due=(today-timedelta(days=10)).isoformat(),status='open'),Invoice(id=str(uuid.uuid4()),tenant=tenant,customer_id=customers[1].id,number='DEMO-002',amount_cents=59500,due=today.isoformat(),status='paid')])
    db.add(Callback(id=str(uuid.uuid4()),tenant=tenant,customer_id=customers[2].id,topic='SYNTHETISCH · Rückfrage zum Wartungstermin',urgency='normal',phone='0000-0003',address='Demoanschrift 3',requested=today.isoformat()))
    db.add(Seed(tenant=tenant));db.commit()
def row(value):
    return {column.name:getattr(value,column.name) for column in value.__table__.columns if column.name!='tenant'}
def snapshot(db,user):
    seed(db,user.tenant)
    result={}
    for key,model in [('customers',Customer),('orders',Order),('invoices',Invoice),('quotes',Quote),('callbacks',Callback)]:
        result[key]=[row(value) for value in db.scalars(select(model).where(model.tenant==user.tenant).limit(500))]
    today=date.today().isoformat();invoices=result['invoices']
    result['metrics']={'openOrders':sum(o['status'] in {'open','in_progress'} for o in result['orders']),'callbacks':sum(c['status']=='open' for c in result['callbacks']),'openQuotes':len(result['quotes']),'openInvoices':sum(i['status']=='open' for i in invoices),'overdueInvoices':sum(i['status']=='open' and i['due']<today for i in invoices),'paidCents':sum(i['amount_cents'] for i in invoices if i['status']=='paid'),'outstandingCents':sum(i['amount_cents'] for i in invoices if i['status']=='open')}
    result['mode']=MODE;result['asOf']=today
    return result
def calculate(materials,hours,hourly_cents,vat_percent):
    rows=[]
    for item in materials:
        amount=int((Decimal(str(item.quantity))*item.unit_price_cents).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
        rows.append({'description':item.description,'quantity':str(item.quantity),'unit_price_cents':item.unit_price_cents,'amount_cents':amount})
    labour=int((Decimal(str(hours))*hourly_cents).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
    net=sum(item['amount_cents'] for item in rows)+labour
    tax=int((Decimal(net)*Decimal(str(vat_percent))/100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
    return {'materials':rows,'hours':str(hours),'hourly_cents':hourly_cents,'labour_cents':labour,'net_cents':net,'vat_percent':str(vat_percent),'tax_cents':tax,'gross_cents':net+tax,'binding':False,'source':'deterministic_user_inputs'}
def quote_pdf(quote,customer):
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    value=json.loads(quote.calculation);stream=io.BytesIO();styles=getSampleStyleSheet();money=lambda cents:f'{cents/100:.2f} EUR'
    elements=[Paragraph('WERKZ – Unverbindlicher Angebotsentwurf',styles['Title']),Spacer(1,18),Paragraph(escape(customer.name),styles['Normal']),Paragraph(escape(customer.address),styles['Normal']),Spacer(1,18),Paragraph(escape(quote.title),styles['Heading2'])]
    rows=[['Position','Menge','Einzelpreis','Gesamt']]
    rows += [[Paragraph(escape(item['description']),styles['Normal']),item['quantity'],money(item['unit_price_cents']),money(item['amount_cents'])] for item in value['materials']]
    rows.append(['Arbeitszeit',value['hours']+' h',money(value['hourly_cents']),money(value['labour_cents'])])
    table=Table(rows,colWidths=[230,60,90,90]);table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#d7efce')),('GRID',(0,0),(-1,-1),.4,colors.grey),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),10)]));elements += [table,Spacer(1,18),Paragraph('Netto: '+money(value['net_cents']),styles['Normal']),Paragraph('Umsatzsteuer: '+money(value['tax_cents']),styles['Normal']),Paragraph('Gesamt: '+money(value['gross_cents']),styles['Heading2']),Paragraph('Unverbindlicher Entwurf. Positionen, Mengen, Steuern und Leistungsumfang vor Verwendung fachlich prüfen. Keine automatische Bestellung oder Übertragung.',styles['Normal'])]
    SimpleDocTemplate(stream).build(elements);return stream.getvalue()

def store_callback(db,user,fields):
    customer=db.scalar(select(Customer).where(Customer.tenant==user.tenant,Customer.phone==fields['phone']))
    if not customer:
        customer=Customer(id=str(uuid.uuid4()),tenant=user.tenant,name=('SYNTHETISCH · ' if MODE=='demo' else '')+fields['name'],phone=fields['phone'],address=fields['address'],notes='Aus bestätigter Gesprächssimulation.');db.add(customer);db.flush()
    value=Callback(id=str(uuid.uuid4()),tenant=user.tenant,customer_id=customer.id,**{key:item for key,item in fields.items() if key!='name'});db.add(value);audit(db,user,'voice.callback.created',value.id);db.commit();return {'id':value.id,'customer_id':customer.id,'simulation':True}
