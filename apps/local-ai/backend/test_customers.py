"""Owner-managed invitations. No mail/provider calls; tokens are shown once."""
import json
import secrets
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import String, Float, Integer, select, delete
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, Session, User, LoginSession, ModuleConfig
from .security import current_user, session_hash
from .kundenz import IdentityGrant, OIDCSession, enabled
from .modules.registry import audit
from .write_lock import begin_write

router = APIRouter(prefix='/api/auth/owner', tags=['test-customers'])


class Invitation(Base):
    __tablename__ = 'kundenz_invitations'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True)
    recipient: Mapped[str] = mapped_column(String)
    tenant: Mapped[str] = mapped_column(String, unique=True)
    expires: Mapped[float] = mapped_column(Float)
    access_expires: Mapped[float] = mapped_column(Float)
    modules: Mapped[str] = mapped_column(String)
    revoked: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[int] = mapped_column(Integer, default=0)


def owner(user=Depends(current_user)):
    if not enabled() or getattr(user, 'kundenz_role', None) != 'OWNER':
        raise HTTPException(403, 'Owner erforderlich.')
    return user


class InviteInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    recipient: str = Field(min_length=3, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    recipient_confirmed: bool
    duration_hours: int = Field(ge=1, le=168)
    modules: list[str] = Field(min_length=1, max_length=1)


@router.get('/customers')
def customers(user=Depends(owner)):
    with Session() as db:
        return [{'id': r.id, 'recipient': r.recipient, 'expires': r.access_expires,
                 'modules': json.loads(r.modules), 'revoked': bool(r.revoked),
                 'accepted': bool(r.consumed)} for r in db.scalars(select(Invitation))]


@router.post('/customers', status_code=201)
def invite(data: InviteInput, user=Depends(owner)):
    if not data.recipient_confirmed or data.modules != ['hotel']:
        raise HTTPException(400, 'Bestätigten Empfänger und Hotelmodul auswählen.')
    token = secrets.token_urlsafe(32)
    stamp = time.time()
    row = Invitation(id=str(uuid.uuid4()), token_hash=session_hash(token), recipient=data.recipient.lower(),
                     tenant='synthetic-'+str(uuid.uuid4()), expires=stamp+3600,
                     access_expires=stamp+data.duration_hours*3600,
                     modules=json.dumps(data.modules), revoked=0, consumed=0)
    with Session() as db:
        begin_write(db)
        db.add(row)
        audit(db, user, 'kundenz.invitation.created', row.id)
        db.commit()
    return {'id': row.id, 'token': token, 'expires': row.expires, 'sent': False}


@router.post('/customers/{identifier}/revoke')
def revoke(identifier: str, user=Depends(owner)):
    with Session() as db:
        begin_write(db)
        row = db.get(Invitation, identifier)
        if not row:
            raise HTTPException(404, 'Testzugang nicht gefunden.')
        row.revoked = 1
        for grant in db.scalars(select(IdentityGrant).where(IdentityGrant.tenant == row.tenant)):
            grant.revoked = 1
            tokens = select(LoginSession.token_hash).where(LoginSession.user_id == grant.user_id)
            db.execute(delete(OIDCSession).where(OIDCSession.token_hash.in_(tokens)))
            db.execute(delete(LoginSession).where(LoginSession.user_id == grant.user_id))
        audit(db, user, 'kundenz.invitation.revoked', row.id)
        db.commit()
    return {'revoked': True}


def accept(db, token_hash, claims, issuer):
    """Called only after cryptographic OIDC verification, within login transaction."""
    begin_write(db)
    row = db.scalar(select(Invitation).where(Invitation.token_hash == token_hash).with_for_update())
    if (not row or row.revoked or row.consumed or row.expires <= time.time()
            or row.access_expires <= time.time() or claims.get('email_verified') is not True
            or not isinstance(claims.get('email'), str) or claims['email'].lower() != row.recipient):
        raise ValueError('invitation denied')
    if db.scalar(select(IdentityGrant).where(IdentityGrant.issuer == issuer,
                                           IdentityGrant.subject == claims['sub'])):
        raise ValueError('identity already bound')
    identifier = str(uuid.uuid4())
    user = User(id=identifier, username='oidc-'+identifier, password_hash='disabled',
                role='hotel_reception', tenant=row.tenant)
    db.add(user)
    db.flush()
    db.add(IdentityGrant(user_id=user.id, issuer=issuer, subject=claims['sub'], tenant=row.tenant,
                         role='TEST_CUSTOMER', modules=row.modules, expires=row.access_expires, revoked=0))
    db.add(ModuleConfig(tenant=row.tenant, modules=json.dumps({'hotel_ai': True})))
    from .modules.hotel.models import Hotel, RoomType, Room
    db.add(Hotel(tenant=row.tenant, name='SYNTHETISCH · Testhotel', seeded=1, settings='{}'))
    kind = RoomType(id=str(uuid.uuid4()), tenant=row.tenant, name='SYNTHETISCH · Doppelzimmer',
                    capacity=2, nightly_cents=10000)
    db.add(kind)
    db.flush()
    for number in ('TEST-101', 'TEST-102'):
        db.add(Room(id=str(uuid.uuid4()), tenant=row.tenant, number=number, type_id=kind.id))
    row.consumed = 1
    audit(db, user, 'kundenz.invitation.accepted', row.id)
    db.flush()
    return user
