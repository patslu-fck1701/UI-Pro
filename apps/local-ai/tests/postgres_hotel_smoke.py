"""Isolated PostgreSQL 16 migration/booking/restart smoke for GitHub Actions.

Never connects to Render or a shared DB. It refuses any host other than
loopback and the exact synthetic 'hotel_ci' database before importing the app.
"""
import os
import subprocess
import sys
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.engine import make_url

DB_URL = os.environ.get("WERKZ_HOTEL_DATABASE_URL", "")
url = make_url(DB_URL) if DB_URL else None
if not (
    url is not None
    and url.host in {"localhost", "127.0.0.1"}
    and url.database == "hotel_ci"
    and os.environ.get("WERKZ_HOTEL_DB_SCHEMA") == "werkz_hotel_test"
    and os.environ.get("WERKZ_HOTEL_POSTGRES_ENABLED") == "1"
    and os.environ.get("WERKZ_AI_PACKAGE") == "hotel"
    and os.environ.get("WERKZ_AI_MODE") == "production"
):
    raise SystemExit("REFUSED: Only isolated localhost hotel_ci database is permitted.")

import psycopg

if len(sys.argv) == 1:
    # Provision ONLY the test schema in the disposable CI container.
    with psycopg.connect(DB_URL) as connection:
        connection.execute("CREATE SCHEMA werkz_hotel_test")
else:
    assert sys.argv[1] == "verify"

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, func

from backend.app import app
from backend.db import Session, engine
from backend.modules.hotel.models import Hotel, HotelAiUsage, Guest, Reservation, Room

with engine.connect() as connection:
    assert connection.exec_driver_sql("SELECT current_schema()").scalar() == "werkz_hotel_test"
    tables = set(inspect(connection).get_table_names(schema="werkz_hotel_test"))
    assert {"users", "hotel_hotels", "hotel_rooms", "hotel_ai_usage", "hotel_alembic_version"} <= tables
    assert not any(name.startswith("hotel_") for name in inspect(connection).get_table_names(schema="public"))

# A second process imports the app and runs the same Alembic upgrade again.
# It must be idempotent and must see the first process's committed records.
if len(sys.argv) > 1:
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(Hotel)) == 1
        assert db.scalar(select(func.count()).select_from(Room)) == 2
        assert db.scalar(select(func.count()).select_from(Reservation)) == 2
        assert db.scalar(select(func.count()).select_from(Guest)) == 2
        assert db.scalar(select(func.count()).select_from(HotelAiUsage)) == 0
    engine.dispose()
    print("PASS: isolated PostgreSQL schema, idempotent migrations and cross-process persistence")
    raise SystemExit(0)

with TestClient(app, headers={"origin": "http://testserver"}) as client:
    registered = client.post("/api/setup", json={"username": "ciowner", "password": "synthetic-password"})
    assert registered.status_code == 201, registered.text
    # Account creation deliberately does not mint a session; authenticate separately.
    logged_in = client.post("/api/login", json={"username": "ciowner", "password": "synthetic-password"})
    assert logged_in.status_code == 200, logged_in.text
    assert client.cookies, "Authenticated session cookie must be set"

    room_type = client.post("/api/hotel/room-types", json={
        "name": "Synthetic Room", "capacity": 2, "nightly_cents": 9900,
    })
    assert room_type.status_code == 201, room_type.text

    room = client.post("/api/hotel/rooms", json={
        "number": "CI-101", "type_id": room_type.json()["id"],
    })
    assert room.status_code == 201, room.text

    arrival = str(date.today() + timedelta(days=20))
    departure = str(date.today() + timedelta(days=22))
    booking = {
        "guest_name": "Synthetic CI Guest",
        "room_id": room.json()["id"],
        "arrival": arrival,
        "departure": departure,
        "persons": 1,
        "state": "confirmed",
        "breakfast": True,
    }
    first = client.post("/api/hotel/reservations", json=booking)
    assert first.status_code == 201, first.text
    second = client.post("/api/hotel/reservations", json=booking)
    assert second.status_code == 409, second.text
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(Guest)) == 1, "Rollback must remove duplicate guest"

    # Real PostgreSQL concurrent booking race on a fresh room.
    second_room = client.post("/api/hotel/rooms", json={
        "number": "CI-102", "type_id": room_type.json()["id"],
    })
    assert second_room.status_code == 201, second_room.text
    simultaneous = {**booking, "room_id": second_room.json()["id"]}

    def race_booking(_):
        with TestClient(app, headers={"origin": "http://testserver"}, cookies=client.cookies) as other:
            return other.post("/api/hotel/reservations", json=simultaneous).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(race_booking, range(2)))
    assert statuses == [201, 409], f"Concurrent booking outcomes: {statuses}"

# Prove data survives BOTH connection disposal and a new Python process.
engine.dispose()
subprocess.run([sys.executable, __file__, "verify"], check=True, timeout=90)
print("PASS: PostgreSQL concurrent booking collision, orphan rollback and new-process readback")
