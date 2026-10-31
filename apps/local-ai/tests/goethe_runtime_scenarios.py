"""Executable Goethe Hotel scenario against the REAL Hotel API and isolated SQLite.

Never imports any reference into Render or an existing tenant. Runs only under an
ephemeral directory, with an artificial operator, artificial staff and guests.
"""
import json
import os
import sys
import tempfile
import uuid
from collections import Counter
from datetime import date, timedelta, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
fixture_path = Path(__file__).parent / "fixtures" / "goethe_bad_pyrmont_scenario.json"
fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
assert fixture["classification"] == "SYNTHETIC_ONLY"
assert fixture["import_policy"]["live_database_import"] is False
assert fixture["import_policy"]["allow_existing_tenant_reset"] is False
assert fixture["import_policy"]["create_new_render_resources"] is False

with tempfile.TemporaryDirectory(prefix="werkz-goethe-runtime-") as temporary:
    os.environ.update({
        "WERKZ_AI_DATA": temporary,
        "WERKZ_AI_PACKAGE": "hotel",
        "WERKZ_AI_MODE": "production",
        "WERKZ_ONLINE_TEST": "0",
        "WERKZ_HOTEL_POSTGRES_ENABLED": "0",
        "WERKZ_HOTEL_OPENAI_ENABLED": "0",
    })
    os.environ.pop("WERKZ_HOTEL_DATABASE_URL", None)
    os.environ.pop("OPENAI_API_KEY", None)
    from fastapi.testclient import TestClient
    from backend.app import app
    from backend.db import Session, User, engine
    from backend.security import hash_password
    from backend.modules.hotel.models import (
        Hotel, RoomType, Room, Employee, Guest, Reservation, Stay,
        HousekeepingTask, MaintenanceTicket, InventoryItem, Shift, GuestRequest,
    )
    from backend.modules.hotel.service import add

    sim = fixture["simulation"]
    origin = {"origin": "http://testserver"}
    day = date.today()
    def shifted(value):
        return str(day + timedelta(days=value))
    def must(response, code=200):
        assert response.status_code == code, (code, response.status_code, response.text[:800])
        return response.json()
    def counts(snapshot):
        return {
            "rooms": len(snapshot["rooms"]),
            "staff": len(snapshot["employees"]),
            "guests": len(snapshot["guests"]),
            "bookings": len(snapshot["reservations"]),
        }

    try:
        with TestClient(app, headers=origin) as operator:
            owner_creds = {"username": "synthetic_goethe_owner", "password": "synthetic-only-test"}
            must(operator.post("/api/setup", json=owner_creds), 201)
            must(operator.post("/api/login", json=owner_creds))
            initial = must(operator.get("/api/hotel/snapshot"))
            assert initial["mode"] == "production"
            assert not initial["rooms"] and not initial["guests"]
            tenant = must(operator.get("/api/me"))["tenant"]

            with Session() as db:
                hotel = db.get(Hotel, tenant)
                assert hotel is not None and not hotel.seeded
                hotel.name = "SYNTHETISCH · Goethe Hotel Bad Pyrmont (Testszenario)"
                room_types = {
                    kind["id"]: add(db, RoomType, tenant,
                        name=kind["label"], capacity=kind["capacity"],
                        nightly_cents=kind["nightly_cents"])
                    for kind in sim["room_types"]
                }
                rooms = {}
                for source in sim["rooms"]:
                    rooms[source["ref"]] = add(db, Room, tenant,
                        number=source["number"], type_id=room_types[source["type_id"]].id,
                        cleaning="dirty" if source["status"] == "occupied"
                            and source["ref"] in {t["room_ref"] for t in sim["cleaning_tasks"]}
                            else "ready",
                        blocked=source["block_reason"] or "" if source["status"] == "blocked" else "",
                    )
                staff = {}
                for source in sim["staff"]:
                    staff[source["ref"]] = add(db, Employee, tenant,
                        name=source["display_name"], department=source["department"],
                        qualification=source["qualification"])
                guests = {}
                reservations = {}
                for source in sim["bookings"]:
                    guest = add(db, Guest, tenant,
                        name="SYNTHETISCH · " + source["guest_ref"],
                        contact=source["guest_ref"] + "@hotel.example.invalid")
                    guests[source["guest_ref"]] = guest
                    room = rooms[source["room_ref"]]
                    kind = next(t for t in sim["rooms"] if t["ref"] == source["room_ref"])["type_id"]
                    res = add(db, Reservation, tenant,
                        guest_id=guest.id, room_id=room.id,
                        arrival=shifted(source["arrival_day_offset"]),
                        departure=shifted(source["departure_day_offset"]),
                        persons=source["persons"], breakfast=int(source["breakfast"]),
                        state=source["state"], nightly_cents=room_types[kind].nightly_cents)
                    reservations[source["ref"]] = res
                    if source["state"] == "checked_in":
                        add(db, Stay, tenant, reservation_id=res.id)
                for source in sim["cleaning_tasks"]:
                    add(db, HousekeepingTask, tenant,
                        room_id=rooms[source["room_ref"]].id,
                        employee_id=staff[source["assigned_staff_ref"]].id,
                        kind=source["kind"], priority=source["priority"],
                        estimate_minutes=source["estimate_minutes"], state=source["state"])
                for source in sim["shifts"]:
                    start = datetime.combine(day + timedelta(days=source["day_offset"]),
                        datetime.strptime(source["start_local"], "%H:%M").time(),
                        tzinfo=ZoneInfo(source["timezone"]))
                    end = datetime.combine(day + timedelta(days=source["day_offset"]),
                        datetime.strptime(source["end_local"], "%H:%M").time(),
                        tzinfo=ZoneInfo(source["timezone"]))
                    add(db, Shift, tenant, employee_id=staff[source["staff_ref"]].id,
                        start=start.isoformat(), end=end.isoformat())
                for source in sim["inventory"]:
                    add(db, InventoryItem, tenant, name=source["name"],
                        location=source["location"], unit=source["unit"],
                        quantity=source["quantity"], minimum=source["minimum"])
                for source in sim["guest_requests"]:
                    add(db, GuestRequest, tenant, room_id=rooms[source["room_ref"]].id,
                        kind=source["kind"], text=source["description"])
                for source in sim["vendor_tickets"]:
                    if source["kind"] == "plumbing":
                        add(db, MaintenanceTicket, tenant,
                            room_id=rooms[source["room_ref"]].id,
                            title=source["description"], priority="urgent",
                            blocking=1, state="open")
                # No emails, outbound calls, vendor orders or cloud model calls.
                # Vendor approvals exist only as unexecuted reference proposals.
                assert all(not proposal["authorized_to_contact"] for proposal in sim["vendor_tickets"])
                db.commit()

            snapshot = must(operator.get("/api/hotel/snapshot"))
            assert counts(snapshot) == {"rooms": 19, "staff": 8, "guests": 20, "bookings": 20}
            assert Counter(e["department"] for e in snapshot["employees"]) == Counter({
                "Management": 1, "Rezeption": 2, "Küche": 2, "Housekeeping": 3,
            })
            assert snapshot["metrics"]["occupied"] == 15
            assert snapshot["metrics"]["rooms"] == 19
            assert snapshot["metrics"]["blocked"] == 1
            assert snapshot["metrics"]["arrivals"] == 5
            assert snapshot["metrics"]["departures"] == 5
            assert len(snapshot["tasks"]) == 9
            assert len(snapshot["shifts"]) == 8
            assert len(snapshot["tickets"]) == 1
            assert len(snapshot["inventory"]) == 3
            assert all(item["quantity"] < item["minimum"] for item in snapshot["inventory"])
            assert len(snapshot["requests"]) == 3
            assert all(r["number"] != "203" or r["status"] == "blocked" for r in snapshot["rooms"])
            assert all(not reservation["guest_id"].startswith("real") for reservation in snapshot["reservations"])

            availability = must(operator.get("/api/hotel/availability", params={
                "arrival": shifted(0), "departure": shifted(2), "persons": 1,
            }))
            available_numbers = {r["number"] for r in availability["rooms"]}
            assert "203" not in available_numbers
            assert available_numbers == {"204", "205", "206"}, available_numbers

            focused = must(operator.get("/api/hotel/context", params={"q": "Zimmer 203"}))["data"]
            assert [r["number"] for r in focused["rooms"]] == ["203"]
            assert focused["rooms"][0]["status"] == "blocked"
            assert "metrics" not in focused

            # An occupied room must not accept a competing confirmed booking.
            duplicate = operator.post("/api/hotel/reservations", json={
                "guest_id": guests["fake-guest-01"].id,
                "room_id": rooms["room-101"].id,
                "arrival": shifted(0), "departure": shifted(1),
                "persons": 1, "state": "confirmed",
            })
            must(duplicate, 409)
            assert counts(must(operator.get("/api/hotel/snapshot"))) == counts(snapshot)
            must(operator.post("/api/hotel/demo/reset", json={}), 403)

            # A real role guard is exercised, not just a UI label.
            with Session() as db:
                housekeeping = User(id=str(uuid.uuid4()),
                    username="synthetic_goethe_housekeeper",
                    password_hash=hash_password("synthetic-only-test"),
                    role="hotel_housekeeping", tenant=tenant)
                db.add(housekeeping)
                employee = db.get(Employee, staff["hk-01"].id)
                employee.user_id = housekeeping.id
                other_tenant = User(id=str(uuid.uuid4()),
                    username="synthetic_goethe_other_tenant",
                    password_hash=hash_password("synthetic-only-test"),
                    role="hotel_reception", tenant=str(uuid.uuid4()))
                db.add(other_tenant)
                db.commit()

            with TestClient(app, headers=origin) as worker:
                must(worker.post("/api/login", json={
                    "username": "synthetic_goethe_housekeeper",
                    "password": "synthetic-only-test",
                }))
                own = must(worker.get("/api/hotel/snapshot"))
                assert "guests" not in own and "reservations" not in own
                assert "invoices" not in own and "shifts" not in own
                assert {t["employee_id"] for t in own["tasks"]} == {staff["hk-01"].id}
                must(worker.post("/api/hotel/reservations", json={
                    "guest_id": guests["fake-guest-01"].id,
                    "room_id": rooms["room-204"].id,
                    "arrival": shifted(0), "departure": shifted(1),
                    "persons": 1, "state": "confirmed",
                }), 403)
            with TestClient(app, headers=origin) as foreign:
                must(foreign.post("/api/login", json={
                    "username": "synthetic_goethe_other_tenant",
                    "password": "synthetic-only-test",
                }))
                foreign_snapshot = must(foreign.get("/api/hotel/snapshot"))
                assert not foreign_snapshot["rooms"]
                assert foreign_snapshot["hotel"] != snapshot["hotel"]
                must(foreign.get("/api/hotel/context", params={"q": "Zimmer 203"}))["data"]

            assert counts(must(operator.get("/api/hotel/snapshot"))) == counts(snapshot)
            print("PASS GOETHE REAL API + SQLITE: 19 rooms, 8 synthetic staff, 20 bookings; 5 arrivals/departures, no blocked-room sale, occupancy, housekeeping, staff permissions, tenant isolation, production demo reset denied.")
    finally:
        engine.dispose()
