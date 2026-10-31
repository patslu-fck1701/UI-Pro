"""Bounded client for the private Qwen bridge.

The bridge is opt-in and disabled unless an operator supplies a fixed HTTPS URL.
Only the user's question is sent; redirects, arbitrary URLs and path leakage are
rejected before a response can reach the Hotel API.
"""
from urllib.parse import urlparse
import base64
import hashlib
import json
import os
import secrets
import time

import httpx


MAX_ANSWER_CHARS = 4500
BRIDGE_ORIGIN = "https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app"
BRIDGE_ROUTE = "/api/public/local-ai/ask"


def status() -> dict:
    """Return non-secret bridge readiness metadata for operator readbacks."""
    configured = bool(os.environ.get("WERKZ_QWEN_BRIDGE_URL", "").strip())
    return {
        "state": "NOT_VERIFIED" if configured and os.environ.get("WERKZ_QWEN_BRIDGE_PRIVATE_KEY") and os.environ.get("WERKZ_QWEN_BRIDGE_DEVICE_ID") else "NOT_CONNECTED",
        "configured": configured,
        "authenticated": bool(os.environ.get("WERKZ_QWEN_BRIDGE_PRIVATE_KEY") and os.environ.get("WERKZ_QWEN_BRIDGE_DEVICE_ID")),
        "last_successful_check": None,
        "error_category": None if configured else "BRIDGE_URL_MISSING",
    }


def _bridge_url() -> str:
    import os

    value = os.environ.get("WERKZ_QWEN_BRIDGE_URL", "").strip()
    if not value:
        value = BRIDGE_ORIGIN + BRIDGE_ROUTE
    parsed = urlparse(value)
    if (parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password
            or parsed.hostname != urlparse(BRIDGE_ORIGIN).hostname):
        raise ValueError("bridge disabled")
    if parsed.path != BRIDGE_ROUTE or parsed.query or parsed.fragment:
        raise ValueError("bridge URL must not contain query or fragment")
    return value.rstrip("/")


async def ask(question: str) -> tuple[str, str]:
    url = _bridge_url()
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    route = urlparse(url).path
    private_key = os.environ.get("WERKZ_QWEN_BRIDGE_PRIVATE_KEY", "").strip()
    device_id = os.environ.get("WERKZ_QWEN_BRIDGE_DEVICE_ID", "").strip()
    body = json.dumps({"device_id": device_id, "question": question}, ensure_ascii=False, separators=(",", ":"))
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    canonical = "\n".join(("WERKZ-BRIDGE-1", "POST", route, timestamp, nonce, body_hash)).encode("utf-8")
    signature = ""
    if private_key and device_id:
        try:
            from cryptography.hazmat.primitives import serialization
            key_data = base64.b64decode(private_key, validate=True)
            key = serialization.load_pem_private_key(key_data, password=None)
            signature = base64.b64encode(key.sign(canonical)).decode("ascii")
        except Exception:
            raise ValueError("bridge device identity unavailable") from None
    if not signature or not device_id:
        raise ValueError("bridge device is not paired")
    async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=5.0),
                                 trust_env=False, follow_redirects=False) as client:
        response = await client.post(
            url,
            content=body.encode("utf-8"),
            headers={
                "content-type": "application/json",
                "x-werkz-device": device_id,
                "x-werkz-timestamp": timestamp,
                "x-werkz-nonce": nonce,
                "x-werkz-signature": signature,
            },
        )
        response.raise_for_status()
        response_body = response.json()
    if not isinstance(response_body, dict):
        raise ValueError("invalid bridge response")
    answer = response_body.get("answer")
    model = response_body.get("model", "Qwen")
    if not isinstance(answer, str) or not answer.strip() or len(answer) > MAX_ANSWER_CHARS:
        raise ValueError("invalid bridge answer")
    if not isinstance(model, str) or not model.strip():
        raise ValueError("invalid bridge model")
    # Never expose a local Windows/POSIX path returned by a bridge implementation.
    return answer, model.replace("\\", "/").rsplit("/", 1)[-1][:200]
