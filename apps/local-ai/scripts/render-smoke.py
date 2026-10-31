"""Read-only Render deployment smoke checks; never logs URLs with credentials."""
import os
import sys
import httpx


def main():
    base = os.environ.get("WERKZ_RENDER_TEST_URL", "").rstrip("/")
    if not base.startswith("https://"):
        raise SystemExit("WERKZ_RENDER_TEST_URL must be an HTTPS test URL")
    timeout = httpx.Timeout(8.0, connect=3.0)
    with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
        health = client.get(base + "/api/health")
        health.raise_for_status()
        ready = client.get(base + "/api/ready")
        ready.raise_for_status()
    body = ready.json()
    if body.get("state") != "READY" or body.get("database") != "ready":
        raise SystemExit("Render test service is not ready")
    print("PASS: HTTPS health and database readiness endpoints")


if __name__ == "__main__":
    main()
