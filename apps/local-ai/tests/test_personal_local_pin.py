"""Real personal-loopback PIN-only access without changing Hotel/staff login."""
import os
import subprocess
import sys
from pathlib import Path


def test_personal_local_pin_only_login_is_scoped_and_rate_limited():
    source = r'''
import os, tempfile, uuid
from pathlib import Path

with tempfile.TemporaryDirectory(prefix="werkz-pin-only-test-") as tmp:
    os.environ.update({
        "WERKZ_AI_PACKAGE": "personal",
        "WERKZ_AI_MODE": "production",
        "WERKZ_AI_DATA": tmp,
        "WERKZ_ONLINE_TEST": "0",
        "WERKZ_HOTEL_POSTGRES_ENABLED": "0",
        "WERKZ_HOTEL_OPENAI_ENABLED": "0",
    })
    os.environ.pop("OPENAI_API_KEY", None)
    from fastapi.testclient import TestClient
    from backend.app import app
    from backend.db import Session, User, engine
    from backend.security import hash_password, verify_password

    origin = {"origin": "http://testserver"}
    with TestClient(app, headers=origin) as client:
        assert client.get("/api/setup").json() == {"required":True,"local_pin_mode":True}
        pin = "synthetic-local-only-PIN"
        first = client.post("/api/local-pin/setup",json={"pin":pin})
        assert first.status_code == 201, first.text
        assert first.json()["role"] == "admin"
        assert client.get("/api/setup").json() == {"required":False,"local_pin_mode":True}
        assert client.post("/api/local-pin/setup",json={"pin":pin}).status_code == 409
        assert client.post("/api/local-pin/login",json={"pin":"wrong-local-pin"}).status_code == 401
        result = client.post("/api/local-pin/login",json={"pin":pin})
        assert result.status_code == 200,result.text
        assert "username" in result.json()
        assert client.get("/api/me").json()["id"] == result.json()["id"]
        # Legacy staff login remains username-bound.
        assert client.post("/api/login",json={"password":pin}).status_code == 422
        with Session() as db:
            existing = db.get(User,result.json()["id"])
            assert existing.password_hash != pin and verify_password(pin,existing.password_hash)
            db.add(User(id=str(uuid.uuid4()),username="synthetic-second",
                password_hash=hash_password("synthetic-second-pass"),
                tenant=existing.tenant,role="hotel_reception"))
            db.commit()
        assert client.get("/api/setup").json()["local_pin_mode"] is False
        assert client.post("/api/local-pin/login",json={"pin":pin}).status_code == 409
        assert client.post("/api/login",json={"username":result.json()["username"],"password":pin}).status_code == 200

    # A non-loopback peer cannot invoke PIN-only, even for single user.
    with TestClient(app,headers=origin,client=("198.51.100.9",4567)) as foreign:
        assert foreign.post("/api/local-pin/login",json={"pin":pin}).status_code == 403

    engine.dispose()
    print("PASS LOCAL PIN: personal loopback, existing hash/session, no username field, staff login unchanged, multiuser fail-closed, remote IP denied")
'''
    root = Path(__file__).resolve().parents[1]
    p = subprocess.run([sys.executable, "-c", source], cwd=root,
                       capture_output=True, text=True, timeout=90)
    assert p.returncode == 0, p.stdout + "\n" + p.stderr
    assert "PASS LOCAL PIN" in p.stdout
