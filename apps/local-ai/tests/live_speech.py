"""Real offline Windows voice round trip using synthetic speech and an isolated DB."""
import os,sys,tempfile,io,wave
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-voice-test-')
os.environ['WERKZ_AI_PACKAGE']='handwerk-demo'
os.environ['WERKZ_AI_MODE']='demo'
from fastapi.testclient import TestClient
from backend.app import app
with TestClient(app,headers={'origin':'http://testserver'}) as client:
    credentials={'username':'synthetic-voice','password':'synthetic-voice-test'}
    assert client.post('/api/setup',json=credentials).status_code==201
    assert client.post('/api/login',json=credentials).status_code==200
    status=client.get('/api/voice/status').json()
    assert 'de-DE' in status['recognizers'] and 'de-DE' in status['voices'],status
    speech=client.post('/api/voice/synthesize',json={'text':'Guten Tag. Bitte rufen Sie mich heute zurück.'})
    assert speech.status_code==200,speech.text[:100] if speech.status_code!=200 else ''
    with wave.open(io.BytesIO(speech.content),'rb') as audio:assert audio.getnframes()>1000
    transcription=client.post('/api/voice/transcribe',files={'file':('synthetic.wav',speech.content,'audio/wav')})
    assert transcription.status_code==200,transcription.text
    value=transcription.json();assert len(value['text'].split())>=3,value
    assert value['localOnly'] and value['reviewRequired']
    print('PASS: installed German offline recognition, real WAV synthesis and transcription via authenticated API. Human correction remains necessary; microphone hardware not recorded by this test.')
