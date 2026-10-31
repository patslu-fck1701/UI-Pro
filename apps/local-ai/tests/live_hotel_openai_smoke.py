"""Operator-invoked paid smoke test. Never run in normal pytest or CI."""
import json
import os

from fastapi.testclient import TestClient

from backend.app import app


def main() -> None:
    origin = "http://testserver"
    headers = {"Origin": origin}
    with TestClient(app, base_url=origin) as client:
        setup = client.post("/api/setup", headers=headers,
                            json={"username": "synthetic-live-operator", "password": "synthetic-live-only"})
        if setup.status_code not in {201, 409}:
            raise RuntimeError(f"setup failed: {setup.status_code}")
        login = client.post("/api/login", headers=headers,
                            json={"username": "synthetic-live-operator", "password": "synthetic-live-only"})
        if login.status_code != 200:
            raise RuntimeError(f"login failed: {login.status_code}")
        snapshot = client.get("/api/hotel/snapshot")
        if snapshot.status_code != 200:
            raise RuntimeError(f"hotel init failed: {snapshot.status_code}")
        response = client.post("/api/hotel/ai/ask", headers=headers, json={
            "provider": "openai",
            "question": "Synthetischer Integrationstest: Nenne genau zwei kurze Schritte fuer eine saubere Rezeptionsuebergabe.",
        })
        body = response.json()
        if os.environ.get("WERKZ_EXPECT_OPENAI_BLOCKED") == "1":
            if response.status_code != 429:
                raise RuntimeError(f"expected budget block, got {response.status_code}")
            providers = client.get("/api/hotel/ai/providers").json()
            print(json.dumps({"status": response.status_code,
                              "detail": body.get("detail"),
                              "usage": providers.get("openaiUsage")}, ensure_ascii=True))
            return
        if response.status_code != 200:
            detail = body.get("detail", "no detail") if isinstance(body, dict) else "invalid body"
            raise RuntimeError(f"OpenAI hotel request failed: {response.status_code}: {detail}")
        print(json.dumps({
            "status": response.status_code,
            "provider": body.get("provider"),
            "model": body.get("model"),
            "answerChars": len(body.get("answer", "")),
            "verifiedHotelData": body.get("verifiedHotelData"),
            "createdReservation": body.get("createdReservation"),
            "usage": body.get("openaiUsage"),
        }, ensure_ascii=True))


if __name__ == "__main__":
    required = ["WERKZ_HOTEL_OPENAI_ENV_FILE", "WERKZ_HOTEL_OPENAI_ENABLED"]
    if any(not os.environ.get(name) for name in required):
        raise RuntimeError("live smoke environment is not explicitly enabled")
    main()
