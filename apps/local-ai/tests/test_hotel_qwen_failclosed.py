"""Qwen online configuration must fail closed.

No network, no live device secret, no Render/Lovable requests. This catches a
regression where an unset URL silently selected the operator's preview host.
"""
import asyncio

import pytest

from backend.modules.hotel import qwen_bridge


def test_missing_url_does_not_default_to_private_preview(monkeypatch):
    monkeypatch.delenv("WERKZ_QWEN_BRIDGE_URL", raising=False)
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_DEVICE_ID", "synthetic-device")
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_PRIVATE_KEY", "synthetic-not-a-real-private-key")
    with pytest.raises(ValueError, match="bridge disabled"):
        qwen_bridge._bridge_url()
    assert qwen_bridge.status()["state"] == "NOT_CONNECTED"
    assert qwen_bridge.status()["authenticated"] is False


@pytest.mark.parametrize("bad_url", [
    "",
    "   ",
    "http://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app/api/public/local-ai/ask",
    "https://other.example/api/public/local-ai/ask",
    "https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app:443/api/public/local-ai/ask",
    "https://someone:secret@project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app/api/public/local-ai/ask",
    "https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app/api/public/local-ai/ask?token=x",
    "https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app/api/public/local-ai/ask#fragment",
    "https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app/api/public/local-ai/claim",
])
def test_only_explicit_exact_origin_and_route_allowed(monkeypatch, bad_url):
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", bad_url)
    with pytest.raises(ValueError):
        qwen_bridge._bridge_url()


def test_exact_operator_approved_route_is_accepted_but_not_authenticated(monkeypatch):
    route = qwen_bridge.BRIDGE_ORIGIN + qwen_bridge.BRIDGE_ROUTE
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", route)
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_PRIVATE_KEY", "synthetic-key")
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_DEVICE_ID", "synthetic-device")
    assert qwen_bridge._bridge_url() == route
    state = qwen_bridge.status()
    assert state["configured"] is True
    assert state["state"] == "NOT_VERIFIED"
    assert state["authenticated"] is False
    assert state["last_successful_check"] is None


def test_unconfigured_bridge_never_creates_http_client(monkeypatch):
    monkeypatch.delenv("WERKZ_QWEN_BRIDGE_URL", raising=False)
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_PRIVATE_KEY", "synthetic-key")
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_DEVICE_ID", "synthetic-device")
    class UnexpectedClient:
        def __init__(self, *args, **kwargs):
            raise AssertionError("No bridge network access is allowed")
    monkeypatch.setattr(qwen_bridge.httpx, "AsyncClient", UnexpectedClient)
    with pytest.raises(ValueError, match="bridge disabled"):
        asyncio.run(qwen_bridge.ask("synthetic question"))
