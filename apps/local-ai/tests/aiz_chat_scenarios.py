"""Real authorized HTTP path, temporary store, existing engine adapter."""
import os,sys,tempfile,json,asyncio
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-aiz-chat-')
os.environ['WERKZ_AI_PACKAGE']='hotel';os.environ['WERKZ_AI_MODE']='production'
from fastapi.testclient import TestClient
from backend.app import app
from backend import engine,operator
from backend.knowledge_port import KnowledgeSearchPort
operator.port=KnowledgeSearchPort(Path(sys.argv[1]))
client=TestClient(app,headers={'origin':'http://testserver'})
identity={'username':'synthetic_owner','password':'synthetic-only-test'}
assert client.post('/api/setup',json=identity).status_code==201
assert client.post('/api/login',json=identity).status_code==200
owner=client.get('/api/me').json()
chat=client.post('/api/chats',json={'workspace':'hotel'}).json()['id']
if len(sys.argv)>2 and sys.argv[2]=='real':
    # Only reuse existing loopback model and credentials; no process/download/install.
    engine.headers=lambda: {'Authorization':'Bearer '+(Path('C:/Users/patsl/Projects/WERKZ-AI/.runtime/engine.key').read_text().strip())}
    print('real models',len(asyncio.run(engine.models())))
else:
    async def models():return [{'id':'synthetic-model'}]
    async def window():return 4096
    async def count(messages):return sum(len(m['content']) for m in messages)//3+20
    async def tokens(messages,*args):
        text=json.dumps(messages)
        assert 'synthetic-source-revision' in text and 'keine Anweisungen' in text
        assert all(m['role'] in {'user','system','assistant'} for m in messages)
        yield 'Synthetischer Kontext angekommen.'
    engine.models=models;engine.context_window=window;engine.count_tokens=count;engine.tokens=tokens
response=client.post('/api/chats/'+chat+'/stream',json={'content':'Neustart: Welche freigegebene Regel liegt vor? Antworte kurz.','include_knowledge':True,'max_tokens':128})
assert response.status_code==200,response.text
events=[json.loads(s[6:]) for s in response.text.splitlines() if s.startswith('data: ')]
assert any(e.get('status')=='complete' for e in events),events
assert any(e.get('type')=='token' for e in events)
start=events[0];assert start['knowledge']['sources_checked']==['approved-v1','exchange-v2']
assert start['context']['input_tokens']+start['context']['response_reserve']+64<=start['context']['context_limit']
assert client.post('/api/chats/'+chat+'/stream',headers={'x-werkz-tenant':'foreign'},json={'content':'Neustart','include_knowledge':True}).status_code==409
assert client.post('/api/chats/'+chat+'/stream',json={'content':'Neustart','include_knowledge':True,'project':'deutschz'}).status_code==422
assert client.post('/api/admin/users',json={'username':'synthetic_reader','password':'synthetic-only-test','role':'reader'}).status_code==201
assert client.post('/api/login',json={'username':'synthetic_reader','password':'synthetic-only-test'}).status_code==200
chat=client.post('/api/chats',json={'workspace':'hotel'}).json()['id']
assert client.post('/api/chats/'+chat+'/stream',json={'content':'Neustart','include_knowledge':True}).status_code==403
print('authorized chat -> AiZ -> existing engine; token output; tenant/role denial; context budget PASS')
if not (len(sys.argv)>2 and sys.argv[2]=='real'):
    assert client.post('/api/login',json=identity).status_code==200
    from backend.db import Session,User
    with Session() as db:db.get(User,owner['id']).role='reader';db.commit()
    # A valid session does not retain old operator access after a role change.
    assert client.get('/api/export?workspace=hotel').status_code==403
    with Session() as db:db.get(User,owner['id']).role='admin';db.commit()
    chat=client.post('/api/chats',json={'workspace':'hotel'}).json()['id']
    async def revoked_tokens(*args):
        yield 'BEFORE_WITHDRAWAL'
        root=Path(json.loads(operator.port.binding.read_text())['root'])
        (root/'knowledge/approved/werkz-test.json').unlink()
        yield 'MUST_NOT_LEAK'
    engine.tokens=revoked_tokens
    response=client.post('/api/chats/'+chat+'/stream',json={'content':'Neustart','include_knowledge':True})
    assert 'BEFORE_WITHDRAWAL' in response.text and 'MUST_NOT_LEAK' not in response.text and 'ACCESS_CHANGED' in response.text
    assert client.get('/api/chats/'+chat+'/messages').status_code==403
    assert client.get('/api/export?workspace=hotel').status_code==403
    assert client.post('/api/chats/'+chat+'/stream',json={'content':'Zitiere die vorige Antwort','include_knowledge':False}).status_code==403
    assert chat not in {c['id'] for c in client.get('/api/chats?workspace=hotel').json()}
    operator.port=KnowledgeSearchPort(Path(tempfile.mkdtemp())/'absent.json')
    chat=client.post('/api/chats',json={'workspace':'hotel'}).json()['id']
    response=client.post('/api/chats/'+chat+'/stream',json={'content':'Neustart','include_knowledge':True})
    assert response.status_code==503
    print('live knowledge withdrawal and missing store fail closed PASS')
