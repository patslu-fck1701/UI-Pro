"""Operator-invoked local Qwen smoke test. Never run in normal pytest or CI."""
import json
import os
from pathlib import Path

from fastapi.testclient import TestClient

from backend import engine


def _external_engine_headers() -> dict[str, str]:
    location = Path(os.environ["WERKZ_ENGINE_KEY_FILE"])
    if not location.is_absolute() or location.is_symlink() or not location.is_file():
        raise RuntimeError("explicit local engine key file is unavailable")
    key = location.read_text(encoding="utf-8").strip()
    if not key or len(key) > 4096 or any(character.isspace() for character in key):
        raise RuntimeError("local engine key is invalid")
    return {"Authorization": "Bearer " + key}


engine.headers = _external_engine_headers
from backend.app import app  # noqa: E402


def main() -> None:
    origin = "http://testserver"
    headers = {"Origin": origin}
    with TestClient(app, base_url=origin) as client:
        credentials = {"username": "synthetic-qwen-operator", "password": "synthetic-qwen-only"}
        setup = client.post("/api/setup", headers=headers, json=credentials)
        if setup.status_code not in {201, 409}:
            raise RuntimeError(f"setup failed: {setup.status_code}")
        if client.post("/api/login", headers=headers, json=credentials).status_code != 200:
            raise RuntimeError("login failed")
        if client.get("/api/hotel/snapshot").status_code != 200:
            raise RuntimeError("hotel init failed")
        response = client.post("/api/hotel/ai/ask", headers=headers, json={
            "provider": "local",
            "question": "Synthetischer Integrationstest: Antworte genau mit WERKZ QWEN BEREIT.",
        })
        body = response.json()
        if response.status_code != 200:
            raise RuntimeError(f"local Hotel Qwen failed: {response.status_code}")
        print(json.dumps({"status": response.status_code,
                          "provider": body.get("provider"),
                          "model": body.get("model"),
                          "answerChars": len(body.get("answer", "")),
                          "verifiedHotelData": body.get("verifiedHotelData"),
                          "createdReservation": body.get("createdReservation")}, ensure_ascii=True))


if __name__ == "__main__":
    if not os.environ.get("WERKZ_ENGINE_KEY_FILE"):
        raise RuntimeError("explicit local engine key file is required")
    main()
