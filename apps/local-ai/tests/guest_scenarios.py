"""Guest portal negative cases and full synthetic service request path."""
from hotel_scenarios import client,profile,snap,cmd,target,app,ORIGIN
from fastapi.testclient import TestClient

profile('reception');snapshot=snap();stay=next(s for s in snapshot['reservations'] if s['state']=='checked_in')
guest_id=stay['guest_id'];prefix='/api/hotel/guests/'+guest_id
preference={'category':'language','value':'en','scope':'permanent','stay_id':stay['id']}
assert client.post(prefix+'/preferences',json=preference).status_code==400
preference['consent']='SYNTHETISCH freiwillig bestätigt'
r=client.post(prefix+'/preferences',json=preference);assert r.status_code==201,r.text
assert client.delete('/api/hotel/preferences/'+r.json()['id']).status_code==200
r=client.post(prefix+'/notes',json={'stay_id':stay['id'],'text':'SYNTHETISCH: Rückruf am Nachmittag','category':'service'});assert r.status_code==201
assert client.get(prefix+'/card').json()['personalizationUsesRawNotes'] is False
assert client.delete('/api/hotel/notes/'+r.json()['id']).status_code==200
access=client.post('/api/hotel/reservations/'+stay['id']+'/portal-code',json={'confirmed':True}).json()
guest=TestClient(app,headers=ORIGIN)
assert guest.get('/api/guest/overview').status_code==401
assert guest.post('/api/guest/login',json={'room':access['room'],'code':'invalid-synthetic-code'}).status_code==401
assert guest.post('/api/guest/login',json={'room':'999','code':access['code']}).status_code==401
assert guest.post('/api/guest/login',json={'room':access['room'],'code':access['code']}).status_code==200
assert guest.get('/api/hotel/snapshot').status_code==401
menu=guest.get('/api/guest/overview').json()['menu'];item=next(m for m in menu if m['category']=='food')
body={'item_id':item['id'],'unit_price_cents':item['price_cents']+1,'quantity':2,'special':'SYNTHETISCH ohne Ei','allergy':True,'confirmed':True,'idempotency_key':'synthetic-order-1'}
assert guest.post('/api/guest/orders',json=body).status_code==409
body['unit_price_cents']=item['price_cents'];r=guest.post('/api/guest/orders',json=body);assert r.status_code==201,r.text;order=r.json()
assert guest.post('/api/guest/orders',json=body).json()['id']==order['id']
assert len(guest.get('/api/guest/overview').json()['orders'])==1
assert guest.post('/api/guest/orders',json={**body,'quantity':3}).status_code==409
profile('housekeeping');assert client.get('/api/hotel/guest-orders').json()==[]
assert client.post('/api/hotel/guest-orders/'+order['id'],json={'revision':0,'state':'accepted','allergy_ack':True}).status_code==403
profile('kitchen');assert client.post('/api/hotel/guest-orders/'+order['id'],json={'revision':0,'state':'accepted'}).status_code==409
for state in ['accepted','preparing','en_route','delivered']:
    r=client.post('/api/hotel/guest-orders/'+order['id'],json={'revision':order['revision'],'state':state,'allergy_ack':True});assert r.status_code==200,r.text;order=r.json()
assert guest.get('/api/guest/overview').json()['orders'][0]['state']=='delivered'
assert order['special']==body['special'] and order['price_cents']==2*item['price_cents']
profile('reception');stay=next(s for s in snap()['reservations'] if s['id']==stay['id']);cmd('reservation.checkout',confirmed=True,**target(stay))
assert guest.get('/api/guest/overview').status_code==401
assert guest.post('/api/guest/login',json={'room':access['room'],'code':access['code']}).status_code==401
print('PASS guest portal: consent/delete, room+code authentication, staff separation, price validation, duplicate prevention, departmental access, allergy acknowledgement, delivery and checkout revocation.')
