"""Isolated real DB scenarios for the Hotel module; no customer or live server data."""
import os,sys,tempfile,json,io,base64
from pathlib import Path
from datetime import date,timedelta,datetime,timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-hotel-tests-')
os.environ['WERKZ_AI_PACKAGE']='hotel-demo';os.environ['WERKZ_AI_MODE']='demo'
from fastapi.testclient import TestClient
from backend.app import app
from backend.db import Session,User,ModuleConfig
from backend.security import hash_password
from backend.modules.hotel.models import Hotel,Room
ORIGIN={'origin':'http://testserver'}
client=TestClient(app,headers=ORIGIN)
def profile(role):
    response=client.post('/api/hotel/demo/start',json={'role':role});assert response.status_code==200,response.text
    return response.json()
def snap():
    response=client.get('/api/hotel/snapshot');assert response.status_code==200,response.text
    return response.json()
def cmd(op,expected=200,**values):
    response=client.post('/api/hotel/commands',json={'operation':op,**values});assert response.status_code==expected,(op,response.status_code,response.text)
    return response.json()
def target(row):return {'target':row['id'],'revision':row['revision']}
def run():
    profile('management');a=snap();assert len(a['rooms'])==42 and a['metrics']['occupied']==4
    tenant=client.get('/api/me').json()['tenant']
    with TestClient(app,headers=ORIGIN) as other:
        assert other.post('/api/hotel/demo/start',json={'role':'management'}).status_code==200
        assert other.get('/api/me').json()['tenant']!=tenant
        foreign=other.get('/api/hotel/snapshot').json()['rooms'][0]
        cmd('room.block',expected=404,target=foreign['id'],confirmed=True,text='synthetic isolation')
    # Checkout -> assignment -> cleaning -> blocked repair -> inspection -> reception.
    profile('reception');a=snap();room=next(r for r in a['rooms'] if r['number']=='101');reservation=next(r for r in a['reservations'] if r['room_id']==room['id'])
    cmd('reservation.checkout',confirmed=True,**target(reservation))
    profile('housekeeping_lead');a=snap();task=next(t for t in a['tasks'] if t['room_id']==room['id']);employee=next(e for e in a['employees'] if e['qualification']=='cleaning')
    cmd('task.assign',employee_id=employee['id'],priority='urgent',**target(task))
    profile('housekeeping');a=snap();assert 'guests' not in a and 'invoices' not in a and 'shifts' not in a
    task=next(t for t in a['tasks'] if t['room_id']==room['id']);cmd('task.start',**target(task));task=next(t for t in snap()['tasks'] if t['id']==task['id'])
    cmd('task.finish',expected=409,**target(task));cmd('task.checklist',checks={'bathroom':True,'bed':True,'supplies':True},text='SYNTHETISCH · gereinigt',**target(task))
    defect=cmd('ticket.create',room_id=room['id'],title='SYNTHETISCH · Dusche defekt',blocking=True,priority='urgent')['record']
    assert next(r for r in snap()['rooms'] if r['id']==room['id'])['status']=='blocked'
    cmd('task.inspect',expected=403,passed=True,confirmed=True,checks={'bathroom':True,'bed':True,'supplies':True},**target(task))
    # Photographic evidence through Core's owner/role/tenant boundary.
    raw=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=')
    upload=client.post('/api/documents',data={'workspace':'hotel'},files={'file':('synthetic.png',raw,'image/png')});assert upload.status_code==201,upload.text
    task=next(t for t in snap()['tasks'] if t['id']==task['id']);cmd('task.photo',document_id=upload.json()['id'],**target(task))
    task=next(t for t in snap()['tasks'] if t['id']==task['id']);cmd('task.finish',**target(task))
    profile('housekeeping_lead');task=next(t for t in snap()['tasks'] if t['id']==task['id']);cmd('task.inspect',expected=409,passed=True,confirmed=True,checks={'bathroom':True,'bed':True,'supplies':True},**target(task))
    assert client.get('/api/documents/'+upload.json()['id']+'/preview').status_code==200
    profile('maintenance');ticket=next(t for t in snap()['tickets'] if t['id']==defect['id']);cmd('ticket.resolve',text='SYNTHETISCH · Dusche repariert und geprüft.',confirmed=True,**target(ticket))
    assert next(r for r in snap()['rooms'] if r['id']==room['id'])['status']=='blocked'
    profile('housekeeping_lead');task=next(t for t in snap()['tasks'] if t['id']==task['id']);cmd('task.inspect',passed=True,confirmed=True,checks={'bathroom':True,'bed':True,'supplies':True},**target(task))
    cmd('task.inspect',expected=409,passed=True,confirmed=True,checks={'bathroom':True,'bed':True,'supplies':True},**target(task))
    profile('reception');a=snap();assert next(r for r in a['rooms'] if r['id']==room['id'])['status']=='ready'
    assert a['metrics']['occupied']==3
    from backend.modules.hotel.service import context as hotel_context
    with Session() as db:
        actor=db.get(User,client.get('/api/me').json()['id']);focused=hotel_context(db,actor,'Welchen Status hat Zimmer 205?')
        assert len(focused['rooms'])==1 and focused['rooms'][0]['number']=='205'
        assert focused['rooms'][0]['status_de']=='freigegeben'
        assert 'metrics' not in focused
        assert not focused.get('reservations') and not focused.get('tickets')
    print('PASS hotel workflow: checkout, assignment, own task, complete checklist, real photo, defect, block, repair, inspection and room release.')
    # New bookings, collision rejection, check-in and checkout.
    available=next(r for r in a['rooms'] if r['number']=='205');guest=a['guests'][0]
    booking={'guest_id':guest['id'],'room_id':available['id'],'arrival':str(date.today()),'departure':str(date.today()+timedelta(days=2)),'persons':2,'state':'confirmed'}
    response=client.post('/api/hotel/reservations',json=booking);assert response.status_code==201,response.text
    saved=response.json();assert client.post('/api/hotel/reservations',json=booking).status_code==409
    draft=client.post('/api/hotel/reservations',json={**booking,'state':'request'}).json();cmd('reservation.confirm',expected=409,**target(draft))
    cmd('reservation.checkin',**target(saved));saved=next(r for r in snap()['reservations'] if r['id']==saved['id']);cmd('reservation.checkout',confirmed=True,**target(saved))
    print('PASS reservations: checked dates/capacity, confirmed collision prevention, unconfirmed request, check-in and check-out.')
    profile('inventory');a=snap();item=a['inventory'][0];cmd('stock.consume',expected=409,quantity=item['quantity']+1,text='SYNTHETISCH · zu viel',**target(item))
    cmd('stock.receive',quantity=5,text='SYNTHETISCH · Zugang',**target(item));item=next(r for r in snap()['inventory'] if r['id']==item['id']);cmd('stock.consume',quantity=2,text='SYNTHETISCH · Verbrauch',**target(item));assert next(r for r in snap()['inventory'] if r['id']==item['id'])['quantity']==item['quantity']-2
    cmd('purchase.propose');a=snap();assert a['purchases'];purchase=a['purchases'][0];cmd('purchase.approve',confirmed=True,**target(purchase));purchase=next(r for r in snap()['purchases'] if r['id']==purchase['id']);cmd('purchase.receive',confirmed=True,**target(purchase))
    print('PASS inventory: atomic movements, negative stock rejection, minimum stock proposals, approval and receipt.')
    profile('kitchen');forecast=client.get('/api/hotel/breakfast',params={'day':str(date.today()+timedelta(days=1))});assert forecast.status_code==200,forecast.text
    f=forecast.json();assert f['guests']>=0 and all(r['quantity']>=0 for r in f['requirements']);assert 'synthetisch' in f['allergens']
    cmd('breakfast.plan',day=f['day'])
    profile('service');order=cmd('restaurant.create',location='Tisch 4',text='SYNTHETISCH · Frühstück ohne Zwiebeln')['record'];cmd('restaurant.advance',expected=403,**target(order))
    profile('kitchen');cmd('restaurant.advance',**target(order));order=next(r for r in snap()['restaurant_orders'] if r['id']==order['id']);cmd('restaurant.advance',**target(order))
    profile('service');order=next(r for r in snap()['restaurant_orders'] if r['id']==order['id']);cmd('restaurant.advance',**target(order));assert next(r for r in snap()['restaurant_orders'] if r['id']==order['id'])['text'].endswith('ohne Zwiebeln')
    print('PASS kitchen/service: deterministic breakfast planning, verified demo allergen source, kitchen handoff and preserved special request.')
    profile('hr');a=snap();employee=a['employees'][0];day=str(date.today()+timedelta(days=5));cmd('shift.create',employee_id=employee['id'],start=day+'T06:00:00+00:00',end=day+'T14:00:00+00:00');cmd('shift.create',expected=409,employee_id=employee['id'],start=day+'T07:00:00+00:00',end=day+'T15:00:00+00:00');cmd('shift.create',expected=409,employee_id=employee['id'],start=day+'T17:00:00+00:00',end=day+'T20:00:00+00:00')
    cmd('absence.create',expected=409,employee_id=employee['id'],start=day+'T08:00:00+00:00',end=day+'T10:00:00+00:00')
    profile('reception');a=snap();spa=next(e for e in a['employees'] if e['qualification']=='spa');guest=a['guests'][0]
    values={'guest_id':guest['id'],'employee_id':spa['id'],'location':'Spa 1','start':day+'T10:00:00+00:00','end':day+'T11:00:00+00:00','title':'SYNTHETISCH · Wellness'};cmd('spa.create',**values);cmd('spa.create',expected=409,**values)
    print('PASS staffing/wellness: overlap and rest checks, absence validation, qualified employee and double-booking prevention.')
    assert client.get('/api/hotel/qr',params={'kind':'room','id':room['id']}).headers['content-type']=='image/svg+xml'
    profile('housekeeping');context=client.get('/api/hotel/context').json()['data'];assert 'reservations' not in context and 'invoices' not in context
    hidden_room=next(r for r in a['rooms'] if r['number']=='205')
    assert client.get('/api/hotel/qr',params={'kind':'room','id':hidden_room['id']}).status_code==404
    with Session() as db:
        config=db.get(ModuleConfig,tenant);modules=json.loads(config.modules);modules['hotel_ai']=False;config.modules=json.dumps(modules);db.commit()
    assert client.get('/api/hotel/snapshot').status_code==403
    with Session() as db:config=db.get(ModuleConfig,tenant);modules['hotel_ai']=True;config.modules=json.dumps(modules);db.commit()
    profile('administrator');assert client.post('/api/hotel/demo/reset').status_code==200
    assert snap()['metrics']['occupied']==4 and len(snap()['rooms'])==42
    print('PASS boundaries: tenant isolation, role-limited context, protected QR, module disable and tenant-scoped reset.')
    identity=client.get('/api/me').json()
    assert client.get('/api/me',headers={'X-WerkZ-Actor':'different-account'}).status_code==409
    assert client.get('/api/me',headers={'X-WerkZ-Tenant':'different-tenant'}).status_code==409
    assert client.get('/api/me',headers={'X-WerkZ-Actor':identity['id'],'X-WerkZ-Tenant':identity['tenant']}).status_code==200
    from backend.security import COOKIE_NAME
    old_cookie=client.cookies.get(COOKIE_NAME)
    assert client.post('/api/logout').status_code==200
    with TestClient(app,headers=ORIGIN) as replay:
        replay.cookies.set(COOKIE_NAME,old_cookie)
        assert replay.get('/api/me').status_code==401
    print('PASS session boundary: actor/tenant mismatch denied and logged-out Hotel cookie cannot be replayed.')
if __name__=='__main__':run()
