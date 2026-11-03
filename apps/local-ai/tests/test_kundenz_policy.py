from dataclasses import replace
import pytest
from backend.kundenz_policy import VerifiedIdentity, Grant, Role, allowed

OWNER = VerifiedIdentity('https://identity.example.invalid', 'fixed-owner-subject')
CUSTOMER = VerifiedIdentity(OWNER.issuer, 'customer-subject')

def check(identity=OWNER, role=Role.OWNER, **changes):
    grant = Grant(identity, 'synthetic-a', role, frozenset({'hotel'}), 200)
    options = dict(owner=OWNER, tenant='synthetic-a', module='hotel', now=100,
                   session_expires_at=150, classification='OWNER_PRIVATE')
    if 'grant' in changes:
        grant = changes.pop('grant')
    options.update(changes)
    return allowed(identity, grant, **options)

def test_pinned_owner_can_access_private_assets():
    assert check()

@pytest.mark.parametrize('role', list(Role))
def test_other_identity_never_gets_owner_assets_even_with_owner_role(role):
    assert not check(CUSTOMER, role)

@pytest.mark.parametrize('change', [
    {'tenant': 'synthetic-b'}, {'module': 'other'}, {'owner': None},
    {'owner': VerifiedIdentity('https://other.example.invalid', OWNER.subject)},
    {'now': 150}, {'now': 200}, {'now': float('nan')},
    {'session_revoked': True}, {'classification': 'unknown'},
])
def test_private_access_fails_closed(change):
    assert not check(**change)

def test_revoked_or_wrong_identity_grants_denied():
    grant = Grant(OWNER, 'synthetic-a', Role.OWNER, frozenset({'hotel'}), 200)
    assert not check(grant=replace(grant, revoked=True))
    assert not check(grant=replace(grant, identity=CUSTOMER))

@pytest.mark.parametrize('role', [Role.CUSTOMER_ADMIN, Role.CUSTOMER_USER, Role.TEST_CUSTOMER])
def test_customer_roles_only_access_their_granted_module_and_tenant(role):
    assert check(CUSTOMER, role, classification='CUSTOMER_DATA')
    assert not check(CUSTOMER, role, classification='CUSTOMER_DATA', tenant='synthetic-b')
