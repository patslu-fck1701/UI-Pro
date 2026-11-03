import time
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import oidc
from backend.db import Base, User, LoginSession
from backend.kundenz import IdentityGrant, OIDCSession, recheck
from backend.security import session_hash, COOKIE_NAME


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(oidc, 'Session', factory)
    for key, value in {'WERKZ_AUTH_MODE': 'oidc', 'WERKZ_OIDC_ISSUER': 'https://id.example.invalid',
                       'WERKZ_OIDC_CLIENT_ID': 'hotel',
                       'WERKZ_OIDC_REDIRECT_URI': 'https://hotel.example.invalid/api/auth/callback',
                       'WERKZ_OWNER_ISSUER': 'https://id.example.invalid',
                       'WERKZ_OWNER_SUBJECT': 'owner'}.items():
        monkeypatch.setenv(key, value)
    with factory() as db:
        db.add(User(id='u1', username='synthetic', password_hash='disabled', role='admin', tenant='synthetic-a'))
        db.flush()
        db.add(IdentityGrant(user_id='u1', issuer='https://id.example.invalid', subject='owner',
                             tenant='synthetic-a', role='OWNER', modules='["hotel"]',
                             expires=time.time()+3600, revoked=0))
        db.commit()
    app = FastAPI()
    app.include_router(oidc.router)
    with TestClient(app, base_url='https://hotel.example.invalid', follow_redirects=False) as browser:
        yield factory, browser
    engine.dispose()


def test_missing_config_fails_closed(setup, monkeypatch):
    _, browser = setup
    monkeypatch.delenv('WERKZ_OIDC_CLIENT_ID')
    assert browser.get('/api/auth/providers').json() == {'oidc_required': True, 'providers': []}
    assert browser.post('/api/auth/login', headers={'origin': 'https://hotel.example.invalid'}).status_code == 503


def test_origin_rejected_before_network(setup):
    _, browser = setup
    assert browser.post('/api/auth/login', headers={'origin': 'https://evil.example.invalid'}).status_code == 403


def test_rate_limit_persists_across_flow_consumption(setup):
    for _ in range(16):
        oidc.rate_limit('synthetic-client')
    with pytest.raises(HTTPException) as exc:
        oidc.rate_limit('synthetic-client')
    assert exc.value.status_code == 429


def test_session_binding_and_revocation(setup):
    factory, _ = setup
    with factory() as db:
        user = db.get(User, 'u1')
        session = LoginSession(token_hash=session_hash('synthetic'), user_id='u1', expires=time.time()+60)
        db.add(session)
        db.flush()
        with pytest.raises(HTTPException):
            recheck(db, user, session, session.token_hash)
        db.add(OIDCSession(token_hash=session.token_hash, issuer='https://id.example.invalid', subject='owner'))
        db.flush()
        assert recheck(db, user, session, session.token_hash).role == 'OWNER'
        with pytest.raises(HTTPException):
            recheck(db, user, session, session.token_hash, module='other')
        db.get(IdentityGrant, 'u1').revoked = 1
        db.flush()
        with pytest.raises(HTTPException):
            recheck(db, user, session, session.token_hash)


def test_callback_single_use_and_pkce(setup, monkeypatch):
    from urllib.parse import urlsplit, parse_qs
    factory, browser = setup
    captured = []
    async def metadata(_client, cfg):
        return {'authorization_endpoint': cfg['issuer']+'/authorize',
                'token_endpoint': cfg['issuer']+'/token', 'jwks_uri': cfg['issuer']+'/jwks'}
    class Transport:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, data):
            captured.append(data)
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {'id_token': 'synthetic'})
        async def get(self, url):
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {'keys': []})
    monkeypatch.setattr(oidc, 'metadata', metadata)
    monkeypatch.setattr(oidc, 'client', Transport)
    # Protocol transport test only: separate real-signature tests below.
    monkeypatch.setattr(oidc, 'validate_token', lambda *args: {'sub': 'owner', 'exp': time.time()+300})
    start = browser.post('/api/auth/login', headers={'origin': 'https://hotel.example.invalid'})
    assert start.status_code == 200
    params = parse_qs(urlsplit(start.json()['url']).query)
    assert params['code_challenge_method'] == ['S256']
    assert params['scope'] == ['openid email']
    state = params['state'][0]
    result = browser.get('/api/auth/callback', params={'state': state, 'code': 'synthetic-code'})
    assert result.status_code == 303
    assert 'code_verifier' in captured[0]
    cookie = result.headers.get('set-cookie')
    assert 'Secure' in cookie and 'HttpOnly' in cookie
    assert browser.get('/api/auth/callback', params={'state': state, 'code': 'synthetic-code'}).status_code == 403
    assert len(captured) == 1
    with factory() as db:
        assert db.scalar(select(LoginSession)) is not None


def test_real_signature_claim_validation():
    from authlib.jose import JsonWebKey, JsonWebToken
    key = JsonWebKey.generate_key('RSA', 2048, is_private=True)
    cfg = {'issuer': 'https://id.example.invalid', 'client_id': 'hotel'}
    claims = {'iss': cfg['issuer'], 'aud': 'hotel', 'sub': 'synthetic',
              'iat': int(time.time()), 'exp': int(time.time())+60, 'nonce': 'expected'}
    def token(values): return JsonWebToken(['RS256']).encode({'alg': 'RS256'}, values, key)
    assert oidc.validate_token(token(claims), key.as_dict(), cfg, 'expected')['sub'] == 'synthetic'
    for mutation in [{'iss': 'https://evil.example.invalid'}, {'aud': 'other'}, {'nonce': 'wrong'},
                     {'exp': int(time.time())-120}, {'azp': 'wrong'}]:
        with pytest.raises(Exception):
            oidc.validate_token(token({**claims, **mutation}), key.as_dict(), cfg, 'expected')


def test_jwks_rotation_bad_signature_unknown_key_and_missing_nonce():
    from authlib.jose import JsonWebKey, JsonWebToken
    old=JsonWebKey.generate_key('RSA',2048,is_private=True)
    new=JsonWebKey.generate_key('RSA',2048,is_private=True)
    cfg={'issuer':'https://id.example.invalid','client_id':'hotel'}
    claims={'iss':cfg['issuer'],'aud':['hotel','secondary'],'azp':'hotel','sub':'synthetic',
            'iat':int(time.time()),'exp':int(time.time())+60,'nonce':'bound'}
    keys={'keys':[{**old.as_dict(),'kid':'old'},{**new.as_dict(),'kid':'new'}]}
    jwt=JsonWebToken(['RS256'])
    for key,kid in ((old,'old'),(new,'new')):
        token=jwt.encode({'alg':'RS256','kid':kid},claims,key)
        assert oidc.validate_token(token,keys,cfg,'bound')['sub']=='synthetic'
    bad=jwt.encode({'alg':'RS256','kid':'old'},claims,new)
    with pytest.raises(Exception):oidc.validate_token(bad,keys,cfg,'bound')
    unknown=jwt.encode({'alg':'RS256','kid':'unknown'},claims,new)
    with pytest.raises(Exception):oidc.validate_token(unknown,keys,cfg,'bound')
    values={k:v for k,v in claims.items() if k!='nonce'}
    with pytest.raises(Exception):oidc.validate_token(jwt.encode({'alg':'RS256'},values,new),new.as_dict(),cfg,'bound')


def test_wrong_browser_cannot_consume_flow(setup):
    factory,browser=setup
    with factory() as db:
        db.add(oidc.LoginFlow(state_hash=session_hash('synthetic-state'),binding_hash=session_hash('binding'),
            nonce='n',verifier='v',expires=time.time()+60,client_hash='synthetic-client',invitation_hash=''))
        db.commit()
    browser.cookies.set(oidc.FLOW_COOKIE,'wrong-binding')
    result=browser.get('/api/auth/callback',params={'state':'synthetic-state','code':'synthetic-code'})
    assert result.status_code==403
    with factory() as db:
        assert db.get(oidc.LoginFlow,session_hash('synthetic-state')) is not None


def test_callback_query_redacted_without_disabling_access_log():
    import logging
    record=logging.LogRecord('uvicorn.access',logging.INFO,'',0,'%s - "%s %s HTTP/%s" %s',
        ('synthetic-client','GET','/api/auth/callback?code=SYNTHETIC_CODE&state=SYNTHETIC_STATE','1.1',303),None)
    assert oidc.RedactCallbackQuery().filter(record)
    assert '/api/auth/callback' in record.getMessage()
    assert 'SYNTHETIC_CODE' not in record.getMessage() and 'SYNTHETIC_STATE' not in record.getMessage()
