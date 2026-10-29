import os,tempfile,uuid,json,io
from pathlib import Path
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-ai-tests-')
os.environ['WERKZ_AI_PACKAGE']='handwerk-demo'
os.environ['WERKZ_AI_MODE']='demo'
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.app import app
from backend.db import Session,User,Chat,Message
from backend.security import hash_password
from backend import engine

ORIGIN={'origin':'http://testserver'}
@pytest.fixture(scope='module')
def client():
    with TestClient(app,headers=ORIGIN) as client:
        assert client.post('/api/setup',json={'username':'synthetic-admin','password':'synthetic-pass'}).status_code==201
        assert client.post('/api/login',json={'username':'synthetic-admin','password':'synthetic-pass'}).status_code==200
        yield client
def test_auth_csrf_and_setup(client):
    assert client.post('/api/setup',json={'username':'other','password':'synthetic-pass'}).status_code==409
    assert client.post('/api/chats',json={},headers={'origin':'https://attacker.invalid'}).status_code==403
    with TestClient(app,headers=ORIGIN) as anonymous:
        assert anonymous.get('/api/business/snapshot').status_code==401
        assert anonymous.post('/api/login',json={'username':'synthetic-admin','password':'wrong'}).status_code==401
def test_demo_data_and_roles(client):
    value=client.get('/api/business/snapshot').json()
    assert len(value['customers'])==3 and len(value['orders'])==3
    assert value['metrics']['paidCents']==59500
    assert value['metrics']['overdueInvoices']==1
    assert client.get('/api/business/context').json()['readOnly'] is True
    assert client.post('/api/admin/users',json={'username':'synthetic-reader','password':'synthetic-pass','role':'reader'}).status_code==201
    with TestClient(app,headers=ORIGIN) as reader:
        reader.post('/api/login',json={'username':'synthetic-reader','password':'synthetic-pass'})
        assert reader.get('/api/business/snapshot').status_code==200
        assert reader.post('/api/business/customers',json={'name':'Not allowed'}).status_code==403
        assert reader.get('/api/admin/modules').status_code==403
def test_deterministic_quote_and_pdf(client):
    customer=client.get('/api/business/snapshot').json()['customers'][0]
    response=client.post('/api/business/quotes',json={'customer_id':customer['id'],'title':'SYNTHETISCH · Angebot','hours':'2.5','hourly_cents':6000,'vat_percent':'19','materials':[{'description':'SYNTHETISCH · Dichtung','quantity':'3','unit_price_cents':1000}]})
    assert response.status_code==201,response.text
    value=response.json();assert value['net_cents']==18000 and value['tax_cents']==3420 and value['gross_cents']==21420
    pdf=client.get('/api/business/quotes/'+value['id']+'/pdf')
    assert pdf.status_code==200 and pdf.content.startswith(b'%PDF')
    from pypdf import PdfReader
    text=''.join(page.extract_text() for page in PdfReader(io.BytesIO(pdf.content)).pages)
    assert '214.20' in text and 'Unverbindlicher' in text
def test_callback_and_tenant_isolation(client):
    customer=client.get('/api/business/snapshot').json()['customers'][0]
    call={'name':'SYNTHETISCH · Anrufer','topic':'SYNTHETISCH · Wasserrohrbruch','urgency':'urgent','phone':'0000-999','address':'Demoanschrift 9','requested':'heute'}
    assert client.post('/api/voice/callbacks',json=call).status_code==201
    assert any(c['topic']==call['topic'] for c in client.get('/api/business/snapshot').json()['callbacks'])
    with Session() as db:
        db.add(User(id=str(uuid.uuid4()),username='synthetic-tenant-b',password_hash=hash_password('synthetic-pass'),role='admin',tenant=str(uuid.uuid4())));db.commit()
    with TestClient(app,headers=ORIGIN) as other:
        other.post('/api/login',json={'username':'synthetic-tenant-b','password':'synthetic-pass'})
        value=other.get('/api/business/snapshot').json()
        assert all(c['id']!=customer['id'] for c in value['customers'])
        assert other.post('/api/business/orders',json={'customer_id':customer['id'],'title':'foreign'}).status_code==404
        count=len(value['customers']);client.post('/api/business/demo/reset',json={})
        assert len(other.get('/api/business/snapshot').json()['customers'])==count
def test_module_disable_enforced_and_core_stays_available(client):
    config=client.get('/api/admin/modules').json()['modules']
    chat=client.post('/api/chats',json={'workspace':'business'}).json()
    disabled={**config,'business_ai':False,'voice_ai':False}
    assert client.put('/api/admin/modules',json={'modules':disabled}).status_code==200
    assert client.get('/api/business/snapshot').status_code==403
    assert client.get('/api/chats/'+chat['id']+'/messages').status_code==403
    assert client.post('/api/voice/callbacks',json={'name':'a','topic':'a','phone':'123','address':'a'}).status_code==403
    assert client.post('/api/chats',json={'workspace':'core'}).status_code==201
    client.put('/api/admin/modules',json={'modules':config})
def test_files_statistics_xml_and_prompt_studio(client):
    response=client.post('/api/documents',files={'file':('synthetic.csv',b'name,value\nA,10\nB,20\nB,20\n','text/csv')},data={'workspace':'business'})
    assert response.status_code==201,response.text
    value=response.json();assert value['analysis']['rows']==3 and value['analysis']['duplicates']==1
    assert round(value['analysis']['chart'][0]['value'],2)==16.67
    assert client.get('/api/documents/'+value['id']+'/report').status_code==200
    config=client.get('/api/admin/modules').json()['modules'];client.put('/api/admin/modules',json={'modules':{**config,'deutschz_ai':True,'creative_ai':True}})
    xml=b'<types><type name="Synthetic"><nominal>2</nominal><min>5</min></type></types>'
    report=client.post('/api/documents',files={'file':('synthetic.xml',xml,'application/xml')},data={'workspace':'deutschz'}).json()
    assert len(report['analysis']['errors'])==1
    result=client.post('/api/prompts',json={'kind':'video','subject':'SYNTHETISCH · Werkstatt bei Sonnenaufgang','duration':12})
    assert result.status_code==200 and len(result.json()['timeline'])==3
    assert client.get('/api/prompts').json()
def test_streaming_and_real_demo_context(client,monkeypatch):
    captured={}
    async def models():return [{'id':'synthetic-model'}]
    async def context_window():return 4096
    async def count_tokens(messages):return sum(len(row['content'].encode('utf-8')) for row in messages)//2+30
    async def tokens(messages,model,temperature,max_tokens):
        captured['messages']=messages
        yield 'Synthetische '
        yield 'Testantwort.'
    monkeypatch.setattr(engine,'models',models);monkeypatch.setattr(engine,'tokens',tokens)
    monkeypatch.setattr(engine,'context_window',context_window);monkeypatch.setattr(engine,'count_tokens',count_tokens)
    chat=client.post('/api/chats',json={'workspace':'business'}).json()
    response=client.post('/api/chats/'+chat['id']+'/stream',json={'content':'Welche Aufträge sind offen?','include_business':True,'max_tokens':128})
    assert response.status_code==200,response.text
    assert '"type": "token"' in response.text and '"status": "complete"' in response.text
    assert 'Heizungswartung' in captured['messages'][-1]['content']
    assert client.get('/api/chats/'+chat['id']+'/messages').json()[-1]['content']=='Synthetische Testantwort.'
    assert client.get('/api/chats?q=Testantwort&workspace=business').json()[0]['id']==chat['id']
def test_rejected_and_failed_inference_allow_immediate_followup(client,monkeypatch):
    async def models():return [{'id':'synthetic-model'}]
    async def context_window():return 4096
    async def count_tokens(messages):return sum(len(row['content']) for row in messages)//2+30
    async def failing(*args):
        raise OSError('synthetic engine failure')
        yield ''
    async def working(*args):yield 'Wieder bereit.'
    monkeypatch.setattr(engine,'models',models)
    monkeypatch.setattr(engine,'context_window',context_window)
    monkeypatch.setattr(engine,'count_tokens',count_tokens)
    monkeypatch.setattr(engine,'tokens',failing)
    chat=client.post('/api/chats',json={'workspace':'business'}).json()['id']
    url='/api/chats/'+chat+'/stream'
    rejected=client.post(url,json={'content':'x'*15000})
    assert rejected.status_code==413
    assert client.get('/api/chats/'+chat+'/messages').json()==[]
    failed=client.post(url,json={'content':'Hallo'})
    assert failed.status_code==200 and '"status": "error"' in failed.text
    monkeypatch.setattr(engine,'tokens',working)
    followup=client.post(url,json={'content':'Erneut kurz fragen'})
    assert followup.status_code==200 and 'Wieder bereit.' in followup.text
    assert '"status": "complete"' in followup.text

def test_automation_is_guarded_and_never_executes(client):
    result=client.post('/api/actions',json={'adapter':'GitHub','description':'SYNTHETISCH · Testaufgabe'}).json()
    assert result['executed'] is False
    result=client.post('/api/actions/'+result['id']+'/approve',json={}).json()
    assert result['state']=='approved_not_executed' and result['executed'] is False

def test_startup_status_is_authenticated_redacted_and_stale(client,monkeypatch,tmp_path):
    import importlib
    application=importlib.import_module('backend.app')
    monkeypatch.setattr(application,'ROOT',tmp_path)
    runtime=tmp_path/'.runtime';runtime.mkdir()
    target=runtime/'startup-status.json'
    target.write_text(json.dumps({'phase':'DEGRADED','checked_at':'2020-01-01T00:00:00Z','checks':{'engine':'ready','application':'ready'},'raw_log':'SYNTHETIC_PRIVATE_SENTINEL','connections':[{'source':'Lovable','state':'NOT_CONFIGURED_IN_LOCAL_RUNTIME'}]}))
    response=client.get('/api/local-status');assert response.status_code==200
    assert response.json()['stale'] and response.json()['local_ready']
    assert response.json()['connections']==[{'source':'Lovable','state':'NOT_CONNECTED'}]
    assert 'SYNTHETIC_PRIVATE_SENTINEL' not in response.text and 'raw_log' not in response.text
    with TestClient(app,headers=ORIGIN) as anonymous:assert anonymous.get('/api/local-status').status_code==401
    target.write_text('not json')
    assert client.get('/api/local-status').json()['phase']=='NOT_VERIFIED'
def test_logout_invalidates_session():
    with TestClient(app,headers=ORIGIN) as client:
        client.post('/api/login',json={'username':'synthetic-admin','password':'synthetic-pass'})
        assert client.post('/api/logout').status_code==200
        assert client.get('/api/me').status_code==401

def test_xlsx_json_pdf_and_rpt_processing(client):
    import pandas as pd
    from reportlab.pdfgen import canvas
    xlsx=io.BytesIO();pd.DataFrame({'hours':[2,4]}).to_excel(xlsx,index=False)
    value=client.post('/api/documents',files={'file':('synthetic.xlsx',xlsx.getvalue())},data={'workspace':'business'})
    assert value.status_code==201 and value.json()['analysis']['chart'][0]['value']==3
    value=client.post('/api/documents',files={'file':('synthetic.json',b'[{"value":5},{"value":15}]')},data={'workspace':'business'})
    assert value.status_code==201 and value.json()['analysis']['rows']==2
    pdf=io.BytesIO();page=canvas.Canvas(pdf);page.drawString(40,700,'SYNTHETIC PDF TEST');page.save()
    value=client.post('/api/documents',files={'file':('synthetic.pdf',pdf.getvalue())},data={'workspace':'business'})
    assert value.status_code==201 and value.json()['analysis']['pages']==1
    value=client.post('/api/documents',files={'file':('synthetic.rpt',b'Normal startup\nSCRIPT ERROR: synthetic missing dependency')},data={'workspace':'deutschz'})
    assert value.status_code==201 and value.json()['analysis']['findings'][0]['line']==2

def test_production_mode_never_seeds_or_resets():
    import subprocess,sys
    code="""
from fastapi.testclient import TestClient
from backend.app import app
with TestClient(app,headers={'origin':'http://testserver'}) as c:
    credentials={'username':'synthetic-production','password':'synthetic-pass'}
    assert c.post('/api/setup',json=credentials).status_code==201
    c.post('/api/login',json=credentials)
    snapshot=c.get('/api/business/snapshot').json()
    assert snapshot['mode']=='production' and snapshot['customers']==[] and snapshot['orders']==[]
    assert c.post('/api/business/demo/reset',json={}).status_code==403
print('production-isolated')
"""
    result=subprocess.run([sys.executable,'-c',code],env={**os.environ,'WERKZ_AI_MODE':'production','WERKZ_AI_DATA':tempfile.mkdtemp(prefix='werkz-production-test-')},capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    assert 'production-isolated' in result.stdout

def test_full_backup_restore_and_unsafe_archive_rejection(tmp_path,monkeypatch):
    import sqlite3,zipfile
    from backend import backup
    source=tmp_path/'source';source.mkdir();(source/'files'/'tenant').mkdir(parents=True);(source/'files'/'tenant'/'sample.txt').write_text('synthetic evidence')
    with sqlite3.connect(source/'werkz-ai.sqlite3') as db:
        db.execute('CREATE TABLE sessions(token TEXT)');db.execute("INSERT INTO sessions VALUES('synthetic-session')");db.execute('CREATE TABLE sample(value TEXT)');db.execute("INSERT INTO sample VALUES('synthetic-data')");db.commit()
    archive=backup.create(source,tmp_path/'safe.zip')
    class Probe:
        def __enter__(self):return self
        def __exit__(self,*_):pass
        def connect_ex(self,*_):return 1
    monkeypatch.setattr(backup.socket,'socket',lambda:Probe())
    target=tmp_path/'restored';backup.restore(target,archive)
    with sqlite3.connect(target/'werkz-ai.sqlite3') as db:
        assert db.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        assert db.execute('SELECT value FROM sample').fetchone()[0]=='synthetic-data'
    assert (target/'files'/'tenant'/'sample.txt').read_text()=='synthetic evidence'
    malicious=tmp_path/'unsafe.zip'
    with zipfile.ZipFile(malicious,'w') as zip:
        zip.writestr('werkz-ai.sqlite3',b'fake');zip.writestr('files/../../escape.txt','unsafe')
    with pytest.raises(ValueError):backup.restore(target,malicious)
    assert not (tmp_path/'escape.txt').exists()

def test_media_preview_ownership_and_provider_metadata(client):
    import base64
    client.post('/api/login',json={'username':'synthetic-admin','password':'synthetic-pass'})
    modules=client.get('/api/admin/modules').json()['modules'];modules['creative_ai']=True
    assert client.put('/api/admin/modules',json={'modules':modules}).status_code==200
    raw=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=')
    response=client.post('/api/documents',data={'workspace':'creative'},files={'file':('synthetic-reference.png',raw,'image/png')})
    assert response.status_code==201,response.text
    id=response.json()['id'];preview=client.get('/api/documents/'+id+'/preview')
    assert preview.status_code==200 and preview.headers['content-type']=='image/png'
    assert preview.content==raw
    with TestClient(app,headers=ORIGIN) as anonymous:assert anonymous.get('/api/documents/'+id+'/preview').status_code==401
    result=client.post('/api/prompts',json={'subject':'Synthetische Werkstatt','provider':'comfyui','model':'synthetic-model'}).json()
    assert result['provider']=='comfyui' and result['model']=='synthetic-model' and result['connected'] is False
    modules['creative_ai']=False;client.put('/api/admin/modules',json={'modules':modules})
    assert client.get('/api/documents/'+id+'/preview').status_code==403
    modules['creative_ai']=True;client.put('/api/admin/modules',json={'modules':modules})
    assert client.delete('/api/documents/'+id).status_code==200
    assert client.get('/api/documents/'+id+'/preview').status_code==404

def test_local_voice_validation_and_module_boundary(client):
    client.post('/api/login',json={'username':'synthetic-admin','password':'synthetic-pass'})
    modules=client.get('/api/admin/modules').json()['modules'];modules['voice_ai']='simulation'
    client.put('/api/admin/modules',json={'modules':modules})
    response=client.post('/api/voice/transcribe',files={'file':('invalid.wav',b'not-a-wave','audio/wav')})
    assert response.status_code==400
    assert client.post('/api/voice/synthesize',json={'text':''}).status_code==422
    modules['voice_ai']=False;client.put('/api/admin/modules',json={'modules':modules})
    assert client.get('/api/voice/status').status_code==403
    assert client.post('/api/voice/synthesize',json={'text':'Synthetischer Test'}).status_code==403
    modules['voice_ai']='simulation';client.put('/api/admin/modules',json={'modules':modules})
