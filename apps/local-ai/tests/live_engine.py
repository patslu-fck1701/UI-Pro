"""Explicit live test: uses only a temporary database and the actual local engine."""
import os,tempfile,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-ai-live-')
os.environ['WERKZ_AI_PACKAGE']='handwerk-demo'
os.environ['WERKZ_AI_MODE']='demo'
from fastapi.testclient import TestClient
from backend.app import app
from backend.db import DATA

with TestClient(app,headers={'origin':'http://testserver'}) as client:
    credentials={'username':'synthetic-live','password':'synthetic-local-test'}
    assert client.post('/api/setup',json=credentials).status_code==201
    assert client.post('/api/login',json=credentials).status_code==200
    health=client.get('/api/health').json();assert health['engine']=='ready',health
    snapshot=client.get('/api/business/snapshot').json();assert len(snapshot['orders'])==3
    chat=client.post('/api/chats',json={'workspace':'business'}).json()
    response=client.post('/api/chats/'+chat['id']+'/stream',json={'content':'Nenne kurz die Titel der offenen Aufträge aus den aktuellen Betriebsdaten. Antworte in höchstens drei Sätzen.','include_business':True,'max_tokens':150})
    assert response.status_code==200,response.text
    events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
    chunks=[event['content'] for event in events if event['type']=='token']
    assert chunks and events[-1].get('status')=='complete',events[-1]
    output=''.join(chunks)
    assert 'Heizung' in output or 'Wasserleitung' in output,output
    assert client.get('/api/chats/'+chat['id']+'/messages').json()[-1]['content']==output
    print('PASS real Qwen3 streaming: tokens='+str(len(chunks))+', characters='+str(len(output))+', actual demo order found; response persisted.',flush=True)
    transcript='SYNTHETISCH: Mein Name ist Demo Kunde. Wasserrohrbruch, bitte dringend zurückrufen. Telefonnummer 0000-0009. Adresse Demoanschrift 9. Termin heute Nachmittag.'
    extracted=client.post('/api/voice/extract',json={'text':transcript})
    assert extracted.status_code==200,extracted.text
    fields=extracted.json()['fields'];assert fields['phone'] and fields['topic'] and fields['address'],fields
    assert client.post('/api/voice/callbacks',json=fields).status_code==201
    print('PASS real Qwen3 transcript extraction and confirmed callback in actual demo customer database.')
    models=client.get('/api/admin/models').json();assert models
    loaded=client.post('/api/admin/models/load',json={'id':models[0]['id']})
    assert loaded.status_code==200,loaded.text
    assert client.get('/api/health').json()['engine']=='ready'
    print('PASS actual model reload via administrator API.')
