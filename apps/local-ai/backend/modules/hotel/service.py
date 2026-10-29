import json,uuid,secrets
from datetime import date,datetime,timedelta,timezone
from decimal import Decimal,ROUND_HALF_UP
from sqlalchemy import select,delete
from fastapi import HTTPException
from ...db import User,MODE,now
from .models import *

ROLES={'administrator':'Hoteladministration','management':'Hoteldirektion','reception':'Rezeption','housekeeping_lead':'Hausdame / Housekeeping-Leitung','housekeeping':'Reinigungskraft','kitchen_lead':'Küchenleitung','kitchen':'Küchenpersonal','service':'Restaurant / Service','inventory':'Lagerverwaltung','maintenance':'Haustechnik','hr':'Personalverwaltung'}
SCOPES={'administrator':{'reception','rooms','housekeeping','maintenance','inventory','kitchen','restaurant','staff','wellness','management','admin'},'management':{'reception','rooms','housekeeping','maintenance','inventory','kitchen','restaurant','staff','wellness','management'},'reception':{'reception','rooms','wellness'},'housekeeping_lead':{'rooms','housekeeping'},'housekeeping':{'rooms','housekeeping_own'},'kitchen_lead':{'kitchen','inventory','restaurant'},'kitchen':{'kitchen','restaurant'},'service':{'restaurant','rooms'},'inventory':{'inventory'},'maintenance':{'maintenance','rooms'},'hr':{'staff'}}
MODELS={'departments':Department,'room_types':RoomType,'rooms':Room,'employees':Employee,'guests':Guest,'reservations':Reservation,'stays':Stay,'tasks':HousekeepingTask,'inspections':RoomInspection,'tickets':MaintenanceTicket,'inventory':InventoryItem,'movements':StockMovement,'suppliers':Supplier,'purchases':PurchaseRequest,'kitchen_tasks':KitchenTask,'recipes':Recipe,'forecasts':BreakfastForecast,'restaurant_orders':RestaurantOrder,'dining':DiningReservation,'shifts':Shift,'absences':Absence,'spa':SpaAppointment,'invoices':HotelInvoice,'notifications':Notification,'requests':GuestRequest,'assets':Asset}
CHECKS={'bathroom','bed','supplies'}
ROLES['wellness']='Wellnesspersonal'
SCOPES['wellness']={'wellness','rooms'}
def uid():return str(uuid.uuid4())
def role(user):return 'administrator' if user.role=='admin' else user.role.removeprefix('hotel_')
def scopes(user):return SCOPES.get(role(user),set())
def require(user,*allowed):
    if not scopes(user).intersection(allowed):raise HTTPException(403,'Für diese Hotelaufgabe fehlt die Berechtigung.')
def rows(db,model,tenant):return list(db.scalars(select(model).where(model.tenant==tenant).order_by(model.id).limit(1000)))
def get(db,model,id,tenant):
    row=db.get(model,id)
    if not row or row.tenant!=tenant:raise HTTPException(404,'Datensatz nicht gefunden.')
    return row
def add(db,model,tenant,**values):
    row=model(id=uid(),tenant=tenant,**values);db.add(row);db.flush();return row
def serialize(row):return {column.name:getattr(row,column.name) for column in row.__table__.columns if column.name!='tenant'}
def notify(db,tenant,department,text):add(db,Notification,tenant,department=department,text=text)
def seed(db,user):
    hotel=db.get(Hotel,user.tenant)
    if not hotel:
        hotel=Hotel(tenant=user.tenant,name='WERKZ Grand Hotel Bad Pyrmont' if MODE=='demo' else 'Mein Hotel',settings=json.dumps({'rest_hours':11,'max_shift_hours':12,'minimum_staff':1,'retention_days':90}));db.add(hotel);db.flush()
    if MODE!='demo' or hotel.seeded:return
    today=date.today();hotel.seeded=1
    for name in ['Rezeption','Housekeeping','Küche','Service','Lager','Haustechnik','Management','Wellness']:add(db,Department,user.tenant,name=name)
    kinds=[add(db,RoomType,user.tenant,name=name,capacity=capacity,nightly_cents=cents) for name,capacity,cents in [('Einzelzimmer',1,8900),('Doppelzimmer',2,12900),('Suite',4,21900)]]
    rooms=[]
    for floor in range(1,4):
        for number in range(1,15):rooms.append(add(db,Room,user.tenant,number=str(floor*100+number),type_id=kinds[0 if len(rooms)<14 else 1 if len(rooms)<36 else 2].id))
    employees={}
    for key,name,department,qualification in [('housekeeping','SYNTHETISCH · Reinigung 1','Housekeeping','cleaning'),('housekeeping_lead','SYNTHETISCH · Hausdame','Housekeeping','inspection'),('maintenance','SYNTHETISCH · Technik','Haustechnik','maintenance'),('kitchen','SYNTHETISCH · Küche','Küche','food'),('reception','SYNTHETISCH · Rezeption','Rezeption','reception'),('service','SYNTHETISCH · Service / Spa','Wellness','spa')]:employees[key]=add(db,Employee,user.tenant,name=name,department=department,qualification=qualification)
    for index in range(8):
        guest=add(db,Guest,user.tenant,name=f'SYNTHETISCH · Gast {index+1:02}',contact=f'gast{index+1}@hotel.example.invalid')
        room=rooms[index];arrival=today-timedelta(days=2) if index<4 else today if index<6 else today+timedelta(days=1);departure=today if index==0 else today+timedelta(days=2 if index<6 else 3)
        reservation=add(db,Reservation,user.tenant,guest_id=guest.id,room_id=room.id,arrival=str(arrival),departure=str(departure),persons=1,breakfast=1,state='checked_in' if index<4 else 'confirmed',nightly_cents=8900)
        if index<4:add(db,Stay,user.tenant,reservation_id=reservation.id)
    task=add(db,HousekeepingTask,user.tenant,room_id=rooms[17].id,employee_id=employees['housekeeping'].id,priority='high');rooms[17].cleaning='dirty'
    rooms[13].blocked='SYNTHETISCH · Dusche undicht';add(db,MaintenanceTicket,user.tenant,room_id=rooms[13].id,title='SYNTHETISCH · Dusche abdichten',blocking=1,priority='urgent',employee_id=employees['maintenance'].id)
    supplier=add(db,Supplier,user.tenant,name='SYNTHETISCH · Hotelbedarf',contact='lieferant@example.invalid')
    items={}
    for name,location,unit,quantity,minimum,cents in [('Handtücher','Wäsche A3','Stück',80,100,450),('Reiniger','Wagen 1','ml',4000,2000,1),('Brot','Küche A1','g',6000,8000,1),('Eier','Küche K2','Stück',60,30,35),('Dichtungen','Technik T1','Stück',8,10,120)]:items[name]=add(db,InventoryItem,user.tenant,name=name,location=location,unit=unit,quantity=quantity,minimum=minimum,unit_cents=cents,batch='SYN-DEMO',expires=str(today+timedelta(days=5)) if name in {'Brot','Eier'} else '')
    add(db,Recipe,user.tenant,name='Synthetisches Standardfrühstück',ingredients=json.dumps([{'item_id':items['Brot'].id,'quantity':80},{'item_id':items['Eier'].id,'quantity':1}]),allergens='Gluten, Ei — ausschließlich synthetische geprüfte Demo-Stammdaten',verified=1)
    add(db,KitchenTask,user.tenant,title='SYNTHETISCH · Frühstück vorbereiten',day=str(today))
    add(db,RestaurantOrder,user.tenant,location='Tisch 2',text='SYNTHETISCH · Zwei Kaffees')
    for employee in employees.values():add(db,Shift,user.tenant,employee_id=employee.id,start=str(today)+'T06:00:00+00:00',end=str(today)+'T14:00:00+00:00')
    add(db,Asset,user.tenant,name='Waschmaschine 2',location='Waschküche',next_service=str(today+timedelta(days=7)))
    add(db,GuestRequest,user.tenant,room_id=rooms[1].id,kind='wish',text='SYNTHETISCH · Zusätzliches Handtuch')
    guest=rows(db,Guest,user.tenant)[0];add(db,HotelInvoice,user.tenant,guest_id=guest.id,amount_cents=17800,due=str(today-timedelta(days=3)))
    notify(db,user.tenant,'reception','SYNTHETISCHE DEMO · Anreise und Abreise prüfen.')
    db.flush()
def own_employee(db,user):return db.scalar(select(Employee).where(Employee.tenant==user.tenant,Employee.user_id==user.id))
def allowed_task(db,user,id):
    require(user,'housekeeping','housekeeping_own');task=get(db,HousekeepingTask,id,user.tenant)
    if 'housekeeping' not in scopes(user):
        employee=own_employee(db,user)
        if not employee or task.employee_id!=employee.id:raise HTTPException(403,'Nur persönlich zugewiesene Reinigungsaufträge sind erlaubt.')
    return task
def occupancy(db,tenant):
    return {r.room_id for r in rows(db,Reservation,tenant) if r.state=='checked_in'}
def room_state(room,occupied):return 'blocked' if room.blocked else 'occupied' if room.id in occupied else room.cleaning
def snapshot(db,user):
    seed(db,user);permissions=scopes(user)
    if not permissions:raise HTTPException(403,'Kein Hotelprofil zugewiesen.')
    hotel=db.get(Hotel,user.tenant);result={'hotel':hotel.name,'fictional':MODE=='demo','mode':MODE,'role':role(user),'permissions':sorted(permissions),'today':str(date.today()),'profileRoles':ROLES,'demoProfileSwitch':bool(db.scalar(select(DemoGrant.token_hash).where(DemoGrant.tenant==user.tenant)))}
    occupied=occupancy(db,user.tenant);rooms=rows(db,Room,user.tenant)
    today=str(date.today())
    booked={r.room_id for r in rows(db,Reservation,user.tenant) if r.state in {'confirmed','checked_in'} and r.arrival<=today<r.departure}
    result['rooms']=[dict(serialize(r),status=room_state(r,occupied),booking_status='occupied' if r.id in occupied else 'reserved_today' if r.id in booked else 'free') for r in rooms] if permissions.intersection({'rooms','management'}) else []
    result['room_types']=[serialize(r) if 'reception' in permissions else {'id':r.id,'name':r.name,'capacity':r.capacity} for r in rows(db,RoomType,user.tenant)]
    tables={}
    if 'reception' in permissions:tables.update(guests=Guest,reservations=Reservation,stays=Stay,requests=GuestRequest)
    if 'reception' in permissions and not permissions.intersection({'housekeeping','housekeeping_own'}):
        result['tasks']=[{key:getattr(t,key) for key in ['id','room_id','state','priority']} for t in rows(db,HousekeepingTask,user.tenant)]
    if permissions.intersection({'housekeeping','housekeeping_own'}):
        tasks=rows(db,HousekeepingTask,user.tenant)
        if 'housekeeping' not in permissions:
            employee=own_employee(db,user);tasks=[t for t in tasks if employee and t.employee_id==employee.id]
        result['tasks']=[serialize(t) for t in tasks];tables['inspections']=RoomInspection
    if 'maintenance' in permissions:tables.update(tickets=MaintenanceTicket,assets=Asset)
    if 'inventory' in permissions:tables.update(inventory=InventoryItem,movements=StockMovement,suppliers=Supplier,purchases=PurchaseRequest)
    if 'kitchen' in permissions:tables.update(kitchen_tasks=KitchenTask,recipes=Recipe,forecasts=BreakfastForecast)
    if 'restaurant' in permissions:tables.update(restaurant_orders=RestaurantOrder,dining=DiningReservation)
    if role(user)=='service':result['guests']=[{'id':g.id,'name':g.name} for g in rows(db,Guest,user.tenant)]
    if 'inventory' in permissions and 'reception' not in permissions:result['requests']=[serialize(r) for r in rows(db,GuestRequest,user.tenant) if r.kind=='material']
    if 'staff' in permissions:tables.update(employees=Employee,shifts=Shift,absences=Absence,departments=Department)
    elif permissions.intersection({'housekeeping','maintenance','wellness'}):
        result['employees']=[{key:getattr(r,key) for key in ['id','name','department','qualification']} for r in rows(db,Employee,user.tenant)]
    if 'wellness' in permissions:tables['spa']=SpaAppointment
    if 'management' in permissions:tables['invoices']=HotelInvoice
    for key,model in tables.items():result[key]=[serialize(row) for row in rows(db,model,user.tenant)]
    if role(user)=='housekeeping':
        task_ids={t['id'] for t in result.get('tasks',[])};result['inspections']=[i for i in result.get('inspections',[]) if i['task_id'] in task_ids]
        room_ids={t['room_id'] for t in result.get('tasks',[])};result['rooms']=[r for r in result['rooms'] if r['id'] in room_ids]
    if role(user)=='wellness':result['guests']=[{'id':g.id,'name':g.name} for g in rows(db,Guest,user.tenant)]
    result['notifications']=[serialize(n) for n in rows(db,Notification,user.tenant) if n.department in permissions or 'management' in permissions or n.department=='housekeeping' and 'housekeeping_own' in permissions]
    if 'management' in permissions or 'reception' in permissions:
        reservations=rows(db,Reservation,user.tenant);invoices=rows(db,HotelInvoice,user.tenant);today=str(date.today())
        result['metrics']={'rooms':len(rooms),'occupied':len(occupied),'available':sum(not r.blocked and r.cleaning=='ready' and r.id not in occupied for r in rooms),'blocked':sum(bool(r.blocked) for r in rooms),'occupancy_percent':round(100*len(occupied)/len(rooms),1) if rooms else 0,'arrivals':sum(r.arrival==today and r.state=='confirmed' for r in reservations),'departures':sum(r.departure==today and r.state=='checked_in' for r in reservations),'open_requests':sum(r.state=='open' for r in rows(db,GuestRequest,user.tenant))}
        result['metrics'].update(free_rooms=sum(not r.blocked and r.id not in booked and r.id not in occupied for r in rooms),cleaning_needed=sum(r.cleaning=='dirty' for r in rooms),cleaning_in_progress=sum(r.cleaning=='in_progress' for r in rooms),cleaning_review=sum(r.cleaning=='review' for r in rooms),ready_rooms=sum(not r.blocked and r.cleaning=='ready' and r.id not in occupied for r in rooms),reservation_requests=sum(r.state=='request' for r in reservations),active_reservations=sum(r.state in {'request','confirmed','checked_in'} and r.departure>=today for r in reservations),open_tasks=sum(t.state!='released' for t in rows(db,HousekeepingTask,user.tenant)),open_notifications=sum(n['state']=='open' for n in result['notifications']))
        if 'management' in permissions:result['metrics'].update(open_tickets=sum(t.state!='resolved' for t in rows(db,MaintenanceTicket,user.tenant)),pending_cleaning=sum(t.state not in {'released'} for t in rows(db,HousekeepingTask,user.tenant)),paid_cents=sum(i.amount_cents for i in invoices if i.state=='paid'),outstanding_cents=sum(i.amount_cents for i in invoices if i.state=='open'),overdue_invoices=sum(i.state=='open' and i.due<today for i in invoices))
    return result
def context(db,user,question=''):
    import re
    value=snapshot(db,user);result={k:value[k] for k in ['hotel','role','today','metrics'] if k in value}
    result['data_as_of']=now();result['source']='Berechtigte Hotel-Fachdatenbank /api/hotel/context'
    guests={g['id']:g for g in value.get('guests',[])}
    def reservation_view(row):
        guest=guests.get(row['guest_id'])
        return {**row,**({'guest_name':guest['name'],'guest_contact':guest.get('contact','')} if guest else {})}
    rooms=value.get('rooms',[])
    # Match actual authorized identifiers, not a hard-coded demo floor range.
    # Explicit unknown numeric/alphanumeric identifiers still narrow to no rows.
    known=[r['number'] for r in rooms if re.search(r'(?<![\w-])'+re.escape(r['number'])+r'(?![\w-])',question,re.IGNORECASE)]
    explicit=re.findall(r'\b(?:zimmer|room)\s*(?:nr\.?\s*)?([\w-]*\d[\w-]*)\b',question,re.IGNORECASE)
    requested={identifier.casefold() for identifier in known+explicit}
    selected=[r for r in rooms if not requested or r['number'].casefold() in requested]
    status_labels={'ready':'freigegeben','occupied':'belegt','dirty':'Reinigung offen','in_progress':'Reinigung läuft','review':'Kontrolle erforderlich','blocked':'gesperrt'}
    result['rooms']=[{'number':r['number'],'status':r['status'],'status_de':status_labels.get(r['status'],r['status']),'blocked':r['blocked']} for r in selected]
    if requested:
        # A room-specific question must not receive unrelated reservations or tickets.
        room_ids={r['id'] for r in selected}
        result.pop('metrics',None)
        for key in ['tasks','tickets','reservations','requests']:
            if key in value:result[key]=[r for r in value[key] if r.get('room_id') in room_ids][:5]
        if 'reservations' in result:result['reservations']=[reservation_view(r) for r in result['reservations']]
        result['scope_note']='Nur diese angefragten und berechtigten Zimmer. status_de ist der aktuelle Zimmerstatus. Nicht sichtbare Zimmer sind unbekannt.'
        return result
    for key in ['tasks','tickets','inventory','reservations','requests','invoices']:
        if key in value:
            entries=value[key]
            if key=='inventory':entries=[r for r in entries if r['quantity']<r['minimum']]
            if key=='reservations':entries=[reservation_view(r) for r in sorted(entries,key=lambda r:(r['state'] not in {'request','confirmed','checked_in'},r['departure']<value['today'],r['arrival']))]
            result[key]=entries[:5]
    result['scope_note']='Kennzahlen sind aus den berechtigten Datensätzen berechnet; Listen enthalten höchstens fünf Beispiele je Bereich. Fehlende oder ausgelassene Einträge sind unbekannt.'
    if 'kitchen' in scopes(user):result['breakfast_tomorrow']=forecast(db,user,str(date.today()+timedelta(days=1)))
    return result
def conflict(db,user,room_id,arrival,departure,exclude=''):
    existing=db.scalar(select(Reservation).where(Reservation.tenant==user.tenant,Reservation.room_id==room_id,Reservation.id!=exclude,Reservation.state.in_(['confirmed','checked_in']),Reservation.arrival<departure,Reservation.departure>arrival))
    if existing:raise HTTPException(409,'Das Zimmer ist in diesem Zeitraum bereits gebucht.')

def stay_dates(arrival,departure):
    try:a=date.fromisoformat(arrival);b=date.fromisoformat(departure)
    except ValueError:raise HTTPException(400,'Anreise und Abreise als Datum erforderlich.')
    if b<=a or (b-a).days>365:raise HTTPException(400,'Abreise muss nach Anreise liegen; höchstens 365 Nächte.')
    return a,b

def available_room_snapshot(db,user,arrival,departure,persons):
    require(user,'reception');a,b=stay_dates(arrival,departure)
    if not 1<=persons<=8:raise HTTPException(400,'Personenzahl muss zwischen 1 und 8 liegen.')
    kinds={r.id:r for r in rows(db,RoomType,user.tenant)}
    booked=set(db.scalars(select(Reservation.room_id).where(Reservation.tenant==user.tenant,Reservation.state.in_(['confirmed','checked_in']),Reservation.arrival<str(b),Reservation.departure>str(a))))
    occupied=occupancy(db,user.tenant)
    return {'arrival':str(a),'departure':str(b),'departure_exclusive':True,'persons':persons,'checked_at':now(),'rooms':[dict(id=r.id,number=r.number,type_id=r.type_id,room_type=kinds[r.type_id].name,nightly_cents=kinds[r.type_id].nightly_cents,capacity=kinds[r.type_id].capacity,cleaning=r.cleaning,ready_for_checkin=r.cleaning=='ready' and r.id not in occupied) for r in rows(db,Room,user.tenant) if not r.blocked and r.id not in booked and kinds[r.type_id].capacity>=persons]}
def reserve(db,user,values):
    require(user,'reception');room=get(db,Room,values['room_id'],user.tenant);guest=get(db,Guest,values['guest_id'],user.tenant);kind=get(db,RoomType,room.type_id,user.tenant)
    arrival,departure=stay_dates(values['arrival'],values['departure'])
    if not 1<=values['persons']<=kind.capacity:raise HTTPException(400,'Personenzahl überschreitet die Zimmerkapazität.')
    if room.blocked:raise HTTPException(409,'Gesperrtes Zimmer kann nicht reserviert werden.')
    if values['state']=='confirmed':conflict(db,user,room.id,str(arrival),str(departure))
    return add(db,Reservation,user.tenant,guest_id=guest.id,room_id=room.id,arrival=str(arrival),departure=str(departure),persons=values['persons'],breakfast=int(values.get('breakfast',True)),state=values['state'],nightly_cents=kind.nightly_cents)
def forecast(db,user,day):
    require(user,'kitchen','management');date.fromisoformat(day)
    count=sum(r.persons for r in rows(db,Reservation,user.tenant) if r.breakfast and r.arrival<day<=r.departure and r.state in {'confirmed','checked_in'})
    recipes=rows(db,Recipe,user.tenant);requirements=[]
    if recipes:
        recipe=recipes[0]
        for ingredient in json.loads(recipe.ingredients):
            item=get(db,InventoryItem,ingredient['item_id'],user.tenant);requirements.append({'item':item.name,'quantity':ingredient['quantity']*count,'unit':item.unit,'available':item.quantity})
        allergens=recipe.allergens if recipe.verified else 'Keine geprüften Allergenstammdaten vorhanden.'
    else:allergens='Keine geprüften Allergenstammdaten vorhanden.'
    return {'day':day,'guests':count,'requirements':requirements,'allergens':allergens,'method':'Gebuchte Personen mit Frühstück, Anreise < Frühstückstag <= Abreise; Mengen pro Person aus Rezeptstammdaten.'}
def interval(start,end):
    try:a=datetime.fromisoformat(start);b=datetime.fromisoformat(end)
    except ValueError:raise HTTPException(400,'Ungültiger Zeitraum.')
    if not a.tzinfo or not b.tzinfo or b<=a:raise HTTPException(400,'Start und Ende mit Zeitzone erforderlich; Ende nach Start.')
    return a.astimezone(timezone.utc),b.astimezone(timezone.utc)
def check_revision(row,revision):
    if revision!=row.revision:raise HTTPException(409,'Der Datensatz wurde inzwischen geändert. Bitte neu laden.')
    row.revision+=1
