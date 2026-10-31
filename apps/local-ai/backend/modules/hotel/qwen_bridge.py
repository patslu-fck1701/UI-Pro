"""Bounded client for the private Qwen bridge.

The bridge is opt-in and disabled unless an operator supplies a fixed HTTPS URL.
Only the user's question is sent; redirects, arbitrary URLs and path leakage are
rejected before a response can reach the Hotel API.
"""
from urllib.parse import urlparse
import os
import secrets
import time

import httpx


MAX_ANSWER_CHARS = 4500


def status() -> dict:
    """Return non-secret bridge readiness metadata for operator readbacks."""
    configured = bool(os.environ.get("WERKZ_QWEN_BRIDGE_URL", "").strip())
    return {
        "state": "NOT_VERIFIED" if configured else "NOT_CONNECTED",
        "configured": configured,
        "authenticated": False,
        "last_successful_check": None,
        "error_category": None if configured else "BRIDGE_URL_MISSING",
    }


def _bridge_url() -> str:
    import os

    value = os.environ.get("WERKZ_QWEN_BRIDGE_URL", "").strip()
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("bridge disabled")
    if parsed.query or parsed.fragment:
        raise ValueError("bridge URL must not contain query or fragment")
    return value.rstrip("/")


async def ask(question: str) -> tuple[str, str]:
    url = _bridge_url()
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=5.0),
                                 trust_env=False, follow_redirects=False) as client:
        response = await client.post(
            url,
            json={"question": question},
            headers={
                "x-werkz-bridge-timestamp": timestamp,
                "x-werkz-bridge-nonce": nonce,
            },
        )
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict):
        raise ValueError("invalid bridge response")
    answer = body.get("answer")
    model = body.get("model", "Qwen")
    if not isinstance(answer, str) or not answer.strip() or len(answer) > MAX_ANSWER_CHARS:
        raise ValueError("invalid bridge answer")
    if not isinstance(model, str) or not model.strip():
        raise ValueError("invalid bridge model")
    # Never expose a local Windows/POSIX path returned by a bridge implementation.
    return answer, model.replace("\\", "/").rsplit("/", 1)[-1][:200]
