"""Strict, synthetic Hotel online preflight regressions.

No network, cloud calls, Render changes, user credentials or real databases.
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.hotel_online_preflight import (
    APPROVED_BRIDGE_HOST,
    APPROVED_BRIDGE_PATH,
    _https_endpoint,
    assess,
)

BASE = {
    "WERKZ_AI_PACKAGE": "hotel",
    "WERKZ_AI_MODE": "production",
    "WERKZ_ONLINE_TEST": "1",
    "RENDER_EXTERNAL_HOSTNAME": "werkz-hotel-test.onrender.com",
    "WERKZ_HOTEL_POSTGRES_ENABLED": "1",
    "WERKZ_HOTEL_DB_SCHEMA": "werkz_hotel_test",
    "WERKZ_HOTEL_DATABASE_URL": "postgresql://ci:synthetic@db.example.invalid:5432/hotel_ci",
    "WERKZ_HOTEL_OPENAI_ENABLED": "0",
}
BRIDGE = "https://" + APPROVED_BRIDGE_HOST + APPROVED_BRIDGE_PATH


def test_valid_synthetic_config_only_never_claims_live_readiness():
    failed, pending = assess(BASE)
    assert failed == []
    assert "OPENAI_OPERATOR_OPT_IN" in pending
    assert "QWEN_BRIDGE_NOT_CONNECTED" in pending
    assert "LIVE_DEPLOYMENT_NOT_VERIFIED" in pending
    assert "RENDER_DATABASE_SCHEMA_NOT_VERIFIED" in pending


@pytest.mark.parametrize("name,value,expected", [
    ("WERKZ_AI_PACKAGE", "hotel-demo", "HOTEL_PACKAGE"),
    ("WERKZ_AI_MODE", "demo", "HOTEL_MODE"),
    ("WERKZ_ONLINE_TEST", "0", "ONLINE_BOUNDARY"),
    ("RENDER_EXTERNAL_HOSTNAME", "evil.example", "RENDER_HOST"),
    ("RENDER_EXTERNAL_HOSTNAME", "werkz-hotel-test.onrender.com:443", "RENDER_HOST"),
    ("WERKZ_HOTEL_POSTGRES_ENABLED", "0", "POSTGRES_ENABLED"),
    ("WERKZ_HOTEL_DB_SCHEMA", "public", "POSTGRES_ISOLATED_SCHEMA"),
    ("WERKZ_HOTEL_DATABASE_URL", "sqlite:///tmp/test.sqlite3", "POSTGRES_CONNECTION"),
    ("WERKZ_HOTEL_DATABASE_URL", "postgresql://ci:synthetic@localhost/hotel_ci", "POSTGRES_CONNECTION"),
    ("WERKZ_HOTEL_OPENAI_ENABLED", "yes", "OPENAI_SWITCH"),
])
def test_unsafe_deployment_configuration_blocks(name, value, expected):
    failed, _ = assess({**BASE, name: value})
    assert expected in failed


@pytest.mark.parametrize("value", [
    "https://evil.example/api/public/local-ai/ask",
    "https://127.0.0.1/api/public/local-ai/ask",
    "https://10.0.0.1/api/public/local-ai/ask",
    "http://" + APPROVED_BRIDGE_HOST + APPROVED_BRIDGE_PATH,
    "https://user:secret@" + APPROVED_BRIDGE_HOST + APPROVED_BRIDGE_PATH,
    "https://" + APPROVED_BRIDGE_HOST + ":443" + APPROVED_BRIDGE_PATH,
    BRIDGE + "?secret=1",
    BRIDGE + "#fragment",
    "https://" + APPROVED_BRIDGE_HOST + "/api/public/local-ai/claim",
    BRIDGE + "/",
    BRIDGE + " bad",
])
def test_bridge_endpoint_rejects_redirects_private_hosts_and_wrong_paths(value):
    assert _https_endpoint(value) is False
    failed, _ = assess({**BASE, "WERKZ_QWEN_BRIDGE_URL": value})
    assert "QWEN_BRIDGE_ENDPOINT" in failed


def test_approved_bridge_only_indicates_not_verified():
    assert _https_endpoint(BRIDGE)
    failed, pending = assess({**BASE, "WERKZ_QWEN_BRIDGE_URL": BRIDGE})
    assert failed == []
    assert "QWEN_DEVICE_AND_SIGNATURE_NOT_VERIFIED" in pending
    assert "LIVE_DEPLOYMENT_NOT_VERIFIED" in pending


def test_cloud_spending_requires_valid_limits_and_explicit_key():
    enabled = {**BASE, "WERKZ_HOTEL_OPENAI_ENABLED": "1"}
    failed, pending = assess(enabled)
    assert {"OPENAI_SECRET", "OPENAI_CALL_LIMIT", "OPENAI_BUDGET"} <= set(failed)
    assert "OPENAI_OPERATOR_OPT_IN" not in pending
    valid = {**enabled, "OPENAI_API_KEY": "synthetic-not-real",
             "WERKZ_HOTEL_OPENAI_CALL_LIMIT": "3",
             "WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD": "1000"}
    assert assess(valid)[0] == []
    assert "OPENAI_LOCAL_ENV_FILE_FORBIDDEN_ON_RENDER" in assess({
        **valid, "WERKZ_HOTEL_OPENAI_ENV_FILE": "/tmp/secret.env",
    })[0]
    for key, values in [
        ("WERKZ_HOTEL_OPENAI_CALL_LIMIT", ("0", "-1", "abc")),
        ("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", ("0", "-1", "abc")),
    ]:
        for value in values:
            assert assess({**valid, key: value})[0]


def test_preflight_cli_does_not_log_secret_values(tmp_path):
    script = Path(__file__).resolve().parents[1] / "scripts" / "hotel_online_preflight.py"
    private = "synthetic-SUPER-SECRET-do-not-print"
    environment = {**os.environ, **BASE,
                   "OPENAI_API_KEY": private,
                   "WERKZ_HOTEL_OPENAI_ENABLED": "1",
                   "WERKZ_HOTEL_OPENAI_CALL_LIMIT": "garbage",
                   "WERKZ_QWEN_BRIDGE_URL": "https://blocked.example/" + private}
    process = subprocess.run([sys.executable, str(script)], env=environment,
                             capture_output=True, text=True, timeout=15)
    assert process.returncode == 2
    assert "BLOCKED: OPENAI_CALL_LIMIT" in process.stdout
    assert "BLOCKED: QWEN_BRIDGE_ENDPOINT" in process.stdout
    assert private not in (process.stdout + process.stderr)


def test_synthetic_preflight_cli_passes_config_but_marks_live_unknown():
    script = Path(__file__).resolve().parents[1] / "scripts" / "hotel_online_preflight.py"
    result = subprocess.run([sys.executable, str(script), "--ci-synthetic"],
                            capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr + result.stdout
    assert "PRECHECK: PASS_CONFIG_ONLY" in result.stdout
    assert "NOT_VERIFIED: LIVE_DEPLOYMENT_NOT_VERIFIED" in result.stdout
