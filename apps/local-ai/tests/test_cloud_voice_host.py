import io
import json
import time
import pytest
from sqlalchemy import select
from tests.test_cloud_host import system, fake_provider, post
from backend import cloud_voice
from backend.cloud_store import CloudPermission
from backend.cloud_voice import VoiceBudget, CharacterBudget
from backend.gini_cloud import GiniCloudError

def enable(factory,monkeypatch,principal='owner'):
    for key,value in {'WERKZ_GINI_CLOUD_VOICE_ENABLED':'1','WERKZ_GINI_CLOUD_VOICE_COST_APPROVED':'1',
        'WERKZ_GINI_CLOUD_VOICE_CHAR_LIMIT':'2000','WERKZ_GINI_CLOUD_ELEVENLABS_KEY':'synthetic-not-real',
        'WERKZ_GINI_CLOUD_V10_VOICE_ID':'SyntheticV10Voice00000'}.items():monkeypatch.setenv(key,value)
    with factory() as db:
        row=db.get(CloudPermission,principal);row.actions=json.dumps(json.loads(row.actions)+['tts:synthesize']);db.commit()
    calls=[]
    class Transport:
        def open(self,request,**kwargs):calls.append(request);return io.BytesIO(b'ID3\x03\x00\x00synthetic-only')
    monkeypatch.setattr(cloud_voice,'build_opener',lambda *args:Transport())
    return calls

def reply(client):
    r=post(client,'/chat',{'messages':[{'role':'user','content':'Synthetic question'}]})
    assert r.status_code==200,r.text
    return r.json()['reply_id']

def test_voice_default_denied_and_no_arbitrary_text(system,monkeypatch):
    factory,user=system;fake_provider(monkeypatch);c=user('owner');identifier=reply(c)
    assert post(c,'/voice/tts',{'reply_id':identifier}).status_code==403
    calls=enable(factory,monkeypatch)
    monkeypatch.setenv('WERKZ_GINI_CLOUD_VOICE_COST_APPROVED','0')
    assert post(c,'/voice/tts',{'reply_id':identifier}).status_code==503
    assert calls==[]

def test_finished_reply_budget_replay_logout_and_tenant(system,monkeypatch):
    factory,user=system;fake_provider(monkeypatch);calls=enable(factory,monkeypatch);c=user('owner')
    assert c.get('/api/gini/v1/capabilities').json()['features']['voice'] is True
    identifier=reply(c)
    assert post(c,'/voice/tts',{'reply_id':identifier,'text':'different'}).status_code==422
    r=post(c,'/voice/tts',{'reply_id':identifier});assert r.status_code==200,r.text
    assert r.content.startswith(b'ID3') and r.headers['cache-control']=='private, no-store'
    assert r.headers['vary']=='Cookie' and r.headers['x-gini-voice']=='provider'
    assert post(c,'/voice/tts',{'reply_id':identifier}).headers['x-gini-voice']=='cache'
    assert len(calls)==1
    with factory() as db:
        rows=list(db.scalars(select(VoiceBudget).where(VoiceBudget.scope=='tenant:synthetic-owner')))
        assert len(rows)==1 and rows[0].used==len('Synthetic answer')
    enable(factory,monkeypatch,'customer-a');foreign=user('customer-a')
    assert post(foreign,'/voice/tts',{'reply_id':identifier}).status_code==404
    c=user('owner');assert c.post('/api/logout',headers={'origin':'https://testserver'}).status_code==200
    assert not any(v['principal']=='owner' for v in cloud_voice.replies.items.values())
    assert post(c,'/voice/tts',{'reply_id':identifier}).status_code==401

def test_revocation_during_voice_discards_audio_and_retains_reservation(system,monkeypatch):
    factory,user=system;fake_provider(monkeypatch);enable(factory,monkeypatch);c=user('owner');identifier=reply(c)
    class Revoke:
        def open(self,*args,**kwargs):
            with factory() as db:r=db.get(CloudPermission,'owner');r.revoked=1;db.commit()
            return io.BytesIO(b'ID3\x03\x00\x00synthetic')
    monkeypatch.setattr(cloud_voice,'build_opener',lambda *args:Revoke())
    r=post(c,'/voice/tts',{'reply_id':identifier});assert r.status_code==403 and b'ID3' not in r.content
    assert cloud_voice.replies.items[identifier]['audio'] is None
    with factory() as db:assert db.scalar(select(VoiceBudget.used).where(VoiceBudget.scope=='tenant:synthetic-owner'))>0

def test_failed_provider_reservation_and_cap(system,monkeypatch):
    factory,user=system;fake_provider(monkeypatch);enable(factory,monkeypatch);c=user('owner');identifier=reply(c)
    monkeypatch.setenv('WERKZ_GINI_CLOUD_VOICE_CHAR_LIMIT','1')
    assert post(c,'/voice/tts',{'reply_id':identifier}).status_code==429
    monkeypatch.setenv('WERKZ_GINI_CLOUD_VOICE_CHAR_LIMIT','2000')
    class Invalid:
        def open(self,*args,**kwargs):return io.BytesIO(b'not mp3')
    monkeypatch.setattr(cloud_voice,'build_opener',lambda *args:Invalid())
    assert post(c,'/voice/tts',{'reply_id':identifier}).status_code==502
    with factory() as db:assert db.scalar(select(VoiceBudget.used).where(VoiceBudget.scope=='tenant:synthetic-owner'))==len('Synthetic answer')
