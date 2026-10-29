"""Real HTTP/SQLite/session tests with two synthetic tenants; no model or network."""
import os,sys,tempfile,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-entitlement-test-')
os.environ['WERKZ_AI_PACKAGE']='hotel-demo'
os.environ['WERKZ_AI_MODE']='demo'
from fastapi.testclient import TestClient
from backend.app import app
from backend.db import Session,User,ModuleConfig
from backend.security import hash_password

client=TestClient(app,headers={'origin':'http://testserver'})
assert client.get('/api/modules').status_code==401
assert client.post('/api/setup',json={'username':'synthetic_operator','password':'synthetic-test-only'}).status_code==201
assert client.post('/api/login',json={'username':'synthetic_operator','password':'synthetic-test-only'}).status_code==200
tenant=client.get('/api/me').json()['tenant']
baseline=client.get('/api/admin/modules').json()
assert client.put('/api/admin/entitlements/hotel_ai',json={'status':'suspended','expectedRevision':'0'*64}).status_code==409
def change(state,revision,expires=None):
    return client.put('/api/admin/entitlements/hotel_ai',json={'status':state,'expectedRevision':revision,'expiresAt':expires})
disabled=change('suspended',baseline['revision']);assert disabled.status_code==200,disabled.text
assert client.get('/api/modules').json()['modules']['hotel_ai'] is False
assert client.get('/api/hotel/context?q=rooms').status_code==403
assert client.post('/api/chats',json={'workspace':'hotel'}).status_code==403
assert change('active',baseline['revision']).status_code==409
enabled=change('trial',disabled.json()['revision'],'2099-01-01T00:00:00Z');assert enabled.status_code==200,enabled.text
assert client.get('/api/me').json()['modules']['hotel_ai'] is True
assert client.post('/api/chats',json={'workspace':'hotel'}).status_code==201
# New application client/session sees persisted grant, not process-local state.
restarted=TestClient(app,headers={'origin':'http://testserver'})
assert restarted.post('/api/login',json={'username':'synthetic_operator','password':'synthetic-test-only'}).status_code==200
assert restarted.get('/api/modules').json()['modules']['hotel_ai'] is True
assert client.put('/api/admin/modules',json={'modules':{k:False for k in baseline['modules']}}).status_code==409
assert client.put('/api/admin/entitlements/hotel_ai',json={'status':'active','expectedRevision':enabled.json()['revision'],'expiresAt':'2099-01-01T00:00:00'}).status_code==400
assert client.put('/api/admin/entitlements/hotel_ai',json={'status':'active','expectedRevision':enabled.json()['revision'],'tenant':'foreign'}).status_code==422
expired=change('active',enabled.json()['revision'],'2000-01-01T00:00:00Z');assert expired.status_code==200
assert restarted.get('/api/hotel/context?q=rooms').status_code==403
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=2) as pool:
    attempts=list(pool.map(lambda state:change(state,expired.json()['revision']).status_code,['active','suspended']))
assert sorted(attempts)==[200,409],attempts
current=client.get('/api/admin/modules').json()
with Session() as db:
    db.add(User(id='synthetic-other-admin',username='synthetic_other',password_hash=hash_password('synthetic-test-only'),role='admin',tenant='synthetic-tenant-b'))
    db.add(ModuleConfig(tenant='synthetic-tenant-b',modules=json.dumps({'hotel_ai':True})))
    db.add(User(id='synthetic-reader',username='synthetic_reader',password_hash=hash_password('synthetic-test-only'),role='reader',tenant=tenant))
    db.commit()
other=TestClient(app,headers={'origin':'http://testserver'})
assert other.post('/api/login',json={'username':'synthetic_other','password':'synthetic-test-only'}).status_code==200
assert other.get('/api/modules').json()['modules']['hotel_ai'] is True
assert other.get('/api/admin/modules').json()['revision']!=current['revision']
reader=TestClient(app,headers={'origin':'http://testserver'})
assert reader.post('/api/login',json={'username':'synthetic_reader','password':'synthetic-test-only'}).status_code==200
assert reader.put('/api/admin/entitlements/hotel_ai',json={'status':'active','expectedRevision':current['revision']}).status_code==403
assert client.get('/api/modules',headers={'x-werkz-tenant':'synthetic-tenant-b'}).status_code==409
print('entitlement HTTP/session/tenant/revision/expiry/AI guards: PASS')
