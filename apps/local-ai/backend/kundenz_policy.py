"""Server-side authorization policy. Inputs must come from verified OIDC/storage.

This module does not validate tokens or enable login by itself. Never populate
VerifiedIdentity or Grant from request JSON, email claims or frontend roles.
"""
from dataclasses import dataclass
from enum import Enum
from math import isfinite


class Role(str, Enum):
    OWNER = 'OWNER'
    CUSTOMER_ADMIN = 'CUSTOMER_ADMIN'
    CUSTOMER_USER = 'CUSTOMER_USER'
    TEST_CUSTOMER = 'TEST_CUSTOMER'


@dataclass(frozen=True)
class VerifiedIdentity:
    issuer: str
    subject: str


@dataclass(frozen=True)
class Grant:
    identity: VerifiedIdentity
    tenant: str
    role: Role
    modules: frozenset[str]
    expires_at: float
    revoked: bool = False


def allowed(identity, grant, *, owner, tenant, module, now,
            session_expires_at, session_revoked=False,
            classification='CUSTOMER_DATA'):
    """Fail closed; owner privilege never comes from a grant role alone.

    Denied callers must receive a generic response without asset metadata.
    All image bytes, previews, filenames and galleries use OWNER_PRIVATE.
    """
    if not isinstance(identity, VerifiedIdentity) or not identity.issuer or not identity.subject:
        return False
    if not isinstance(grant, Grant) or grant.identity != identity:
        return False
    if not all(isinstance(t, (int, float)) and not isinstance(t, bool) and isfinite(t)
               for t in (now, session_expires_at, grant.expires_at)):
        return False
    if session_revoked or grant.revoked or now >= min(session_expires_at, grant.expires_at):
        return False
    if not tenant or grant.tenant != tenant or not module or module not in grant.modules:
        return False
    if not isinstance(grant.role, Role):
        return False
    is_owner = (isinstance(owner, VerifiedIdentity) and bool(owner.issuer)
                and bool(owner.subject) and identity == owner and grant.role == Role.OWNER)
    if grant.role == Role.OWNER and not is_owner:
        return False
    if classification == 'OWNER_PRIVATE':
        return is_owner
    return classification == 'CUSTOMER_DATA'
