import json,time,secrets,hashlib,os
from datetime import date,timedelta,datetime
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Request,Response
from pydantic import BaseModel,Field
from sqlalchemy import text,select,delete,func
from ...db import Session,User,LoginSession,ModuleConfig,MODE,PACKAGE,now
from ...write_lock import begin_write
from ...security import hash_password,session_hash,current_user,COOKIE_NAME
from ..registry import guard,configuration,audit
from .service import *

router=APIRouter(prefix='/api/hotel',tags=['hotel_ai'])
permission=guard('hotel_ai')
def transaction(db):begin_write(db)
@router.get('/snapshot')
def overview(user=Depends(permission)):
    with Session() as db:
        transaction(db);value=snapshot(db,user);db.commit();return value
@router.get('/context')
def read_context(q:str='',user=Depends(permission)):
    with Session() as db:
        transaction(db);value=context(db,user,q[:500]);db.commit();return {'readOnly':True,'data':value}
class GuestInput(BaseModel):
    name:str=Field(min_length=2,max_length=160)
    contact:str=Field(default='',max_length=200)
    notes:str=Field(default='',max_length=1000)

class RoomTypeInput(BaseModel):
    name:str=Field(min_length=1,max_length=100)
    capacity:int=Field(ge=1,le=8)
    nightly_cents:int=Field(ge=0,le=10000000)

@router.post('/room-types',status_code=201)
def create_room_type(input:RoomTypeInput,user=Depends(permission)):
    require(user,'admin')
    if not input.name.strip():raise HTTPException(400,'Bezeichnung erforderlich.')
    with Session() as db:
        transaction(db);seed(db,user)
        if any(row.name.casefold()==input.name.strip().casefold() for row in rows(db,RoomType,user.tenant)):raise HTTPException(409,'Zimmerkategorie existiert bereits.')
        row=add(db,RoomType,user.tenant,name=input.name.strip(),capacity=input.capacity,nightly_cents=input.nightly_cents)
        audit(db,user,'hotel.room_type.created',row.id);db.commit();return serialize(row)

class RoomInput(BaseModel):
    number:str=Field(min_length=1,max_length=30)
    type_id:str=Field(min_length=1,max_length=80)

@router.post('/rooms',status_code=201)
def create_room(input:RoomInput,user=Depends(permission)):
    require(user,'admin')
    if not input.number.strip():raise HTTPException(400,'Zimmernummer erforderlich.')
    with Session() as db:
        transaction(db);seed(db,user);get(db,RoomType,input.type_id,user.tenant)
        if any(row.number.casefold()==input.number.strip().casefold() for row in rows(db,Room,user.tenant)):raise HTTPException(409,'Zimmernummer existiert bereits.')
        row=add(db,Room,user.tenant,number=input.number.strip(),type_id=input.type_id)
        audit(db,user,'hotel.room.created',row.id);db.commit();return serialize(row)
@router.post('/guests',status_code=201)
def create_guest(input:GuestInput,user=Depends(permission)):
    require(user,'reception')
    with Session() as db:
        transaction(db);seed(db,user);row=add(db,Guest,user.tenant,**input.model_dump());audit(db,user,'hotel.guest.created',row.id);db.commit();return serialize(row)
class ReservationInput(BaseModel):
    guest_id:str=Field(default='',max_length=80)
    guest_name:str=Field(default='',max_length=160)
    guest_contact:str=Field(default='',max_length=200)
    room_id:str=Field(max_length=80)
    arrival:str=Field(max_length=10)
    departure:str=Field(max_length=10)
    persons:int=Field(ge=1,le=8)
    breakfast:bool=True
    state:Literal['request','confirmed']='request'
@router.post('/reservations',status_code=201)
def create_reservation(input:ReservationInput,user=Depends(permission)):
    require(user,'reception')
    with Session() as db:
        transaction(db);seed(db,user);values=input.model_dump()
        if input.guest_name.strip():
            if input.guest_id or len(input.guest_name.strip())<2:raise HTTPException(400,'Bestehenden Gast oder einen vollständigen neuen Gastnamen angeben.')
            guest=add(db,Guest,user.tenant,name=input.guest_name.strip(),contact=input.guest_contact.strip(),notes='')
            values['guest_id']=guest.id;audit(db,user,'hotel.guest.created',guest.id)
        if not values['guest_id']:raise HTTPException(400,'Gast auswählen oder neuen Namen eingeben.')
        row=reserve(db,user,values);audit(db,user,'hotel.reservation.created',row.id);db.commit();return serialize(row)

class GuestUpdate(GuestInput):
    revision:int=Field(ge=0)

class ReservationUpdate(BaseModel):
    revision:int=Field(ge=0)
    room_id:str=Field(max_length=80)
    arrival:str=Field(max_length=10)
    departure:str=Field(max_length=10)
    persons:int=Field(ge=1,le=8)
    breakfast:bool=True

@router.patch('/reservations/{id}')
def update_reservation(id:str,input:ReservationUpdate,user=Depends(permission)):
    require(user,'reception')
    with Session() as db:
        transaction(db);row=get(db,Reservation,id,user.tenant)
        if row.state not in {'request','confirmed'}:raise HTTPException(409,'Nur offene Anfragen und bestätigte Reservierungen können geändert werden.')
        check_revision(row,input.revision);room=get(db,Room,input.room_id,user.tenant);kind=get(db,RoomType,room.type_id,user.tenant)
        arrival,departure=stay_dates(input.arrival,input.departure)
        if room.blocked or input.persons>kind.capacity:raise HTTPException(409,'Zimmer gesperrt oder Kapazität überschritten.')
        if row.state=='confirmed':conflict(db,user,room.id,str(arrival),str(departure),row.id)
        for key,value in input.model_dump(exclude={'revision'}).items():setattr(row,key,value)
        row.nightly_cents=kind.nightly_cents
        audit(db,user,'hotel.reservation.updated',row.id);db.commit();return serialize(row)

class ReservationCancellation(BaseModel):
    revision:int=Field(ge=0)
    confirmed:bool=False

@router.post('/reservations/{id}/cancel')
def cancel_reservation(id:str,input:ReservationCancellation,user=Depends(permission)):
    require(user,'reception')
    if not input.confirmed:raise HTTPException(400,'Stornierung ausdrücklich bestätigen.')
    with Session() as db:
        transaction(db);row=get(db,Reservation,id,user.tenant)
        if row.state not in {'request','confirmed'}:raise HTTPException(409,'Nur offene Anfragen und bestätigte Reservierungen können storniert werden.')
        check_revision(row,input.revision);row.state='cancelled'
        audit(db,user,'hotel.reservation.cancelled',row.id);db.commit();return serialize(row)

@router.patch('/guests/{id}')
def update_guest(id:str,input:GuestUpdate,user=Depends(permission)):
    require(user,'reception')
    with Session() as db:
        transaction(db);row=get(db,Guest,id,user.tenant);check_revision(row,input.revision)
        for key,value in input.model_dump(exclude={'revision'}).items():setattr(row,key,value.strip())
        if len(row.name)<2:raise HTTPException(400,'Vollständiger Gastname erforderlich.')
        audit(db,user,'hotel.guest.updated',row.id);db.commit();return serialize(row)

class Command(BaseModel):
    idempotency_key:str=Field(default='',max_length=80)
    operation:Literal['reservation.confirm','reservation.checkin','reservation.checkout','task.assign','task.start','task.checklist','task.finish','task.inspect','task.photo','ticket.create','ticket.assign','ticket.resolve','ticket.photo','room.block','stock.receive','stock.consume','stock.count','purchase.propose','purchase.approve','purchase.receive','kitchen.create','kitchen.finish','breakfast.plan','restaurant.create','restaurant.advance','dining.reserve','employee.create','shift.create','absence.create','spa.create','request.create','request.finish','notification.read','invoice.paid','hotel.settings']
    target:str=Field(default='',max_length=80)
    revision:int=Field(default=0,ge=0)
    room_id:str|None=Field(default=None,max_length=80)
    guest_id:str|None=Field(default=None,max_length=80)
    employee_id:str|None=Field(default=None,max_length=80)
    supplier_id:str|None=Field(default=None,max_length=80)
    title:str=Field(default='',max_length=160)
    text:str=Field(default='',max_length=2000)
    priority:Literal['normal','high','urgent']='normal'
    blocking:bool=False
    checks:dict[str,bool]=Field(default_factory=dict,max_length=3)
    passed:bool=True
    confirmed:bool=False
    quantity:int=Field(default=1,ge=0,le=1000000)
    day:str=Field(default='',max_length=10)
    start:str=Field(default='',max_length=40)
    end:str=Field(default='',max_length=40)
    location:str=Field(default='',max_length=120)
    kind:Literal['wish','complaint','callback','housekeeping','material','lost_found','handover']='wish'
    document_id:str=Field(default='',max_length=80)
    table_number:int=Field(default=1,ge=1,le=12)
    persons:int=Field(default=1,ge=1,le=8)
    rest_hours:int=Field(default=11,ge=0,le=24)
    retention_days:int=Field(default=90,ge=7,le=3650)
    max_shift_hours:int=Field(default=12,ge=1,le=24)
    minimum_staff:int=Field(default=1,ge=1,le=20)

@router.post('/commands')
def command(c:Command,user=Depends(permission)):
    with Session() as db:
        transaction(db);seed(db,user);tenant=user.tenant;op=c.operation;row=None
        from ...workflow import replay,record
        existing=replay(db,user,c.idempotency_key,'hotel.'+op,c.model_dump())
        if existing is not None:return existing
        if op.startswith('reservation.'):
            require(user,'reception');row=get(db,Reservation,c.target,tenant);check_revision(row,c.revision);room=get(db,Room,row.room_id,tenant)
            if op=='reservation.confirm':
                if row.state!='request' or room.blocked:raise HTTPException(409,'Reservierungsanfrage oder Zimmer nicht freigabefähig.')
                conflict(db,user,room.id,row.arrival,row.departure,row.id);row.state='confirmed'
            if op=='reservation.checkin':
                if row.state!='confirmed' or not row.arrival<=str(date.today())<row.departure or room.blocked or room.cleaning!='ready' or room.id in occupancy(db,tenant):raise HTTPException(409,'Check-in erfordert bestätigte Buchung, gültigen Aufenthalt und freigegebenes Zimmer.')
                conflict(db,user,room.id,row.arrival,row.departure,row.id);add(db,Stay,tenant,reservation_id=row.id);row.state='checked_in'
            if op=='reservation.checkout':
                if row.state!='checked_in':raise HTTPException(409,'Gast ist nicht eingecheckt.')
                if not c.confirmed:raise HTTPException(400,'Check-out ausdrücklich bestätigen.')
                stay=db.scalar(select(Stay).where(Stay.reservation_id==row.id,Stay.tenant==tenant));stay.checked_out=now();row.state='checked_out';room.cleaning='dirty'
                add(db,HousekeepingTask,tenant,room_id=room.id);notify(db,tenant,'housekeeping','Zimmer '+room.number+': Abreisereinigung zuweisen.')
                nights=(date.fromisoformat(row.departure)-date.fromisoformat(row.arrival)).days;add(db,HotelInvoice,tenant,guest_id=row.guest_id,reservation_id=row.id,amount_cents=nights*row.nightly_cents,due=str(date.today()+timedelta(days=14)))
            room.revision+=1
        elif op.startswith('task.'):
            if op in {'task.assign','task.inspect'}:require(user,'housekeeping')
            row=allowed_task(db,user,c.target);check_revision(row,c.revision);room=get(db,Room,row.room_id,tenant)
            if op=='task.assign':
                require(user,'housekeeping');employee=get(db,Employee,c.employee_id,tenant)
                if employee.department!='Housekeeping':raise HTTPException(400,'Eine Housekeeping-Kraft auswählen.')
                row.employee_id=employee.id;row.priority=c.priority
            elif op=='task.start':
                if row.state!='open' or not row.employee_id:raise HTTPException(409,'Auftrag muss zugewiesen und offen sein.')
                row.state='in_progress';row.started=now();room.cleaning='in_progress'
            elif op=='task.checklist':
                if row.state!='in_progress' or not set(c.checks)<=CHECKS:raise HTTPException(409,'Checkliste nur während laufender Reinigung bearbeiten.')
                row.checklist=json.dumps({**json.loads(row.checklist),**c.checks});row.comment=c.text
            elif op=='task.finish':
                if row.state!='in_progress' or not all(json.loads(row.checklist).get(key) for key in CHECKS):raise HTTPException(409,'Alle Reinigungspunkte müssen vor Abschluss bestätigt sein.')
                row.state='review';row.finished=now();room.cleaning='review';notify(db,tenant,'housekeeping','Zimmer '+room.number+': Kontrolle erforderlich.')
            elif op=='task.inspect':
                require(user,'housekeeping')
                if row.state!='review':raise HTTPException(409,'Zimmer benötigt zuerst eine abgeschlossene Reinigung.')
                if c.passed:
                    if not c.confirmed or not all(c.checks.get(key) for key in CHECKS):raise HTTPException(400,'Qualitätscheckliste und Zimmerfreigabe ausdrücklich bestätigen.')
                    if any(t.room_id==room.id and t.state!='resolved' for t in rows(db,MaintenanceTicket,tenant)):raise HTTPException(409,'Offene Reparatur verhindert Zimmerfreigabe.')
                    if room.blocked and not any(t.room_id==room.id and t.state=='resolved' for t in rows(db,MaintenanceTicket,tenant)):raise HTTPException(409,'Sperrgrund zuerst durch ein dokumentiertes Reparaturticket prüfen lassen.')
                    row.state='released';room.cleaning='ready';room.blocked='';notify(db,tenant,'reception','Zimmer '+room.number+' wurde nach Kontrolle freigegeben.')
                else:row.state='open';row.checklist='{}';room.cleaning='dirty'
                add(db,RoomInspection,tenant,task_id=row.id,inspector=user.id,passed=int(c.passed),comment=c.text)
            elif op=='task.photo':
                from ...core import validate_hotel_photo
                validate_hotel_photo(user,c.document_id);row.photos=json.dumps([*json.loads(row.photos),c.document_id][-10:])
            room.revision+=1
        elif op=='ticket.create':
            require(user,'maintenance','housekeeping','housekeeping_own','reception')
            if not c.title.strip():raise HTTPException(400,'Defekt beschreiben.')
            room=get(db,Room,c.room_id,tenant) if c.room_id else None
            if role(user)=='housekeeping':
                employee=own_employee(db,user)
                if not room or not employee or not any(t.room_id==room.id and t.employee_id==employee.id for t in rows(db,HousekeepingTask,tenant)):raise HTTPException(403,'Nur Schäden an eigenen Aufträgen melden.')
            row=add(db,MaintenanceTicket,tenant,room_id=room.id if room else None,title=c.title,priority=c.priority,blocking=int(c.blocking),report=c.text)
            if room and c.blocking:room.blocked=c.title;room.revision+=1
            notify(db,tenant,'maintenance','Neuer Defekt: '+c.title)
        elif op=='ticket.photo':
            require(user,'maintenance');row=get(db,MaintenanceTicket,c.target,tenant);check_revision(row,c.revision)
            from ...core import validate_hotel_photo
            validate_hotel_photo(user,c.document_id);row.photos=json.dumps([*json.loads(row.photos),c.document_id][-10:])
        elif op in {'ticket.assign','ticket.resolve'}:
            require(user,'maintenance');row=get(db,MaintenanceTicket,c.target,tenant);check_revision(row,c.revision)
            if row.state=='resolved':raise HTTPException(409,'Ticket ist bereits abgeschlossen.')
            if op=='ticket.assign':
                employee=get(db,Employee,c.employee_id,tenant)
                if employee.department!='Haustechnik':raise HTTPException(400,'Haustechnik-Mitarbeiter auswählen.')
                row.employee_id=employee.id
            else:
                if not c.confirmed or len(c.text.strip())<5:raise HTTPException(400,'Reparaturbericht und ausdrückliche Bestätigung erforderlich.')
                row.state='resolved';row.report=c.text
                if row.room_id:
                    room=get(db,Room,row.room_id,tenant)
                    if not any(t.room_id==room.id and t.state!='released' for t in rows(db,HousekeepingTask,tenant)):add(db,HousekeepingTask,tenant,room_id=room.id);room.cleaning='dirty'
                    notify(db,tenant,'housekeeping','Reparatur Zimmer '+room.number+' dokumentiert; Reinigung/Kontrolle prüfen. Sperre bleibt bis Freigabe bestehen.')
        elif op=='room.block':
            require(user,'reception','maintenance')
            if not c.text.strip() or not c.confirmed:raise HTTPException(400,'Sperrgrund und Bestätigung erforderlich.')
            row=get(db,Room,c.target,tenant);check_revision(row,c.revision);row.blocked=c.text;notify(db,tenant,'maintenance','Zimmer '+row.number+' gesperrt: '+c.text)
        elif op.startswith('stock.'):
            require(user,'inventory');row=get(db,InventoryItem,c.target,tenant);check_revision(row,c.revision)
            delta=c.quantity if op=='stock.receive' else -c.quantity if op=='stock.consume' else c.quantity-row.quantity
            if row.quantity+delta<0:raise HTTPException(409,'Entnahme würde einen negativen Bestand erzeugen.')
            if not c.text.strip():raise HTTPException(400,'Grund der Bestandsänderung erforderlich.')
            if op=='stock.count' and not c.confirmed:raise HTTPException(400,'Inventurkorrektur bestätigen.')
            row.quantity+=delta;add(db,StockMovement,tenant,item_id=row.id,quantity=delta,actor=user.id,reason=c.text)
        elif op=='purchase.propose':
            require(user,'inventory')
            for item in rows(db,InventoryItem,tenant):
                if item.quantity<item.minimum and not any(p.item_id==item.id and p.state in {'pending','approved'} for p in rows(db,PurchaseRequest,tenant)):add(db,PurchaseRequest,tenant,item_id=item.id,quantity=2*item.minimum-item.quantity,supplier_id=c.supplier_id if c.supplier_id and get(db,Supplier,c.supplier_id,tenant) else None)
            notify(db,tenant,'management','Interne Bestellvorschläge erstellt; kein Lieferant wurde beauftragt.')
        elif op in {'purchase.approve','purchase.receive'}:
            require(user,'inventory');row=get(db,PurchaseRequest,c.target,tenant);check_revision(row,c.revision)
            if not c.confirmed:raise HTTPException(400,'Vorgang bestätigen.')
            if op=='purchase.approve':
                if row.state!='pending':raise HTTPException(409,'Vorschlag ist nicht offen.')
                row.state='approved'
            else:
                if row.state!='approved':raise HTTPException(409,'Wareneingang benötigt intern freigegebenen Vorschlag.')
                item=get(db,InventoryItem,row.item_id,tenant);item.quantity+=row.quantity;item.revision+=1;row.state='received';add(db,StockMovement,tenant,item_id=item.id,quantity=row.quantity,actor=user.id,reason='Bestätigter Wareneingang '+row.id)
        elif op in {'kitchen.create','kitchen.finish','breakfast.plan'}:
            require(user,'kitchen')
            if op=='kitchen.create':
                if not c.title.strip():raise HTTPException(400,'Küchenaufgabe beschreiben.')
                date.fromisoformat(c.day);row=add(db,KitchenTask,tenant,title=c.title,day=c.day)
            elif op=='kitchen.finish':row=get(db,KitchenTask,c.target,tenant);check_revision(row,c.revision);row.state='done'
            else:
                value=forecast(db,user,c.day);row=add(db,BreakfastForecast,tenant,day=c.day,guests=value['guests'],requirements=json.dumps(value['requirements']))
        elif op=='restaurant.create':
            require(user,'restaurant')
            if not c.text.strip() or not c.location.strip():raise HTTPException(400,'Bestellung und Tisch/Zimmer erforderlich.')
            row=add(db,RestaurantOrder,tenant,location=c.location,text=c.text);notify(db,tenant,'kitchen','Neue Servicebestellung: '+c.location)
        elif op=='restaurant.advance':
            require(user,'restaurant');row=get(db,RestaurantOrder,c.target,tenant);check_revision(row,c.revision);states=['open','preparing','ready','served']
            if row.state=='served':raise HTTPException(409,'Bestellung bereits serviert.')
            if row.state in {'open','preparing'}:require(user,'kitchen')
            row.state=states[states.index(row.state)+1];notify(db,tenant,'restaurant','Bestellung '+row.location+': '+row.state)
        elif op=='dining.reserve':
            require(user,'restaurant');get(db,Guest,c.guest_id,tenant);a,b=interval(c.start,c.end)
            if c.persons>6:raise HTTPException(400,'Tischkapazität höchstens sechs Personen.')
            if any(r.table_number==c.table_number and r.start<b.isoformat() and r.end>a.isoformat() for r in rows(db,DiningReservation,tenant)):raise HTTPException(409,'Tisch bereits reserviert.')
            row=add(db,DiningReservation,tenant,table_number=c.table_number,guest_id=c.guest_id,start=a.isoformat(),end=b.isoformat(),persons=c.persons)
        elif op=='employee.create':
            require(user,'staff')
            if not c.title.strip() or c.location not in {d.name for d in rows(db,Department,tenant)}:raise HTTPException(400,'Name und bestehende Abteilung erforderlich.')
            row=add(db,Employee,tenant,name=c.title,department=c.location,qualification=c.text[:100])
        elif op in {'shift.create','absence.create'}:
            require(user,'staff');employee=get(db,Employee,c.employee_id,tenant);a,b=interval(c.start,c.end);settings=json.loads(db.get(Hotel,tenant).settings)
            shifts=[s for s in rows(db,Shift,tenant) if s.employee_id==employee.id];absences=[s for s in rows(db,Absence,tenant) if s.employee_id==employee.id]
            if any(s.start<b.isoformat() and s.end>a.isoformat() for s in shifts+absences):raise HTTPException(409,'Zeitraum überschneidet sich mit Dienst oder Abwesenheit.')
            if op=='shift.create':
                if (b-a).total_seconds()>settings.get('max_shift_hours',12)*3600:raise HTTPException(409,'Konfigurierte maximale Schichtdauer überschritten.')
                for shift in shifts:
                    x,y=interval(shift.start,shift.end);gap=(a-y).total_seconds() if a>=y else (x-b).total_seconds()
                    if 0<=gap<settings.get('rest_hours',11)*3600:raise HTTPException(409,'Konfigurierte Ruhezeit unterschritten.')
                row=add(db,Shift,tenant,employee_id=employee.id,start=a.isoformat(),end=b.isoformat())
            else:row=add(db,Absence,tenant,employee_id=employee.id,start=a.isoformat(),end=b.isoformat(),reason=c.text)
        elif op=='spa.create':
            require(user,'wellness');get(db,Guest,c.guest_id,tenant);employee=get(db,Employee,c.employee_id,tenant);a,b=interval(c.start,c.end)
            if employee.qualification!='spa' or c.location not in {'Spa 1','Spa 2'}:raise HTTPException(400,'Qualifizierte Spa-Kraft und Raum Spa 1/2 erforderlich.')
            if any((s.employee_id==employee.id or s.room==c.location) and s.start<b.isoformat() and s.end>a.isoformat() for s in rows(db,SpaAppointment,tenant)):raise HTTPException(409,'Spa-Raum oder Mitarbeiter bereits gebucht.')
            if any(s.employee_id==employee.id and s.start<b.isoformat() and s.end>a.isoformat() for s in rows(db,Absence,tenant)):raise HTTPException(409,'Mitarbeiter ist abwesend.')
            row=add(db,SpaAppointment,tenant,guest_id=c.guest_id,employee_id=employee.id,room=c.location,treatment=c.title or 'Wellnessanwendung',start=a.isoformat(),end=b.isoformat())
        elif op=='request.create':
            require(user,'reception','housekeeping','housekeeping_own','kitchen','restaurant','inventory','staff','maintenance')
            if not c.text.strip():raise HTTPException(400,'Nachricht eingeben.')
            if c.room_id:get(db,Room,c.room_id,tenant)
            if role(user)=='housekeeping':
                employee=own_employee(db,user)
                if c.kind not in {'material','lost_found','housekeeping'} or not employee or not any(t.room_id==c.room_id and t.employee_id==employee.id for t in rows(db,HousekeepingTask,tenant)):raise HTTPException(403,'Meldung muss einen eigenen Reinigungsauftrag betreffen.')
            row=add(db,GuestRequest,tenant,room_id=c.room_id,kind=c.kind,text=c.text);notify(db,tenant,'inventory' if c.kind=='material' else 'reception',c.kind+': '+c.text[:140])
        elif op=='request.finish':
            require(user,'reception','inventory');row=get(db,GuestRequest,c.target,tenant)
            if 'reception' not in scopes(user) and row.kind!='material':raise HTTPException(403,'Nur Materialanforderungen bearbeiten.')
            check_revision(row,c.revision);row.state='done'
        elif op=='notification.read':
            row=get(db,Notification,c.target,tenant)
            if not any(n['id']==row.id for n in snapshot(db,user)['notifications']):raise HTTPException(403,'Nachricht nicht für diese Rolle.')
            check_revision(row,c.revision);row.state='read'
        elif op=='invoice.paid':
            require(user,'management');row=get(db,HotelInvoice,c.target,tenant);check_revision(row,c.revision)
            if not c.confirmed:raise HTTPException(400,'Zahlung bestätigen.')
            row.state='paid'
        elif op=='hotel.settings':
            require(user,'admin');hotel=db.get(Hotel,tenant);hotel.settings=json.dumps({'rest_hours':c.rest_hours,'retention_days':c.retention_days,'max_shift_hours':c.max_shift_hours,'minimum_staff':c.minimum_staff})
        audit(db,user,'hotel.'+op,row.id if row is not None else tenant);result={'saved':True,'record':serialize(row) if row is not None else None,'externalAction':False};record(db,user,c.idempotency_key,'hotel.'+op,c.model_dump(),result);db.commit();return result

@router.get('/breakfast')
def breakfast(day:str,user=Depends(permission)):
    with Session() as db:
        try:return forecast(db,user,day)
        except ValueError:raise HTTPException(400,'Datum prüfen.')
@router.get('/export')
def export(user=Depends(permission)):
    with Session() as db:
        transaction(db);value=snapshot(db,user);db.commit();return Response(json.dumps(value,ensure_ascii=False,indent=2),media_type='application/json',headers={'Content-Disposition':'attachment; filename="werkz-hotel-report.json"'})
@router.post('/demo/reset')
def reset_demo(user=Depends(permission)):
    require(user,'admin')
    if MODE!='demo':raise HTTPException(403,'Produktivdaten dürfen nicht zurückgesetzt werden.')
    with Session() as db:
        transaction(db)
        from ...platform_models import PortalSession,PortalAccess,PortalOrder,HotelMenu,GuestNote,GuestPreference,TimeCorrection,TimeEntry,WorkflowEvent
        access_ids=select(PortalAccess.id).where(PortalAccess.tenant==user.tenant)
        db.execute(delete(PortalSession).where(PortalSession.access_id.in_(access_ids)))
        hotel_time_ids=select(TimeEntry.id).where(TimeEntry.tenant==user.tenant,TimeEntry.industry=='hotel')
        db.execute(delete(TimeCorrection).where(TimeCorrection.tenant==user.tenant,TimeCorrection.entry_id.in_(hotel_time_ids)))
        db.execute(delete(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.industry=='hotel'))
        for model in [PortalOrder,PortalAccess,HotelMenu,GuestNote,GuestPreference]:db.execute(delete(model).where(model.tenant==user.tenant))
        for table in reversed(TABLES):
            if table.name not in {'hotel_hotels','hotel_demo_grants'}:db.execute(delete(table).where(table.c.tenant==user.tenant))
        hotel=db.get(Hotel,user.tenant)
        if hotel:hotel.seeded=0
        seed(db,user)
        for employee in rows(db,Employee,user.tenant):
            key={'cleaning':'housekeeping','inspection':'housekeeping_lead','maintenance':'maintenance','food':'kitchen','reception':'reception','spa':'wellness'}.get(employee.qualification)
            if key:
                match=db.scalar(select(User).where(User.tenant==user.tenant,User.role=='hotel_'+key));employee.user_id=match.id if match else None
        audit(db,user,'hotel.demo.reset',user.tenant);db.commit();return {'reset':True}

class DemoProfile(BaseModel):
    role:str=Field(default='management',max_length=40)

@router.get('/qr')
def qr_code(kind:Literal['room','inventory','asset','cart'],id:str,request:Request,user=Depends(permission)):
    import qrcode,qrcode.image.svg
    from urllib.parse import urlencode
    with Session() as db:
        if kind=='room':
            require(user,'rooms');get(db,Room,id,user.tenant)
            if role(user)=='housekeeping':
                employee=own_employee(db,user)
                if not employee or not any(t.room_id==id and t.employee_id==employee.id for t in rows(db,HousekeepingTask,user.tenant)):raise HTTPException(404,'Zimmer nicht gefunden.')
        elif kind=='inventory':require(user,'inventory');get(db,InventoryItem,id,user.tenant)
        elif kind=='asset':require(user,'maintenance');get(db,Asset,id,user.tenant)
        else:require(user,'housekeeping','housekeeping_own');get(db,InventoryItem,id,user.tenant)
    target=str(request.base_url)+'?'+urlencode({'hotelTarget':kind+':'+id})
    image=qrcode.make(target,image_factory=qrcode.image.svg.SvgPathFillImage)
    return Response(image.to_string(),media_type='image/svg+xml',headers={'Content-Disposition':'inline; filename="werkz-hotel-qr.svg"'})

@router.get('/availability')
def availability(arrival:str,departure:str,persons:int=1,user=Depends(permission)):
    require(user,'reception')
    with Session() as db:
        transaction(db);seed(db,user);value=available_room_snapshot(db,user,arrival,departure,persons);db.commit()
        return {**value,'available':[{'id':r['id'],'number':r['number'],'type':r['room_type'],'nightly_cents':r['nightly_cents']} for r in value['rooms']],'confirmed':False,'notice':'Verfügbarkeit ist keine Reservierung. Speicherung prüft den Zeitraum erneut.'}
def demo_only():
    if PACKAGE!='hotel-demo' or MODE!='demo':raise HTTPException(403,'Vorführprofile sind nur im getrennten Hotel-Demopaket verfügbar.')
def attach_session(db,user,response):
    token=secrets.token_urlsafe(32);db.add(LoginSession(token_hash=session_hash(token),user_id=user.id,expires=time.time()+7200));response.set_cookie(COOKIE_NAME,token,httponly=True,samesite='strict',max_age=7200)
    return {'id':user.id,'username':user.username,'role':user.role,'tenant':user.tenant,'modules':configuration(user.tenant)}
@router.post('/demo/start')
def start_demo(input:DemoProfile,response:Response,request:Request):
    demo_only()
    if input.role not in ROLES:raise HTTPException(400,'Unbekanntes Vorführprofil.')
    with Session() as db:
        transaction(db);grant_token=request.cookies.get('werkz_hotel_demo','');grant=db.get(DemoGrant,session_hash(grant_token)) if grant_token else None
        if not grant or grant.expires<time.time():
            if os.environ.get('WERKZ_ONLINE_TEST')=='1' and db.scalar(select(func.count()).select_from(DemoGrant))>=100:
                raise HTTPException(429,'Die Testinstanz ist ausgelastet. Bitte den Betreiber informieren.')
            tenant=uid();hotel=Hotel(tenant=tenant,name='WERKZ Grand Hotel Bad Pyrmont',settings=json.dumps({'rest_hours':11,'max_shift_hours':12,'minimum_staff':1,'retention_days':90}));db.add(hotel);db.flush()
            for key in ROLES:db.add(User(id=uid(),username='demo-'+tenant[:8]+'-'+key,password_hash=hash_password(secrets.token_urlsafe(32)),role='hotel_'+key,tenant=tenant))
            db.flush();owner=db.scalar(select(User).where(User.tenant==tenant,User.role=='hotel_administrator'));seed(db,owner)
            for employee in rows(db,Employee,tenant):
                key={'cleaning':'housekeeping','inspection':'housekeeping_lead','maintenance':'maintenance','food':'kitchen','reception':'reception','spa':'wellness'}.get(employee.qualification)
                employee.user_id=db.scalar(select(User.id).where(User.tenant==tenant,User.role=='hotel_'+key)) if key else None
            grant_token=secrets.token_urlsafe(32);grant=DemoGrant(token_hash=session_hash(grant_token),tenant=tenant,expires=int(time.time()+7200));db.add(grant)
            db.add(ModuleConfig(tenant=tenant,modules=json.dumps({'hotel_ai':True,'business_ai':False,'voice_ai':'simulation','automation':'preview','creative_ai':False,'deutschz_ai':False})))
        user=db.scalar(select(User).where(User.tenant==grant.tenant,User.role=='hotel_'+input.role));db.flush();value=attach_session(db,user,response);db.commit();response.set_cookie('werkz_hotel_demo',grant_token,httponly=True,samesite='strict',max_age=7200);return value
