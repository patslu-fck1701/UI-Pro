"""Synthetic regression tests. Never contact OpenAI or a local model."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from backend.modules.hotel import assistant as ai


def test_openai_cost_gate_needs_admin_key_and_explicit_operator_opt_in(monkeypatch):
    user = SimpleNamespace(role="admin")
    monkeypatch.setattr(ai, "PACKAGE", "hotel")
    monkeypatch.setattr(ai, "MODE", "production")
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-test-key-only")
    monkeypatch.delenv("WERKZ_HOTEL_OPENAI_ENABLED", raising=False)
    assert ai._cloud_allowed(user) is False
    monkeypatch.setenv("WERKZ_HOTEL_OPENAI_ENABLED", "1")
    assert ai._cloud_allowed(user) is True
    assert ai._cloud_allowed(SimpleNamespace(role="hotel_reception")) is False
    monkeypatch.setattr(ai, "PACKAGE", "hotel-demo")
    assert ai._cloud_allowed(user) is False
    monkeypatch.setattr(ai, "PACKAGE", "hotel")
    monkeypatch.setattr(ai, "MODE", "demo")
    assert ai._cloud_allowed(user) is False
    monkeypatch.setattr(ai, "MODE", "production")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert ai._cloud_allowed(user) is False


def test_openai_provider_uses_fixed_endpoint_and_never_forwards_hotel_records(monkeypatch):
    calls = []
    class Response:
        def raise_for_status(self):
            return None
        def json(self):
            return {"choices": [{"message": {"content": "Nur synthetischer Test."}}]}
    class Client:
        def __init__(self, *args, **kwargs):
            assert kwargs["trust_env"] is False
            assert kwargs["follow_redirects"] is False
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return False
        async def post(self, url, *, json, headers):
            calls.append((url, json, headers))
            return Response()
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-test-key-only")
    monkeypatch.setattr(ai.httpx, "AsyncClient", Client)
    answer, model = asyncio.run(ai._openai("Welche Uebergaben gibt es?"))
    assert answer == "Nur synthetischer Test."
    assert model == ai.CLOUD_MODEL
    assert len(calls) == 1
    endpoint, payload, headers = calls[0]
    assert endpoint == "https://api.openai.com/v1/chat/completions"
    assert payload["messages"][1]["content"] == "Welche Uebergaben gibt es?"
    assert headers["Authorization"] == "Bearer synthetic-test-key-only"
    assert "tenant" not in str(payload).lower()
    assert "reservation" not in str(payload).lower()


def test_empty_provider_answer_fails_without_hallucinated_success(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None
        def json(self):
            return {"choices": [{"message": {"content": ""}}]}
    class Client:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return False
        async def post(self, *args, **kwargs):
            return Response()
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-test-key-only")
    monkeypatch.setattr(ai.httpx, "AsyncClient", Client)
    with pytest.raises(HTTPException) as error:
        asyncio.run(ai._openai("Synthetic sample"))
    assert error.value.status_code == 503
    assert "synthetic-test-key-only" not in str(error.value.detail)


def test_public_online_mode_rejects_direct_local_engine(monkeypatch):
    monkeypatch.setenv("WERKZ_ONLINE_TEST", "1")
    async def forbidden():
        raise AssertionError("Public request must not call loopback llama.cpp")
    monkeypatch.setattr(ai.engine, "models", forbidden)
    with pytest.raises(HTTPException) as error:
        asyncio.run(ai._local("Test"))
    assert error.value.status_code == 503
