"""Synthetic HTTP tests against the existing app, no provider network."""
import json
import re
import time
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from backend import app as host, security, cloud_api, cloud_store
from backend.db import Base, User, LoginSession, ModuleConfig
from backend.kundenz import IdentityGrant, OIDCSession
from backend.cloud_store import CloudPermission, SQLDocumentStore, CloudBudget
from backend.security import COOKIE_NAME, session_hash
from backend.gini_cloud import GiniCloudError


@pytest.fixture
def system(monkeypatch):
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    for module in (host, security, cloud_api, cloud_store):
        monkeypatch.setattr(module, 'Session', factory)
    monkeypatch.setenv('WERKZ_AUTH_MODE', 'oidc')
    monkeypatch.setenv('WERKZ_OWNER_ISSUER', 'https://identity.example.invalid')
    monkeypatch.setenv('WERKZ_OWNER_SUBJECT', 'owner')
    monkeypatch.delenv('WERKZ_GINI_CLOUD_ENABLED', raising=False)
    actions=['ask','openai:chat','file:read','file:upload','file:propose_edit','file:save','file:restore']
    with factory() as db:
        for name in ('owner', 'customer-a', 'customer-b'):
            db.add(User(id=name, username=name, password_hash='disabled',
                        role='admin' if name=='owner' else 'hotel_reception', tenant='synthetic-'+name))
            db.flush()
            db.add(IdentityGrant(user_id=name, issuer='https://identity.example.invalid', subject=name,
                tenant='synthetic-'+name, role='OWNER' if name=='owner' else 'TEST_CUSTOMER',
                modules='["hotel"]', expires=time.time()+3600, revoked=0))
            db.add(LoginSession(token_hash=session_hash(name), user_id=name, expires=time.time()+3600))
            db.flush()
            db.add(OIDCSession(token_hash=session_hash(name), issuer='https://identity.example.invalid', subject=name))
            db.add(ModuleConfig(tenant='synthetic-'+name, modules='{"hotel_ai":true}'))
            db.add(CloudPermission(principal=name, actions=json.dumps(actions), data_classes='["synthetic","OWNER_PRIVATE"]',
                consent_ref='synthetic-consent', expires=time.time()+3600, revoked=0))
        db.commit()
    with TestClient(host.app, base_url='https://testserver') as client:
        def as_user(name):
            client.cookies.clear()
            client.cookies.set(COOKIE_NAME, name)
            return client
        yield factory, as_user
    engine.dispose()


def fake_provider(monkeypatch):
    class Fake:
        def status(self): return {'state':'synthetic'}
        def complete(self, messages, **kwargs):
            prompt = messages[-1]['content']
            marks = re.findall(r'<<<GINI-(?:START|ENDE)-[a-f0-9]+>>>', prompt)
            text = marks[0]+'\nSYNTHETIC edited\n'+marks[1] if marks else 'Synthetic answer'
            return {'text':text,'model':'synthetic-only','finish_reason':'stop'}
    original=cloud_api.service
    def service(ctx):
        result=original(ctx)
        result.openai=Fake()
        return result
    monkeypatch.setattr(cloud_api, 'service', service)


def post(client, path, body):
    return client.post('/api/gini/v1'+path, json=body, headers={'origin':'https://testserver'})


def test_upload_isolation_private_metadata_and_disabled_provider(system):
    _, user=system
    owner=user('owner')
    result=post(owner,'/documents',{'name':'private.txt','content':'Owner synthetic fixture','data_class':'OWNER_PRIVATE'})
    assert result.status_code==201, result.text
    identifier=result.json()['document_id']
    customer=user('customer-a')
    response=customer.get('/api/gini/v1/documents/'+identifier)
    assert response.status_code==404 and 'private.txt' not in response.text
    assert post(customer,'/documents',{'name':'private.txt','content':'x','data_class':'OWNER_PRIVATE'}).status_code==403
    assert post(customer,'/documents',{'name':'picture.png','content':'x'}).status_code==415
    assert post(customer,'/chat',{'messages':[{'role':'user','content':'test'}]}).status_code==503
    assert customer.get('/api/gini/v1/capabilities').json()['features']['voice'] is False
    assert post(customer,'/chat',{'messages':[],'tenant_id':'owner'}).status_code==422


def test_draft_approval_versions_restore_replay_and_logout(system, monkeypatch):
    factory,user=system
    fake_provider(monkeypatch)
    client=user('customer-a')
    raw=post(client,'/documents',{'name':'test.txt','content':'SYNTHETIC original'}).json()
    identifier=raw['document_id']
    result=post(client,f'/documents/{identifier}/edit-proposals',{'instruction':'Make a synthetic edit'})
    assert result.status_code==200, result.text
    draft=result.json()['draft']
    approval={'explicit_approval':False,'proposed_sha256':draft['proposed_sha256'],'idempotency_key':'synthetic-save-1'}
    path='/edit-proposals/'+draft['draft_id']+'/approve'
    assert post(client,path,approval).status_code==428
    approval['explicit_approval']=True
    assert post(client,path,approval).json()['new_version']==2
    # Every request constructs a new service: persistent idempotency must work.
    assert post(client,path,approval).json()['idempotent_replay'] is True
    assert len(client.get(f'/api/gini/v1/documents/{identifier}/versions').json())==2
    restore={'version':1,'expected_version':2,'explicit_approval':True,'idempotency_key':'synthetic-restore-1'}
    assert post(client,f'/documents/{identifier}/restore',restore).json()['version']==3
    assert client.get(f'/api/gini/v1/documents/{identifier}').json()['content']=='SYNTHETIC original'
    assert post(client,f'/documents/{identifier}/restore',{**restore,'idempotency_key':'synthetic-restore-2'}).status_code==409
    other=user('customer-b')
    assert other.get(f'/api/gini/v1/documents/{identifier}').status_code==404
    assert post(other,path,approval).status_code==404
    client=user('customer-a')
    assert client.post('/api/logout',headers={'origin':'https://testserver'}).status_code==200
    assert client.get(f'/api/gini/v1/documents/{identifier}').status_code==401
    assert SQLDocumentStore().get('synthetic-customer-a', identifier)['version']==3


def test_cloud_grant_and_session_revocation(system):
    factory,user=system
    client=user('customer-a')
    with factory() as db:
        db.get(CloudPermission,'customer-a').revoked=1
        db.commit()
    assert post(client,'/documents',{'name':'test.txt','content':'synthetic'}).status_code==403
    with factory() as db:
        db.get(IdentityGrant,'customer-a').revoked=1
        db.commit()
    assert client.get('/api/gini/v1/capabilities').status_code==403


def test_conservative_budget_is_persistent(system,monkeypatch):
    monkeypatch.setenv('WERKZ_GINI_CLOUD_TOKEN_LIMIT','120')
    cloud_api.PersistentBudget('synthetic-a').reserve(6)
    with pytest.raises(GiniCloudError):
        cloud_api.PersistentBudget('synthetic-a').reserve(6)
    cloud_api.PersistentBudget('synthetic-b').reserve(6)


def test_expired_session_denied_over_http(system):
    factory,user=system
    client=user('customer-a')
    with factory() as db:
        db.get(LoginSession,session_hash('customer-a')).expires=time.time()-1
        db.commit()
    assert client.get('/api/gini/v1/documents').status_code==401


def test_cloud_revocation_during_provider_call_discards_answer(system,monkeypatch):
    factory,user=system
    original=cloud_api.service
    class RevokingProvider:
        def complete(self,*args,**kwargs):
            with factory() as db:
                db.get(CloudPermission,'customer-a').revoked=1
                db.commit()
            return {'text':'MUST_NOT_LEAK','model':'synthetic','finish_reason':'stop'}
    def service(ctx):
        svc=original(ctx)
        svc.openai=RevokingProvider()
        return svc
    monkeypatch.setattr(cloud_api,'service',service)
    response=post(user('customer-a'),'/chat',{'messages':[{'role':'user','content':'synthetic'}]})
    assert response.status_code==403 and 'MUST_NOT_LEAK' not in response.text
