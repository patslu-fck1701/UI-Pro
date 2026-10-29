import hashlib
import hmac
import secrets
import time
from fastapi import HTTPException, Request
from sqlalchemy import select
from .db import Session, User, LoginSession

def hash_password(value: str) -> str:
    salt=secrets.token_bytes(16)
    digest=hashlib.scrypt(value.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return salt.hex()+':'+digest.hex()
def verify_password(value: str, encoded: str) -> bool:
    try:
        salt,expected=encoded.split(':')
        digest=hashlib.scrypt(value.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1,dklen=32)
        return hmac.compare_digest(digest.hex(),expected)
    except (ValueError, TypeError):
        return False
def session_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()
from .db import PACKAGE
COOKIE_NAME='werkz_hotel_program' if PACKAGE=='hotel' else 'werkz_ai_hotel' if PACKAGE=='hotel-demo' else 'werkz_ai_scrap' if PACKAGE=='schrotties-demo' else 'werkz_ai'
def current_user(request: Request) -> User:
    token=request.cookies.get(COOKIE_NAME,'')
    with Session() as db:
        session=db.get(LoginSession,session_hash(token))
        if not session or session.expires<time.time():
            raise HTTPException(401,'Bitte anmelden.')
        user=db.get(User,session.user_id)
        if not user:
            raise HTTPException(401,'Bitte anmelden.')
        expected_actor=request.headers.get('x-werkz-actor')
        expected_tenant=request.headers.get('x-werkz-tenant')
        if (expected_actor and expected_actor!=user.id) or (expected_tenant and expected_tenant!=user.tenant):
            raise HTTPException(409,'Kontowechsel erkannt. Vorgang gehört zu einer anderen Sitzung.')
        return user
