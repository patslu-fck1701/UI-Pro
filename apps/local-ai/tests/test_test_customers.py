import time
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from backend.db import Base, User
from backend import test_customers as customers
from backend.kundenz import IdentityGrant
from backend.modules.hotel.models import Room
from backend.security import session_hash


@pytest.fixture
def store(monkeypatch):
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(customers, 'Session', factory)
    monkeypatch.setenv('WERKZ_AUTH_MODE', 'oidc')
    yield factory
    engine.dispose()


def test_owner_gate_rejects_legacy_admin_and_customer():
    for role in (None, 'CUSTOMER_ADMIN', 'CUSTOMER_USER', 'TEST_CUSTOMER'):
        with pytest.raises(HTTPException):
            customers.owner(SimpleNamespace(role='admin', kundenz_role=role))


def test_two_invitations_create_separate_synthetic_data_and_revoke(store):
    owner = SimpleNamespace(id='owner', tenant='owner-tenant', kundenz_role='OWNER')
    results = []
    for email in ('one@example.invalid', 'two@example.invalid'):
        results.append(customers.invite(customers.InviteInput(recipient=email,
            recipient_confirmed=True, duration_hours=24, modules=['hotel']), owner))
    with store() as db:
        rows = list(db.scalars(select(customers.Invitation)))
        assert rows[0].tenant != rows[1].tenant
        assert all(r.token_hash != result['token'] for r, result in zip(rows, results))
    for index, result in enumerate(results):
        with store() as db:
            user = customers.accept(db, session_hash(result['token']),
                {'sub': 'sub-'+str(index), 'email_verified': True,
                 'email': ('one@example.invalid', 'two@example.invalid')[index]}, 'https://id.example.invalid')
            db.commit()
            assert len(list(db.scalars(select(Room).where(Room.tenant == user.tenant)))) == 2
        with store() as db:
            with pytest.raises(ValueError):
                customers.accept(db, session_hash(result['token']), {}, 'https://id.example.invalid')
    customers.revoke(results[0]['id'], owner)
    with store() as db:
        grants = list(db.scalars(select(IdentityGrant).order_by(IdentityGrant.subject)))
        assert grants[0].revoked == 1 and grants[1].revoked == 0


@pytest.mark.parametrize('claims', [
    {'sub': 'a', 'email_verified': False, 'email': 'one@example.invalid'},
    {'sub': 'a', 'email_verified': True, 'email': 'other@example.invalid'},
    {'sub': 'a'},
])
def test_invitation_requires_confirmed_recipient(store, claims):
    result = customers.invite(customers.InviteInput(recipient='one@example.invalid',
        recipient_confirmed=True, duration_hours=1, modules=['hotel']), SimpleNamespace(id='owner', tenant='owner'))
    with store() as db:
        with pytest.raises(ValueError):
            customers.accept(db, session_hash(result['token']), claims, 'https://id.example.invalid')
        assert db.scalar(select(User)) is None


def test_role_module_expiry_updates_and_stale_update_denied(store):
    owner=SimpleNamespace(id='owner',tenant='owner')
    invite=customers.invite(customers.InviteInput(recipient='one@example.invalid',
        recipient_confirmed=True,duration_hours=1,modules=['hotel']),owner)
    with store() as db:
        user=customers.accept(db,session_hash(invite['token']),{'sub':'test-sub',
            'email':'one@example.invalid','email_verified':True},'https://id.example.invalid')
        db.commit()
        uid=user.id
        expires=db.get(customers.Invitation,invite['id']).access_expires
    data=customers.UpdateAccess(expected_expires=expires,duration_hours=24,
                                role='CUSTOMER_ADMIN',modules=['hotel'])
    assert customers.update_access(invite['id'],data,owner)['relogin_required']
    with store() as db:
        assert db.get(User,uid).role=='hotel_administrator'
        assert db.get(IdentityGrant,uid).role=='CUSTOMER_ADMIN'
        assert db.get(IdentityGrant,uid).expires>expires
    with pytest.raises(HTTPException) as exc:
        customers.update_access(invite['id'],data,owner)
    assert exc.value.status_code==409
