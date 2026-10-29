"""Empty real-use hotel mode, synthetic fixture identities only."""
import os,sys,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-hotel-program-test-')
os.environ['WERKZ_AI_PACKAGE']='hotel';os.environ['WERKZ_AI_MODE']='production'
from fastapi.testclient import TestClient
from backend.app import app
client=TestClient(app,headers={'origin':'http://testserver'})
assert client.get('/api/operator/domains').status_code==401
assert client.post('/api/setup',json={'username':'synthetic_owner','password':'synthetic-only-test'}).status_code==201
assert client.post('/api/login',json={'username':'synthetic_owner','password':'synthetic-only-test'}).status_code==200
initial=client.get('/api/hotel/snapshot').json()
assert initial['mode']=='production' and initial['fictional'] is False
assert initial['metrics']['rooms']==0 and not initial['guests'] and not initial['reservations']
assert client.post('/api/hotel/demo/start',json={'role':'management'}).status_code==403
assert client.post('/api/hotel/demo/reset',json={}).status_code==403
assert client.get('/api/modules').json()['modules']['voice_ai'] is False
category=client.post('/api/hotel/room-types',json={'name':'SYNTHETIC CATEGORY','capacity':2,'nightly_cents':10000})
assert category.status_code==201,category.text
assert client.post('/api/hotel/room-types',json={'name':'SYNTHETIC CATEGORY','capacity':2,'nightly_cents':10000}).status_code==409
room=client.post('/api/hotel/rooms',json={'number':'SYN-101','type_id':category.json()['id']})
assert room.status_code==201,room.text
assert client.post('/api/hotel/rooms',json={'number':'SYN-101','type_id':category.json()['id']}).status_code==409
assert client.post('/api/hotel/rooms',json={'number':'SYN-102','type_id':'foreign-type'}).status_code==404
assert client.post('/api/chats',json={'workspace':'hotel'}).status_code==201
context=client.get('/api/hotel/context?q=Zimmer').json()
assert context['data']['metrics']['rooms']==1
assert client.get('/api/hotel/snapshot').json()['guests']==[]
for number in ['401-A','B7']:
    assert client.post('/api/hotel/rooms',json={'number':number,'type_id':category.json()['id']}).status_code==201
specific=client.get('/api/hotel/context',params={'q':'Wie ist Zimmer SYN-101?'}).json()['data']
assert [r['number'] for r in specific['rooms']]==['SYN-101'],specific
mixed=client.get('/api/hotel/context',params={'q':'Vergleiche Zimmer 401-A und b7.'}).json()['data']
assert {r['number'] for r in mixed['rooms']}=={'401-A','B7'} and 'metrics' not in mixed,mixed
unknown=client.get('/api/hotel/context',params={'q':'Wie ist Zimmer 999?'}).json()['data']
assert unknown['rooms']==[] and 'metrics' not in unknown,unknown
domains=client.get('/api/operator/domains');assert domains.status_code==200,domains.text
assert domains.json()['plugin_mcp_connections_verified'] is False
assert next(d for d in domains.json()['domains'] if d['id']=='deutschz')['state']=='NOT_CONNECTED'
assert client.post('/api/operator/knowledge/search',json={'query':'Hotel','project':'deutschz'}).status_code==422
roles=client.get('/api/admin/roles').json()
assert 'hotel_reception' in roles and 'hotel_housekeeping' in roles and 'admin' not in roles
assert client.post('/api/admin/users',json={'username':'synthetic_escalation','password':'synthetic-only-test','role':'admin'}).status_code==403
assert client.post('/api/admin/users',json={'username':'synthetic_escalation','password':'synthetic-only-test','role':'handwerk_administrator'}).status_code==403
assert client.post('/api/admin/users',json={'username':'synthetic_cross_tenant','password':'synthetic-only-test','role':'hotel_reception','tenant':'foreign'}).status_code==422
for role in ['hotel_reception','hotel_housekeeping']:
    username='synthetic_'+role
    assert client.post('/api/admin/users',json={'username':username,'password':'synthetic-only-test','role':role}).status_code==201
    other=TestClient(app,headers={'origin':'http://testserver'})
    assert other.post('/api/login',json={'username':username,'password':'synthetic-only-test'}).status_code==200
    assert other.get('/api/admin/roles').status_code==403
    assert other.get('/api/operator/domains').status_code==403
    assert other.post('/api/operator/knowledge/search',json={'query':'Hotel'}).status_code==403
    assert other.post('/api/admin/users',json={'username':'nested_escalation','password':'synthetic-only-test','role':'hotel_administrator'}).status_code==403
    snapshot=other.get('/api/hotel/snapshot');assert snapshot.status_code==200,snapshot.text
    assert other.post('/api/hotel/rooms',json={'number':'SYN-103','type_id':category.json()['id']}).status_code==403
    if role=='hotel_housekeeping':assert 'guests' not in snapshot.json() and 'invoices' not in snapshot.json()
print('PROGRAM: empty store, owner login, no demo endpoints, own rooms and hotel AI context PASS')

target=next(u for u in client.get('/api/admin/users').json() if u['username']=='synthetic_hotel_reception')
reception=TestClient(app,headers={'origin':'http://testserver'})
assert reception.post('/api/login',json={'username':target['username'],'password':'synthetic-only-test'}).status_code==200
assert reception.get('/api/hotel/context?q=Zimmer').status_code==200
change={'role':'reader','expected_role':'hotel_reception'}
assert client.patch('/api/admin/users/'+target['id']+'/role',json=change).status_code==200
assert reception.get('/api/hotel/context?q=Zimmer').status_code==403
assert reception.patch('/api/admin/users/'+target['id']+'/role',json={'role':'hotel_reception','expected_role':'reader'}).status_code==403
assert client.patch('/api/admin/users/'+target['id']+'/role',json=change).status_code==409
assert client.patch('/api/admin/users/foreign-id/role',json=change).status_code==404
from backend.db import Session,User
from backend.security import hash_password
with Session() as db:
    db.add(User(id='synthetic-foreign-user',username='synthetic_foreign',password_hash=hash_password('synthetic-only-test'),role='hotel_reception',tenant='synthetic-foreign-tenant'));db.commit()
assert client.patch('/api/admin/users/synthetic-foreign-user/role',json=change).status_code==404
assert all(u['id']!='synthetic-foreign-user' for u in client.get('/api/admin/users').json())
owner=client.get('/api/me').json()
assert client.patch('/api/admin/users/'+owner['id']+'/role',json={'role':'reader','expected_role':'admin'}).status_code==403
assert client.patch('/api/admin/users/'+target['id']+'/role',json={'role':'admin','expected_role':'reader'}).status_code==403
assert client.patch('/api/admin/users/'+target['id']+'/role',headers={'x-werkz-tenant':'foreign'},json={'role':'hotel_reception','expected_role':'reader'}).status_code==409
assert any(row['target']==target['id'] and row['actor']==owner['id'] and row['event'].startswith('core.user.role.changed') for row in client.get('/api/admin/audit').json())
print('MASTER CONTROL: live role withdrawal, CAS conflict, foreign headers, self-escalation denial and audit PASS')

from backend import engine
assert client.patch('/api/admin/users/'+target['id']+'/role',json={'role':'hotel_reception','expected_role':'reader'}).status_code==200
chat=reception.post('/api/chats',json={'workspace':'hotel'}).json()['id']
async def models():return [{'id':'synthetic-model'}]
async def context_window():return 4096
async def count(messages):return sum(len(m['content']) for m in messages)//3+20
async def tokens(*args):
    yield 'BEFORE_ROLE_WITHDRAWAL'
    response=client.patch('/api/admin/users/'+target['id']+'/role',json={'role':'reader','expected_role':'hotel_reception'})
    assert response.status_code==200,response.text
    yield 'FORBIDDEN_AFTER_ROLE_WITHDRAWAL'
engine.models=models;engine.context_window=context_window;engine.count_tokens=count;engine.tokens=tokens
response=reception.post('/api/chats/'+chat+'/stream',json={'content':'Zimmerstatus','include_hotel':True})
assert response.status_code==200,response.text
assert 'BEFORE_ROLE_WITHDRAWAL' in response.text and 'FORBIDDEN_AFTER_ROLE_WITHDRAWAL' not in response.text and 'ACCESS_CHANGED' in response.text
print('MASTER CONTROL: actual role PATCH during active Hotel AI stream blocks subsequent chunk PASS')
