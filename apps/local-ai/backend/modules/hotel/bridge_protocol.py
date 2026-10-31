"""Shared WERKZ-BRIDGE-1 request authentication primitives.

This module has no network listener and stores no device keys. The caller must
resolve the paired device and tenant from its existing private operator store.
"""
from __future__ import annotations

import base64
import hashlib
import re
import time

MAX_CLOCK_SKEW_SECONDS = 90
NONCE_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def canonical_message(method: str, path: str, timestamp: str, nonce: str, body: bytes) -> bytes:
    if method != "POST" or not path.startswith("/api/public/local-ai/"):
        raise ValueError("ROUTE_DENIED")
    if not timestamp.isdigit() or not NONCE_PATTERN.fullmatch(nonce):
        raise ValueError("INVALID_AUTH_METADATA")
    return "\n".join(("WERKZ-BRIDGE-1", method, path, timestamp, nonce,
                     hashlib.sha256(body).hexdigest())).encode("utf-8")


def verify_request(public_key_b64: str, method: str, path: str, timestamp: str,
                   nonce: str, signature_b64: str, body: bytes,
                   now: float | None = None) -> bytes:
    issued = int(timestamp)
    if abs((time.time() if now is None else now) - issued) > MAX_CLOCK_SKEW_SECONDS:
        raise ValueError("REQUEST_EXPIRED")
    message = canonical_message(method, path, timestamp, nonce, body)
    try:
        from cryptography.hazmat.primitives import serialization
        key = serialization.load_der_public_key(base64.b64decode(public_key_b64, validate=True))
        signature = base64.b64decode(signature_b64, validate=True)
        key.verify(signature, message)
    except Exception as exc:
        raise ValueError("SIGNATURE_INVALID") from exc
    return message
