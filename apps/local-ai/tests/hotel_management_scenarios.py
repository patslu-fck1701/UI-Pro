"""Independent synthetic database for the Hotel management increment."""
import os,sys,tempfile,concurrent.futures
from datetime import date,timedelta
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
temporary=tempfile.TemporaryDirectory(prefix='werkz-hotel-management-')
os.environ.update(WERKZ_AI_DATA=temporary.name,WERKZ_AI_PACKAGE='hotel-demo',WERKZ_AI_MODE='demo')
from fastapi.testclient import TestClient
from backend.app import app
from backend.db import engine
import atexit
atexit.register(engine.dispose)

ORIGIN={'origin':'http://testserver'}
with TestClient(app,headers=ORIGIN) as client:
    def profile(role):
        r=client.post('/api/hotel/demo/start',json={'role':role});assert r.status_code==200,r.text
    def snapshot():
        r=client.get('/api/hotel/snapshot');assert r.status_code==200,r.text;return r.json()
    def available(a,b,persons=1):return client.get('/api/hotel/availability',params={'arrival':a,'departure':b,'persons':persons})
    profile('management');initial=snapshot();today=date.today();a=str(today+timedelta(days=40));b=str(today+timedelta(days=42))
    choices=available(a,b);assert choices.status_code==200;choices=choices.json();assert choices['departure_exclusive'] is True
    blocked={r['id'] for r in initial['rooms'] if r['blocked']};assert not blocked.intersection(r['id'] for r in choices['rooms'])
    assert available(a,a).status_code==400 and available('invalid',b).status_code==400 and available(a,b,9).status_code==400
    room=choices['rooms'][0]
    payload={'guest_name':'SYNTHETISCH · Neuer Hotelgast','guest_contact':'0000-TEST','room_id':room['id'],'arrival':a,'departure':b,'persons':1,'breakfast':True,'state':'confirmed'}
    response=client.post('/api/hotel/reservations',json=payload);assert response.status_code==201,response.text;reservation=response.json()
    saved=snapshot();guest=next(g for g in saved['guests'] if g['id']==reservation['guest_id']);assert guest['name']==payload['guest_name']
    assert not any(r['id']==room['id'] for r in available(a,b).json()['rooms'])
    before=len(saved['guests']);assert client.post('/api/hotel/reservations',json={**payload,'guest_name':'SYNTHETISCH · Darf nicht übrig bleiben'}).status_code==409
    assert len(snapshot()['guests'])==before,'Failed booking must not leave an orphan guest'
    assert any(r['id']==room['id'] for r in available(b,str(today+timedelta(days=43))).json()['rooms']),'Departure is exclusive'
    r=client.patch('/api/hotel/guests/'+guest['id'],json={'name':'SYNTHETISCH · Gast korrigiert','contact':'0000-NEU','notes':'Synthetische Notiz','revision':guest['revision']});assert r.status_code==200,r.text
    assert client.patch('/api/hotel/guests/'+guest['id'],json={'name':'Veraltet','revision':guest['revision']}).status_code==409
    assert next(g for g in snapshot()['guests'] if g['id']==guest['id'])['name']=='SYNTHETISCH · Gast korrigiert'
    second=next(r for r in choices['rooms'] if r['id']!=room['id'])
    race={**payload,'guest_name':'','guest_id':guest['id'],'room_id':second['id']}
    def book(_):
        with TestClient(app,headers=ORIGIN,cookies=client.cookies) as other:return other.post('/api/hotel/reservations',json=race).status_code
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:assert sorted(pool.map(book,range(2)))==[201,409]
    edit={key:payload[key] for key in ['room_id','arrival','departure','persons','breakfast']};edit['revision']=reservation['revision']
    assert client.patch('/api/hotel/reservations/'+reservation['id'],json={**edit,'room_id':second['id']}).status_code==409
    updated=client.patch('/api/hotel/reservations/'+reservation['id'],json={**edit,'breakfast':False});assert updated.status_code==200,updated.text
    assert client.patch('/api/hotel/reservations/'+reservation['id'],json=edit).status_code==409
    cancel='/api/hotel/reservations/'+reservation['id']+'/cancel'
    assert client.post(cancel,json={'revision':updated.json()['revision']}).status_code==400
    cancelled=client.post(cancel,json={'revision':updated.json()['revision'],'confirmed':True});assert cancelled.status_code==200,cancelled.text
    assert cancelled.json()['state']=='cancelled'
    assert any(r['id']==room['id'] for r in available(a,b).json()['rooms'])
    assert client.patch('/api/hotel/reservations/'+reservation['id'],json={**edit,'revision':cancelled.json()['revision']}).status_code==409
    saved=snapshot();metrics=saved['metrics'];rooms=saved['rooms']
    assert metrics['rooms']==len(rooms)==42
    assert metrics['cleaning_needed']==sum(r['cleaning']=='dirty' for r in rooms)
    assert metrics['ready_rooms']==sum(not r['blocked'] and r['cleaning']=='ready' and r['booking_status']!='occupied' for r in rooms)
    assert metrics['free_rooms']==sum(not r['blocked'] and r['booking_status']=='free' for r in rooms)
    assert metrics['active_reservations']==sum(r['state'] in {'request','confirmed','checked_in'} and r['departure']>=str(today) for r in saved['reservations'])
    assert metrics['open_tasks']==sum(t['state']!='released' for t in saved['tasks'])
    with TestClient(app,headers=ORIGIN) as foreign:
        assert foreign.post('/api/hotel/demo/start',json={'role':'management'}).status_code==200
        assert foreign.patch('/api/hotel/guests/'+guest['id'],json={'name':'Foreign forbidden','revision':1}).status_code==404
        assert foreign.post('/api/hotel/reservations',json={**race,'room_id':room['id']}).status_code==404
    profile('housekeeping');assert available(a,b).status_code==403
    assert client.patch('/api/hotel/guests/'+guest['id'],json={'name':'Forbidden','revision':1}).status_code==403
    assert client.post('/api/hotel/reservations',json=payload).status_code==403
    assert 'guests' not in snapshot()
    profile('reception');reception=snapshot();assert reception['metrics']['open_tasks']==len([t for t in reception['tasks'] if t['state']!='released'])
    assert all(set(t)=={'id','room_id','state','priority'} for t in reception['tasks'])
    print('PASS hotel management: inline guest, atomic rollback, guest update/revision, dates, exclusive departure, blocked rooms, concurrent booking, live dashboard counts, role/tenant limits.')
engine.dispose();temporary.cleanup()
