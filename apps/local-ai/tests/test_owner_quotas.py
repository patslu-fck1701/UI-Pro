from datetime import datetime,timedelta,timezone
import pytest
from sqlalchemy import select
from tests.test_cloud_host import system
from backend.owner_quotas import presentation, QuotaSnapshot, ManualSnapshot
from backend.kundenz import IdentityGrant

BASE='/api/auth/owner/quotas'
def payload(**changes):
    return dict(provider='codex',metric='week',unit='percent',period='week',available=33,
        observed_at=datetime.now(timezone.utc).isoformat(),expected_version=0,
        idempotency_key='synthetic-import-1',**changes)
def send(client,data):return client.post(BASE+'/manual',json=data,headers={'origin':'https://testserver'})

def test_owner_only_and_four_unknown_cards(system):
    _,user=system
    c=user('owner');r=c.get(BASE);assert r.status_code==200
    assert {c['provider'] for c in r.json()['cards']}=={'openai','elevenlabs','codex','claude'}
    assert all(m['source']=='UNBEKANNT' and m['remaining_percent'] is None for c in r.json()['cards'] for m in c['metrics'])
    for name in ('customer-a','customer-b'):
        c=user(name);assert c.get(BASE).status_code==403
        assert send(c,payload()).status_code==403
    assert c.get(BASE,headers={'x-role':'OWNER','x-email':'owner@example.invalid'}).status_code==403

def test_idempotency_conflicts_source_binding_and_persistence(system):
    factory,user=system;c=user('owner');data=payload()
    r=send(c,data);assert r.status_code==200,r.text
    assert r.json()['source']=='MANUELL' and r.json()['remaining_percent']==33
    assert send(c,data).json()['version']==1
    changed={**data,'available':20};assert send(c,changed).status_code==409
    assert send(c,{**changed,'idempotency_key':'synthetic-import-2'}).status_code==409
    assert send(c,{**changed,'idempotency_key':'synthetic-import-2','expected_version':1}).status_code==200
    assert send(c,{**data,'source':'LIVE_PROVIDER'}).status_code==422
    with factory() as db:
        row=db.get(QuotaSnapshot,('owner','codex','week'));assert row.version==2
    result=c.get(BASE).json();week=next(m for card in result['cards'] if card['provider']=='codex' for m in card['metrics'] if m['metric']=='week')
    assert week['available']==20 and week['remaining_percent']==20

@pytest.mark.parametrize('available,total,used,expected',[(0,100,None,0),(100,100,None,100),(5,None,None,None),(0,0,0,None),(None,100,110,0)])
def test_percentage_semantics(available,total,used,expected):
    raw=dict(available=available,total=total,used=used,observed_at=datetime.now(timezone.utc).isoformat(),quality='statement')
    r=presentation(raw);assert r['remaining_percent']==expected
    if used==110:assert r['overdrawn']

def test_stale_reset_estimate_and_invalid_units(system):
    _,user=system;c=user('owner');past=datetime.now(timezone.utc)-timedelta(days=2)
    data=payload();data.update(observed_at=past.isoformat(),reset_at=(past+timedelta(days=1)).isoformat(),quality='estimate')
    r=send(c,data);assert r.status_code==200
    assert r.json()['source']=='VERALTET' and r.json()['quality_label']=='SCHÄTZUNG' and r.json()['remaining_percent'] is None
    data=payload();data.update(unit='EUR');assert send(c,data).status_code==422
    data=payload();data.update(observed_at='2026-11-03T12:00:00');assert send(c,data).status_code==422
    data=payload();data.update(available=80,used=80,total=100);assert send(c,data).status_code==422
    data=payload();data.update(provider='openai',metric='prepaid',unit='EUR',period='prepaid',available=10,total=None,idempotency_key='synthetic-prepaid')
    r=send(c,data);assert r.status_code==200 and r.json()['remaining_percent'] is None

def test_all_customer_roles_and_unpinned_owner_denied(system,monkeypatch):
    factory,user=system
    for role in ('CUSTOMER_ADMIN','CUSTOMER_USER','TEST_CUSTOMER'):
        with factory() as db:r=db.get(IdentityGrant,'customer-a');r.role=role;db.commit()
        assert user('customer-a').get(BASE).status_code==403
    monkeypatch.setenv('WERKZ_OWNER_SUBJECT','different-owner')
    assert user('owner').get(BASE).status_code==403

def test_account_switch_does_not_reuse_old_denominator(system):
    _,user=system;c=user('owner');data=payload()
    data.update(provider='openai',metric='prepaid',unit='EUR',period='prepaid',available=10,total=20,used=10,account_ref='account-a')
    assert send(c,data).json()['remaining_percent']==50
    data.update(available=5,total=None,used=None,account_ref='account-b',expected_version=1,idempotency_key='account-switch-2')
    r=send(c,data);assert r.status_code==200
    assert r.json()['remaining_percent'] is None and r.json()['total'] is None and r.json()['account_ref']=='account-b'
