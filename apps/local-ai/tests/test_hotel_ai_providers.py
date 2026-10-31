"""Synthetic regression tests. Never contact OpenAI or a local model."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from backend.modules.hotel import assistant as ai
from backend.modules.hotel import qwen_bridge


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
    answer, model, usage = asyncio.run(ai._openai("Welche Uebergaben gibt es?"))
    assert answer == "Nur synthetischer Test."
    assert model == ai.CLOUD_MODEL
    assert usage == {}
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


def test_online_qwen_bridge_sends_question_only_and_redacts_model_path(monkeypatch):
    captured = []
    class Response:
        def raise_for_status(self): return None
        def json(self): return {"answer": "Synthetische Bridge-Antwort", "model": r"C:\\Models\\Qwen.gguf"}
    class Client:
        def __init__(self, *args, **kwargs):
            assert kwargs["trust_env"] is False and kwargs["follow_redirects"] is False
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def post(self, url, *, json, headers):
            captured.append((url, json, headers))
            return Response()
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", "https://bridge.example.test/v1/ask")
    monkeypatch.setattr(qwen_bridge.httpx, "AsyncClient", Client)
    answer, model = asyncio.run(qwen_bridge.ask("synthetische Frage"))
    assert answer == "Synthetische Bridge-Antwort"
    assert model == "Qwen.gguf"
    assert len(captured) == 1
    url, payload, headers = captured[0]
    assert url == "https://bridge.example.test/v1/ask"
    assert payload == {"question": "synthetische Frage"}
    assert headers["x-werkz-bridge-nonce"]
    assert headers["x-werkz-bridge-timestamp"].isdigit()


def test_online_qwen_bridge_rejects_non_https_and_redirects(monkeypatch):
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", "http://bridge.example.test/ask")
    with pytest.raises(ValueError): asyncio.run(qwen_bridge.ask("test"))
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", "https://bridge.example.test/ask?next=evil")
    with pytest.raises(ValueError): asyncio.run(qwen_bridge.ask("test"))


def test_local_provider_redacts_model_path(monkeypatch):
    async def models():
        return [{"id": r"D:\\AI-Runtime\\Models\\Qwen3.5-9B-Q4_K_M.gguf"}]
    async def tokens(*args, **kwargs):
        yield "Bereit."
    monkeypatch.delenv("WERKZ_ONLINE_TEST", raising=False)
    monkeypatch.setattr(ai.engine, "models", models)
    monkeypatch.setattr(ai.engine, "tokens", tokens)
    answer, model = asyncio.run(ai._local("Synthetischer Test"))
    assert answer == "Bereit."
    assert model == "Qwen3.5-9B-Q4_K_M.gguf"
    assert "\\" not in model and "/" not in model


@pytest.mark.parametrize("value", [None, "", "not-a-number", object(), -4])
def test_malformed_provider_usage_is_safe(value):
    # Provider telemetry is untrusted. It must never turn a completed request
    # into a 500 or make cost accounting negative.
    assert ai._usage_count(value) == 0


def test_provider_usage_coerces_numeric_strings():
    assert ai._usage_count("17") == 17
    assert ai._usage_count(3.9) == 3
