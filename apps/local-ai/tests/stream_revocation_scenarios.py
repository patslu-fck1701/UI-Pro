"""Synthetic local model + real HTTP/session/SQLite revocation boundaries."""
import os,sys,tempfile,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-stream-revoke-')
os.environ['WERKZ_AI_PACKAGE']='hotel';os.environ['WERKZ_AI_MODE']='production'
from fastapi.testclient import TestClient
from sqlalchemy import select,delete
from backend.app import app,busy
from backend import engine
from backend.db import Session,User,ModuleConfig,LoginSession,Message,Document

client=TestClient(app,headers={'origin':'http://testserver'})
identity={'username':'synthetic_owner','password':'synthetic-only-test'}
assert client.post('/api/setup',json=identity).status_code==201
assert client.post('/api/login',json=identity).status_code==200
owner=client.get('/api/me').json()
async def models():return [{'id':'synthetic-model'}]
async def window():return 4096
async def count(messages):return sum(len(m['content']) for m in messages)//4+20
engine.models=models;engine.context_window=window;engine.count_tokens=count

def restore():
    with Session() as db:
        user=db.get(User,owner['id']);user.role='admin';user.tenant=owner['tenant']
        row=db.get(ModuleConfig,owner['tenant'])
        if row is None:row=ModuleConfig(tenant=owner['tenant'],modules='{}');db.add(row)
        row.modules=json.dumps({'hotel_ai':True});db.commit()
    assert client.post('/api/login',json=identity).status_code==200

for scenario in ['module','logout','expiry','role','tenant','document']:
    restore()
    chat=client.post('/api/chats',json={'workspace':'hotel'}).json()['id']
    document=None
    if scenario=='document':
        response=client.post('/api/documents',data={'workspace':'hotel'},files={'file':('synthetic.txt',b'authorized synthetic source','text/plain')})
        assert response.status_code==201,response.text
        document=response.json()['id']
    closed=[]
    async def tokens(*args):
        try:
            yield 'AUTHORIZED_PREFIX'
            with Session() as db:
                if scenario=='module':db.get(ModuleConfig,owner['tenant']).modules=json.dumps({'hotel_ai':False})
                elif scenario=='logout':db.execute(delete(LoginSession).where(LoginSession.user_id==owner['id']))
                elif scenario=='expiry':
                    for row in db.scalars(select(LoginSession).where(LoginSession.user_id==owner['id'])):row.expires=0
                elif scenario=='role':db.get(User,owner['id']).role='hotel_housekeeping'
                elif scenario=='tenant':db.get(User,owner['id']).tenant='synthetic-foreign'
                elif scenario=='document':db.delete(db.get(Document,document))
                db.commit()
            yield 'NEVER_DISCLOSE_AFTER_REVOCATION'
        finally:closed.append(True)
    engine.tokens=tokens
    payload={'content':'Zimmerstatus zusammenfassen','include_hotel':True}
    if document:payload['document_id']=document
    response=client.post('/api/chats/'+chat+'/stream',json=payload)
    assert response.status_code==200,response.text
    events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
    assert any(e.get('content')=='AUTHORIZED_PREFIX' for e in events)
    assert any(e.get('code')=='ACCESS_CHANGED' for e in events),(scenario,events)
    assert 'NEVER_DISCLOSE_AFTER_REVOCATION' not in response.text
    assert closed==[True] and not busy
    with Session() as db:
        answer=db.scalar(select(Message).where(Message.chat_id==chat,Message.role=='assistant'))
        assert answer.status=='interrupted' and answer.content=='AUTHORIZED_PREFIX'
    print(scenario+': revoked stream stopped and generator closed PASS')

# A grant withdrawn while prompt budgeting awaits must prevent model dispatch/storage.
restore();chat=client.post('/api/chats',json={'workspace':'hotel'}).json()['id']
called=[]
async def revoked_count(messages):
    with Session() as db:db.get(ModuleConfig,owner['tenant']).modules='{"hotel_ai":false}';db.commit()
    return await count(messages)
async def forbidden_model(*args):
    called.append(True)
    yield 'NEVER'
engine.count_tokens=revoked_count;engine.tokens=forbidden_model
response=client.post('/api/chats/'+chat+'/stream',json={'content':'synthetic question','include_hotel':True})
assert response.status_code==403,response.text
assert not called and not busy
with Session() as db:assert list(db.scalars(select(Message).where(Message.chat_id==chat)))==[]
print('revocation before model dispatch: no model/no stored messages PASS')
