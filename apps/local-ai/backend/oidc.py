"""OIDC code flow for existing Hotel users; no automatic account/Owner grant."""
import hashlib
import hmac
import os
import secrets
import time
import json
import logging
from urllib.parse import urlencode, urlsplit
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select, delete, String, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, Session, LoginSession, User
from .kundenz import IdentityGrant, OIDCSession, enabled, recheck
from .security import COOKIE_NAME, session_hash

router = APIRouter(prefix='/api/auth', tags=['identity'])
FLOW_COOKIE = '__Host-werkz-oidc'


class RedactCallbackQuery(logging.Filter):
    """Keep access logging without retaining OAuth codes/state query values."""
    def filter(self, record):
        if isinstance(record.args, tuple) and len(record.args) == 5:
            args = list(record.args)
            if isinstance(args[2], str) and args[2].split('?',1)[0] == '/api/auth/callback':
                args[2] = '/api/auth/callback'
                record.args = tuple(args)
        return True


logging.getLogger('uvicorn.access').addFilter(RedactCallbackQuery())


class LoginFlow(Base):
    __tablename__ = 'kundenz_login_flows'
    state_hash: Mapped[str] = mapped_column(String, primary_key=True)
    binding_hash: Mapped[str] = mapped_column(String)
    nonce: Mapped[str] = mapped_column(String)
    verifier: Mapped[str] = mapped_column(String)
    expires: Mapped[float] = mapped_column(Float)
    client_hash: Mapped[str] = mapped_column(String)
    invitation_hash: Mapped[str] = mapped_column(String, default='')


class LoginRate(Base):
    __tablename__ = 'kundenz_login_rates'
    client_hash: Mapped[str] = mapped_column(String, primary_key=True)
    started: Mapped[float] = mapped_column(Float)
    attempts: Mapped[int] = mapped_column(Integer)


def rate_limit(address):
    from .write_lock import begin_write
    with Session() as db:
        begin_write(db)
        stamp = time.time()
        db.execute(delete(LoginRate).where(LoginRate.started < stamp-900))
        bucket = db.get(LoginRate, address)
        if not bucket:
            bucket = LoginRate(client_hash=address, started=stamp, attempts=0)
            db.add(bucket)
        if bucket.attempts >= 16:
            raise HTTPException(429, 'Zu viele Anmeldeversuche.')
        bucket.attempts += 1
        db.commit()


def config():
    names = ('ISSUER', 'CLIENT_ID', 'REDIRECT_URI')
    values = {key.lower(): os.environ.get('WERKZ_OIDC_' + key, '') for key in names}
    if not enabled() or not all(values.values()):
        raise HTTPException(503, 'Online-Anmeldung nicht eingerichtet.')
    for key in ('issuer', 'redirect_uri'):
        u = urlsplit(values[key])
        if u.scheme != 'https' or not u.hostname or u.username or u.password or u.fragment or u.query:
            raise HTTPException(503, 'Online-Anmeldung nicht eingerichtet.')
    if urlsplit(values['redirect_uri']).path != '/api/auth/callback':
        raise HTTPException(503, 'Online-Anmeldung nicht eingerichtet.')
    return values


def trusted_endpoint(value, issuer):
    u, origin = urlsplit(value), urlsplit(issuer)
    if (u.scheme, u.netloc) != (origin.scheme, origin.netloc) or u.username or u.password or u.fragment:
        raise ValueError('untrusted endpoint')
    return value


async def metadata(client, cfg):
    r = await client.get(cfg['issuer'].rstrip('/') + '/.well-known/openid-configuration')
    r.raise_for_status()
    document = r.json()
    if document.get('issuer') != cfg['issuer'] or 'S256' not in document.get('code_challenge_methods_supported', []):
        raise ValueError('invalid issuer metadata')
    for key in ('authorization_endpoint', 'token_endpoint', 'jwks_uri'):
        trusted_endpoint(document[key], cfg['issuer'])
    return document


def client():
    return httpx.AsyncClient(timeout=10, trust_env=False, follow_redirects=False)


@router.get('/providers')
def providers():
    try:
        config()
        return {'oidc_required': enabled(), 'providers': [{'id': 'oidc', 'label': 'Mit WerkZ-Konto anmelden'}]}
    except HTTPException:
        return {'oidc_required': enabled(), 'providers': []}


@router.post('/login')
async def start(request: Request):
    cfg = config()
    redirect = urlsplit(cfg['redirect_uri'])
    if request.headers.get('origin') != f'{redirect.scheme}://{redirect.netloc}':
        raise HTTPException(403, 'Ungültige Anfrageherkunft.')
    state, binding, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(4))
    address = session_hash(request.client.host if request.client else 'unknown')
    rate_limit(address)
    try:
        payload = json.loads(await request.body() or b'{}')
        if not isinstance(payload, dict) or set(payload) - {'invitation'}:
            raise ValueError('invalid fields')
        invitation = payload.get('invitation', '')
        if not isinstance(invitation, str) or len(invitation) > 128:
            raise ValueError('invalid invitation')
    except (ValueError, TypeError):
        raise HTTPException(400, 'Anmeldedaten prüfen.') from None
    try:
        async with client() as transport:
            doc = await metadata(transport, cfg)
        with Session() as db:
            # Expired rows are retained for the 15-minute durable rate limit.
            db.execute(delete(LoginFlow).where(LoginFlow.expires < time.time() - 900))
            db.add(LoginFlow(state_hash=session_hash(state), binding_hash=session_hash(binding),
                             nonce=nonce, verifier=verifier, expires=time.time()+300, client_hash=address,
                             invitation_hash=session_hash(invitation) if invitation else ''))
            db.commit()
        import base64
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        url = doc['authorization_endpoint'] + '?' + urlencode(dict(
            client_id=cfg['client_id'], redirect_uri=cfg['redirect_uri'], response_type='code',
            scope='openid email', state=state, nonce=nonce, code_challenge=challenge, code_challenge_method='S256'))
        response = JSONResponse({'url': url})
        response.set_cookie(FLOW_COOKIE, binding, secure=True, httponly=True, samesite='lax', path='/', max_age=300)
        response.headers['Cache-Control'] = 'no-store'
        return response
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Online-Anmeldung derzeit nicht verfügbar.') from None


def validate_token(token, keys, cfg, nonce):
    from authlib.jose import JsonWebToken
    claims = JsonWebToken(['RS256', 'ES256']).decode(token, keys, claims_options={
        'iss': {'essential': True, 'value': cfg['issuer']},
        'sub': {'essential': True}, 'aud': {'essential': True, 'value': cfg['client_id']},
        'exp': {'essential': True}, 'iat': {'essential': True},
        'nonce': {'essential': True, 'value': nonce}})
    claims.validate(leeway=15)
    if not isinstance(claims['sub'], str) or not claims['sub'] or claims['iat'] > time.time()+15:
        raise ValueError('invalid subject or issued time')
    audiences = claims['aud']
    if (isinstance(audiences, list) and len(audiences) > 1) or 'azp' in claims:
        if claims.get('azp') != cfg['client_id']:
            raise ValueError('invalid authorized party')
    return claims


@router.get('/callback')
async def callback(request: Request, state: str = '', code: str = ''):
    cfg = config()
    if not state or len(state) > 256 or not code or len(code) > 4096:
        raise HTTPException(400, 'Anmeldung ungültig oder abgelaufen.')
    try:
        # DELETE RETURNING atomically consumes a browser-bound flow, including failures.
        with Session() as db:
            flow = db.execute(delete(LoginFlow).where(
                LoginFlow.state_hash == session_hash(state),
                LoginFlow.binding_hash == session_hash(request.cookies.get(FLOW_COOKIE, '')),
                LoginFlow.expires > time.time()).returning(LoginFlow.nonce, LoginFlow.verifier, LoginFlow.invitation_hash)).first()
            db.commit()
        if not flow:
            raise ValueError('invalid flow')
        async with client() as transport:
            doc = await metadata(transport, cfg)
            fields = dict(grant_type='authorization_code', code=code, client_id=cfg['client_id'],
                          redirect_uri=cfg['redirect_uri'], code_verifier=flow.verifier)
            secret = os.environ.get('WERKZ_OIDC_CLIENT_SECRET')
            if secret:
                fields['client_secret'] = secret
            r = await transport.post(doc['token_endpoint'], data=fields)
            r.raise_for_status()
            token = r.json()['id_token']
            r = await transport.get(doc['jwks_uri'])
            r.raise_for_status()
            claims = validate_token(token, r.json(), cfg, flow.nonce)
        with Session() as db:
            if flow.invitation_hash:
                from .test_customers import accept
                accept(db, flow.invitation_hash, claims, cfg['issuer'])
            grants = list(db.scalars(select(IdentityGrant).where(
                IdentityGrant.issuer == cfg['issuer'], IdentityGrant.subject == claims['sub'])))
            if len(grants) != 1:
                raise ValueError('no unique grant')
            grant = grants[0]
            user = db.get(User, grant.user_id)
            if not user:
                raise ValueError('no linked user')
            token = secrets.token_urlsafe(32)
            expiry = min(time.time()+28800, grant.expires, float(claims['exp']))
            session = LoginSession(token_hash=session_hash(token), user_id=user.id, expires=expiry)
            db.add(session)
            db.flush()
            db.add(OIDCSession(token_hash=session.token_hash, issuer=cfg['issuer'], subject=claims['sub']))
            db.flush()
            recheck(db, user, session, session.token_hash)
            # Rotate only the prior browser session; no IdP tokens are stored.
            previous = session_hash(request.cookies.get(COOKIE_NAME, ''))
            db.execute(delete(OIDCSession).where(OIDCSession.token_hash == previous))
            db.execute(delete(LoginSession).where(LoginSession.token_hash == previous))
            db.commit()
        response = RedirectResponse('/', status_code=303)
        response.set_cookie(COOKIE_NAME, token, secure=True, httponly=True, samesite='strict',
                            path='/', max_age=max(0, int(expiry-time.time())))
        response.delete_cookie(FLOW_COOKIE, secure=True, httponly=True, samesite='lax')
        response.headers.update({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'})
        return response
    except Exception:
        raise HTTPException(403, 'Anmeldung ungültig, abgelaufen oder nicht freigegeben.') from None
