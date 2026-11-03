"""Persistent authorization rechecks for OIDC-backed Hotel sessions."""
import json
import os
import time
from sqlalchemy import String, Float, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from fastapi import HTTPException
from .db import Base
from .kundenz_policy import VerifiedIdentity, Grant, Role, allowed


class IdentityGrant(Base):
    __tablename__ = 'kundenz_grants'
    __table_args__ = (UniqueConstraint('issuer', 'subject', name='uq_kundenz_identity'),)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    issuer: Mapped[str] = mapped_column(String)
    subject: Mapped[str] = mapped_column(String)
    tenant: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    modules: Mapped[str] = mapped_column(String)
    expires: Mapped[float] = mapped_column(Float)
    revoked: Mapped[int] = mapped_column(Integer, default=0)


class OIDCSession(Base):
    __tablename__ = 'kundenz_sessions'
    token_hash: Mapped[str] = mapped_column(ForeignKey('sessions.token_hash', ondelete='CASCADE'), primary_key=True)
    issuer: Mapped[str] = mapped_column(String)
    subject: Mapped[str] = mapped_column(String)


def enabled():
    return os.environ.get('WERKZ_AUTH_MODE') == 'oidc' or os.environ.get('WERKZ_ONLINE_TEST') == '1'


def recheck(db, user, session, token_hash, *, module='hotel', classification='CUSTOMER_DATA'):
    """Only persisted session binding can supply authenticated issuer/subject."""
    binding = db.get(OIDCSession, token_hash)
    record = db.get(IdentityGrant, user.id)
    if not binding or not record or record.tenant != user.tenant:
        raise HTTPException(403, 'Zugriff nicht freigegeben.')
    try:
        identity = VerifiedIdentity(binding.issuer, binding.subject)
        owner = VerifiedIdentity(os.environ.get('WERKZ_OWNER_ISSUER', ''),
                                 os.environ.get('WERKZ_OWNER_SUBJECT', ''))
        modules = json.loads(record.modules)
        if not isinstance(modules, list) or any(not isinstance(m, str) for m in modules):
            raise ValueError('invalid modules')
        grant = Grant(VerifiedIdentity(record.issuer, record.subject), record.tenant,
                      Role(record.role), frozenset(modules), record.expires, bool(record.revoked))
        if grant.role != Role.OWNER and user.role == 'admin':
            raise ValueError('customer cannot inherit legacy operator role')
        decision = allowed(identity, grant, owner=owner, tenant=user.tenant, module=module,
                           now=time.time(), session_expires_at=session.expires,
                           classification=classification)
    except (ValueError, TypeError):
        decision = False
    if not decision:
        raise HTTPException(403, 'Zugriff nicht freigegeben.')
    return record
