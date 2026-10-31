"""Synthetic persistence and concurrency gates for Hotel OpenAI spending.

Tests use a temporary SQLite database, never an OpenAI key or a network call.
The same begin_write interface also has PostgreSQL dialect coverage elsewhere.
"""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import User
from backend.modules.hotel import assistant as ai
from backend.modules.hotel.models import Hotel, HotelAiUsage


@pytest.fixture
def budget_store(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite:///" + str(tmp_path / "hotel-budget.sqlite3"),
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    try:
        # Create only the three synthetic tables needed for budget accounting.
        # No production app migration, provider request, or shared DB is touched.
        for table in (User.__table__, Hotel.__table__, HotelAiUsage.__table__):
            table.create(engine)
        factory = sessionmaker(engine, expire_on_commit=False)
        monkeypatch.setattr(ai, "Session", factory)
        monkeypatch.setenv("WERKZ_HOTEL_OPENAI_CALL_LIMIT", "2")
        monkeypatch.setenv("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", "100000")
        with factory() as db:
            db.add_all([
                User(id="owner-a", username="owner-a", password_hash="synthetic",
                     role="admin", tenant="hotel-a"),
                User(id="owner-b", username="owner-b", password_hash="synthetic",
                     role="admin", tenant="hotel-b"),
                Hotel(tenant="hotel-a", name="Synthetic A"),
                Hotel(tenant="hotel-b", name="Synthetic B"),
            ])
            db.commit()
        yield factory
    finally:
        engine.dispose()


def owner(tenant="hotel-a"):
    return SimpleNamespace(tenant=tenant, id="owner-a" if tenant == "hotel-a" else "owner-b")


def test_budget_reservations_survive_new_sessions_and_remain_tenant_scoped(budget_store):
    first = ai._reserve_openai(owner(), "synthetic question")
    ai._finish_openai(first, "complete", {"prompt_tokens": 30, "completion_tokens": 10})
    second = ai._reserve_openai(owner(), "another synthetic question")

    # Reservation and actual usage must be persisted in independently opened DB sessions.
    with budget_store() as db:
        rows = db.query(HotelAiUsage).filter_by(tenant="hotel-a").all()
        assert {r.id for r in rows} == {first, second}
        assert next(r for r in rows if r.id == first).actual_microusd > 0
    assert ai._usage_status(owner())["calls"] == 2
    with pytest.raises(HTTPException) as error:
        ai._reserve_openai(owner(), "third must not reach provider")
    assert error.value.status_code == 429
    assert ai._usage_status(owner("hotel-b"))["calls"] == 0
    assert ai._reserve_openai(owner("hotel-b"), "separate hotel") != first


def test_budget_reservation_is_fail_closed_before_provider_dispatch(budget_store, monkeypatch):
    first = ai._reserve_openai(owner(), "synthetic")
    with budget_store() as db:
        reserved = db.get(HotelAiUsage, first).reserved_microusd
    monkeypatch.setenv("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", str(reserved * 2 - 1))
    with pytest.raises(HTTPException) as error:
        ai._reserve_openai(owner(), "synthetic")
    assert error.value.status_code == 429
    assert ai._usage_status(owner())["calls"] == 1


@pytest.mark.parametrize("name,value", [
    ("WERKZ_HOTEL_OPENAI_CALL_LIMIT", "0"),
    ("WERKZ_HOTEL_OPENAI_CALL_LIMIT", "-2"),
    ("WERKZ_HOTEL_OPENAI_CALL_LIMIT", "invalid"),
    ("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", "0"),
    ("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", "invalid"),
])
def test_invalid_limits_prevent_spend(budget_store, monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(HTTPException) as error:
        ai._reserve_openai(owner(), "synthetic")
    assert error.value.status_code == 503
    assert ai._usage_status(owner())["calls"] == 0


def test_simultaneous_requests_cannot_exceed_tenant_limit(budget_store):
    start = Barrier(6)

    def attempt():
        start.wait(timeout=15)
        try:
            return ("ok", ai._reserve_openai(owner(), "synthetic concurrent"))
        except HTTPException as error:
            return ("blocked", error.status_code)

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: attempt(), range(6)))

    assert sum(status == "ok" for status, _ in results) == 2
    assert sum(status == "blocked" and code == 429 for status, code in results) == 4
    assert ai._usage_status(owner())["calls"] == 2
