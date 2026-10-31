"""Fail-closed, offline configuration preflight for the WerkZ Hotel online test.

Reads environment variables only. No network, database, secrets file or provider
requests. Prints variable NAMES and status only, never values, URLs or credentials.
This check does NOT approve a deployment or prove a live Qwen bridge.
"""
import argparse
import os
import sys
from urllib.parse import urlsplit

# WERKZ-BRIDGE-1 currently authorizes this specific preview origin and route.
# A generic user-supplied HTTPS endpoint is NOT sufficient protection from SSRF.
APPROVED_BRIDGE_HOST = "project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app"
APPROVED_BRIDGE_PATH = "/api/public/local-ai/ask"


def _positive_int(raw: str | None) -> bool:
    try:
        return raw is not None and int(raw) > 0
    except (TypeError, ValueError):
        return False


def _https_endpoint(raw: str) -> bool:
    if not raw or any(c.isspace() for c in raw):
        return False
    try:
        parsed = urlsplit(raw)
        host = parsed.hostname
        return (
            parsed.scheme == "https"
            and host == APPROVED_BRIDGE_HOST
            and parsed.netloc == APPROVED_BRIDGE_HOST
            and parsed.username is None
            and parsed.password is None
            and parsed.port is None
            and parsed.path == APPROVED_BRIDGE_PATH
            and not parsed.query
            and not parsed.fragment
        )
    except ValueError:
        return False


def assess(env: dict[str, str]) -> tuple[list[str], list[str]]:
    """Return only symbolic check IDs; never secret-containing environment values."""
    failed = []
    waiting = []
    if env.get("WERKZ_AI_PACKAGE") != "hotel":
        failed.append("HOTEL_PACKAGE")
    if env.get("WERKZ_AI_MODE") != "production":
        failed.append("HOTEL_MODE")
    if env.get("WERKZ_ONLINE_TEST") != "1":
        failed.append("ONLINE_BOUNDARY")

    host = env.get("RENDER_EXTERNAL_HOSTNAME", "")
    if not (
        host.endswith(".onrender.com")
        and host.count(".") >= 2
        and not any(c in host for c in "/:@\\?# \t\n")
    ):
        failed.append("RENDER_HOST")

    if env.get("WERKZ_HOTEL_POSTGRES_ENABLED") != "1":
        failed.append("POSTGRES_ENABLED")
    if env.get("WERKZ_HOTEL_DB_SCHEMA") != "werkz_hotel_test":
        failed.append("POSTGRES_ISOLATED_SCHEMA")
    db_url = env.get("WERKZ_HOTEL_DATABASE_URL", "")
    try:
        db = urlsplit(db_url)
        safe_db = (
            db.scheme in {"postgresql", "postgresql+psycopg"}
            and bool(db.hostname)
            and bool(db.path.strip("/"))
            and db.username is not None
            and db.hostname not in {"localhost", "127.0.0.1", "::1"}
        )
    except ValueError:
        safe_db = False
    if not safe_db:
        failed.append("POSTGRES_CONNECTION")

    openai_state = env.get("WERKZ_HOTEL_OPENAI_ENABLED", "0")
    if openai_state not in {"0", "1"}:
        failed.append("OPENAI_SWITCH")
    elif openai_state == "1":
        if not env.get("OPENAI_API_KEY", "").strip():
            failed.append("OPENAI_SECRET")
        if not _positive_int(env.get("WERKZ_HOTEL_OPENAI_CALL_LIMIT")):
            failed.append("OPENAI_CALL_LIMIT")
        if not _positive_int(env.get("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD")):
            failed.append("OPENAI_BUDGET")
        if env.get("WERKZ_HOTEL_OPENAI_ENV_FILE"):
            failed.append("OPENAI_LOCAL_ENV_FILE_FORBIDDEN_ON_RENDER")
    else:
        waiting.append("OPENAI_OPERATOR_OPT_IN")

    bridge = env.get("WERKZ_QWEN_BRIDGE_URL", "")
    if bridge:
        if not _https_endpoint(bridge):
            failed.append("QWEN_BRIDGE_ENDPOINT")
        else:
            waiting.append("QWEN_DEVICE_AND_SIGNATURE_NOT_VERIFIED")
    else:
        waiting.append("QWEN_BRIDGE_NOT_CONNECTED")

    # Never treat a valid URL/config as authentication, live model or deployment proof.
    waiting.extend([
        "OPERATOR_ACCOUNT_BOOTSTRAP_NOT_VERIFIED",
        "RENDER_DATABASE_SCHEMA_NOT_VERIFIED",
        "LIVE_DEPLOYMENT_NOT_VERIFIED",
        "MOBILE_DEVICE_NOT_VERIFIED",
    ])
    return failed, waiting


def main() -> int:
    parser = argparse.ArgumentParser(description="WerkZ Hotel offline deployment preflight")
    parser.add_argument("--ci-synthetic", action="store_true",
                        help="Exercise known-good synthetic configuration; zero real credentials.")
    args = parser.parse_args()
    if args.ci_synthetic:
        env = {
            "WERKZ_AI_PACKAGE": "hotel",
            "WERKZ_AI_MODE": "production",
            "WERKZ_ONLINE_TEST": "1",
            "RENDER_EXTERNAL_HOSTNAME": "werkz-hotel-test.onrender.com",
            "WERKZ_HOTEL_POSTGRES_ENABLED": "1",
            "WERKZ_HOTEL_DB_SCHEMA": "werkz_hotel_test",
            "WERKZ_HOTEL_DATABASE_URL": "postgresql://ci:synthetic@db.example.invalid:5432/hotel_ci",
            "WERKZ_HOTEL_OPENAI_ENABLED": "0",
        }
    else:
        env = dict(os.environ)
    failures, waiting = assess(env)
    for label in failures:
        print(f"BLOCKED: {label}")
    for label in waiting:
        print(f"NOT_VERIFIED: {label}")
    print("PRECHECK:", "PASS_CONFIG_ONLY" if not failures else "BLOCKED")
    return 0 if not failures else 2


if __name__ == "__main__":
    sys.exit(main())
