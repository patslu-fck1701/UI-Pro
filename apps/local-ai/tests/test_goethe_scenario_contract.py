"""Contract for the standalone *synthetic* Goethe 19-room/8-employee test fixture.

This is deliberately NOT a database seeder and never connects to Render, OpenAI,
the real Goethe Hotel, or an existing tenant. Codex may implement an opt-in,
tenant-scoped importer later after separate operator approval.
"""
import copy
import json
from collections import Counter
from pathlib import Path

import pytest


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "goethe_bad_pyrmont_scenario.json"


def scenario():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def validate_identity(data):
    assert data["classification"] == "SYNTHETIC_ONLY"
    assert data["schema"] == "werkz.hotel.test-scenario.v1"
    assert data["reference"]["room_count"] == 19
    assert data["reference"]["staff_count"] == 8
    assert data["reference"]["source_class"] == "USER_SUPPLIED_NOT_INDEPENDENTLY_VERIFIED"
    policy = data["import_policy"]
    assert policy["mode"] == "EXPLICIT_OPERATOR_ONLY"
    assert policy["live_database_import"] is False
    assert policy["allow_existing_tenant_reset"] is False
    assert policy["create_new_render_resources"] is False
    assert policy["idempotency_key"]


def validate_rooms(data):
    simulation = data["simulation"]
    rooms = simulation["rooms"]
    types = {row["id"]: row for row in simulation["room_types"]}
    assert len(rooms) == 19
    assert len({r["ref"] for r in rooms}) == len(rooms)
    assert len({r["number"] for r in rooms}) == len(rooms)
    assert all(r["type_id"] in types for r in rooms)
    assert all(not r["elevator_access"] for r in rooms)
    assert all(r["stairs_required"] == (r["floor"] > 0) for r in rooms)
    assert all(row["capacity"] >= 1 and row["nightly_cents"] > 0 for row in types.values())
    blocked = [r for r in rooms if r["status"] == "blocked"]
    assert len(blocked) == 1 and blocked[0]["number"] == "203"
    return {r["ref"] for r in rooms}, types, {r["ref"]: r for r in rooms}


def validate_staff(data):
    staff = data["simulation"]["staff"]
    assert len(staff) == 8
    assert len({e["ref"] for e in staff}) == len(staff)
    assert Counter(e["role"] for e in staff) == Counter({
        "management": 1, "reception": 2, "kitchen": 2, "housekeeping": 3
    })
    assert all(e["display_name"].startswith("SYNTHETISCH") for e in staff)
    return {e["ref"] for e in staff}


def validate_bookings(data):
    rooms, types, by_room = validate_rooms(data)
    bookings = data["simulation"]["bookings"]
    assert len(bookings) == 20
    assert len({booking["ref"] for booking in bookings}) == len(bookings)
    assert len({booking["guest_ref"] for booking in bookings}) == len(bookings)
    for booking in bookings:
        assert booking["synthetic"] is True
        assert booking["room_ref"] in rooms
        assert booking["arrival_day_offset"] < booking["departure_day_offset"]
        room = by_room[booking["room_ref"]]
        assert room["status"] != "blocked"
        assert booking["persons"] <= types[room["type_id"]]["capacity"]
        assert booking["state"] in {"checked_in", "confirmed"}
    # Checkout date is exclusive: turnover on the same day is valid.
    for i, first in enumerate(bookings):
        for second in bookings[i + 1:]:
            if first["room_ref"] != second["room_ref"]:
                continue
            assert (
                first["departure_day_offset"] <= second["arrival_day_offset"]
                or second["departure_day_offset"] <= first["arrival_day_offset"]
            ), (first["ref"], second["ref"])
    assert sum(b["state"] == "checked_in" and b["departure_day_offset"] == 0 for b in bookings) == 5
    assert sum(b["state"] == "confirmed" and b["arrival_day_offset"] == 0 for b in bookings) == 5


def validate_workload(data):
    simulation = data["simulation"]
    rooms, _, _ = validate_rooms(data)
    staff = validate_staff(data)
    tasks = simulation["cleaning_tasks"]
    assert len(tasks) == 9
    assert len({t["ref"] for t in tasks}) == len(tasks)
    assert sum(t["kind"] == "departure" for t in tasks) == 5
    assert sum(t["kind"] == "stayover" for t in tasks) == 4
    assert all(t["room_ref"] in rooms for t in tasks)
    assert all(t["assigned_staff_ref"] in {"hk-01", "hk-02", "hk-03"} for t in tasks)
    assert all(15 <= t["estimate_minutes"] <= 120 for t in tasks)
    shifts = simulation["shifts"]
    assert len(shifts) == 8 and {s["staff_ref"] for s in shifts} == staff
    assert all(s["timezone"] == "Europe/Berlin" for s in shifts)
    assert all(s["start_local"] < s["end_local"] for s in shifts)
    assert all(v["state"] in {"draft", "awaiting_owner_approval"} for v in simulation["vendor_tickets"])
    assert all(v["authorized_to_contact"] is False for v in simulation["vendor_tickets"])
    assert all(v["room_ref"] is None or v["room_ref"] in rooms for v in simulation["vendor_tickets"])
    assert all(v["quantity"] < v["minimum"] for v in simulation["inventory"])
    assert all(r["room_ref"] in rooms for r in simulation["guest_requests"])
    cases = {case["id"]: case for case in simulation["stress_cases"]}
    assert cases["housekeeper_absent"]["absent_staff_refs"] == ["hk-03"]
    assert cases["housekeeper_absent"]["expected_remaining_housekeepers"] == 2
    assert cases["blocked_plumbing"]["availability_must_exclude_blocked"] is True
    assert all(case.get("external_contact_allowed") is False for case in cases.values())
    assert simulation["capability_policy"]["external_vendor_calls"] == "OPERATOR_APPROVAL_REQUIRED"
    assert simulation["capability_policy"]["hotel_records_to_cloud"] == "DENY_BY_DEFAULT"


def test_goethe_scenario_metadata_and_no_implicit_live_write():
    validate_identity(scenario())


def test_goethe_has_exactly_19_distinct_synthetic_rooms():
    validate_rooms(scenario())


def test_goethe_has_exactly_8_employees_in_requested_roles():
    validate_staff(scenario())


def test_goethe_booking_turnover_has_no_double_booking_or_blocked_rooms():
    validate_bookings(scenario())


def test_goethe_workload_shifts_absence_and_external_approval_gates():
    validate_workload(scenario())


def test_conrad_second_phase_stays_out_of_goethe_import():
    data = scenario()
    deferred = data["deferred_scenario"]
    assert deferred["id"] == "conrad-hamburg-283"
    assert deferred["reference_room_count"] == 283
    assert deferred["status"] == "NOT_IMPORTED_SECOND_PHASE"
    assert all("conrad" not in row["ref"] for row in data["simulation"]["rooms"])


@pytest.mark.parametrize("mutation", ["extra_room", "duplicate_room", "unsafe_import"])
def test_contract_detects_unsafe_fixture_regressions(mutation):
    data = copy.deepcopy(scenario())
    if mutation == "extra_room":
        data["simulation"]["rooms"].append(dict(data["simulation"]["rooms"][0], ref="room-extra", number="999"))
        check = validate_rooms
    elif mutation == "duplicate_room":
        data["simulation"]["rooms"][1]["number"] = data["simulation"]["rooms"][0]["number"]
        check = validate_rooms
    else:
        data["import_policy"]["live_database_import"] = True
        check = validate_identity
    with pytest.raises(AssertionError):
        check(data)
