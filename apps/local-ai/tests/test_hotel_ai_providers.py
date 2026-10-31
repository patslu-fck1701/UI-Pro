"""Synthetic regression tests. Never contact OpenAI or a local model."""
import asyncio
import base64
import hashlib
import json
import time
from types import SimpleNamespace
from urllib.parse import urlparse

import pytest
from fastapi import HTTPException
from backend.modules.hotel import assistant as ai
from backend.modules.hotel import qwen_bridge
from backend.modules.hotel import bridge_protocol
from backend.modules.hotel import bridge_gateway
from backend.app import app
from fastapi.testclient import TestClient


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
        async def post(self, url, *, content, headers):
            captured.append((url, content, headers))
            return Response()
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", qwen_bridge.BRIDGE_ORIGIN + qwen_bridge.BRIDGE_ROUTE)
    # Request signing uses a throwaway Ed25519 key; no device credential or live endpoint.
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    key = Ed25519PrivateKey.generate()
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_PRIVATE_KEY", base64.b64encode(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption())).decode())
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_DEVICE_ID", "synthetic-device")
    monkeypatch.setattr(qwen_bridge.httpx, "AsyncClient", Client)
    answer, model = asyncio.run(qwen_bridge.ask("synthetische Frage"))
    assert answer == "Synthetische Bridge-Antwort"
    assert model == "Qwen.gguf"
    assert len(captured) == 1
    url, body, headers = captured[0]
    assert url == qwen_bridge.BRIDGE_ORIGIN + qwen_bridge.BRIDGE_ROUTE
    assert b'"question":"synthetische Frage"' in body
    assert b'"device_id":"synthetic-device"' in body
    timestamp = headers["x-werkz-timestamp"]
    nonce = headers["x-werkz-nonce"]
    public = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    bridge_protocol.verify_request(base64.b64encode(public).decode(), "POST", qwen_bridge.BRIDGE_ROUTE, timestamp,
                                   nonce, headers["x-werkz-signature"], body)
    bridge_status=qwen_bridge.status()
    assert bridge_status["state"]=="READY"
    assert bridge_status["last_successful_check"]
    assert bridge_status["error_category"] is None
    class FailedClient:
        def __init__(self,*args,**kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): return False
        async def post(self,*args,**kwargs):
            raise qwen_bridge.httpx.ConnectError("synthetic failure")
    monkeypatch.setattr(qwen_bridge.httpx,"AsyncClient",FailedClient)
    with pytest.raises(qwen_bridge.httpx.ConnectError):
        asyncio.run(qwen_bridge.ask("synthetic failure"))
    failed_status=qwen_bridge.status()
    assert failed_status["state"]=="NOT_VERIFIED"
    assert failed_status["last_successful_check"] is None
    assert failed_status["error_category"]=="BRIDGE_REQUEST_FAILED"


def test_bridge_protocol_rejects_tamper_replay_metadata_and_expiry():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    import base64, hashlib, time
    key = Ed25519PrivateKey.generate()
    public = base64.b64encode(key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).decode()
    body = b'{"question":"synthetic"}'
    timestamp, nonce = str(int(time.time())), "a" * 32
    message = bridge_protocol.canonical_message("POST", "/api/public/local-ai/ask", timestamp, nonce, body)
    signature = base64.b64encode(key.sign(message)).decode()
    bridge_protocol.verify_request(public, "POST", "/api/public/local-ai/ask", timestamp, nonce, signature, body)
    with pytest.raises(ValueError):
        bridge_protocol.verify_request(public, "POST", "/api/public/local-ai/ask", timestamp, nonce, signature, body+b" ")
    with pytest.raises(ValueError):
        bridge_protocol.verify_request(public, "POST", "/api/public/local-ai/ask", str(int(time.time())-200), nonce, signature, body)
    with pytest.raises(ValueError, match="ROUTE_DENIED"):
        bridge_protocol.canonical_message("POST", "/api/public/local-ai/evil", timestamp, nonce, body)


def test_signed_hotel_gateway_worker_round_trip(monkeypatch):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    key = Ed25519PrivateKey.generate()
    private = base64.b64encode(key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8, serialization.NoEncryption())).decode()
    public = base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo)).decode()
    monkeypatch.setenv("WERKZ_SYNTHETIC_BRIDGE", "1")
    monkeypatch.setenv("WERKZ_SYNTHETIC_DEVICE_ID", "synthetic-device")
    monkeypatch.setenv("WERKZ_SYNTHETIC_DEVICE_PUBLIC_KEY", public)
    monkeypatch.setenv("WERKZ_SYNTHETIC_DEVICE_TENANT", "hotel-alpha")
    bridge_gateway._jobs.clear(); bridge_gateway._nonces.clear()
    client = TestClient(app)

    def signed(path, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        timestamp, nonce = str(int(time.time())), __import__("secrets").token_hex(16)
        signature = ai.qwen_bridge._sign(private, "synthetic-device", path, body.decode(), timestamp, nonce)
        return client.post(path, content=body, headers={"content-type":"application/json",
            "x-werkz-device":"synthetic-device", "x-werkz-timestamp":timestamp,
            "x-werkz-nonce":nonce, "x-werkz-signature":signature})

    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", qwen_bridge.BRIDGE_ORIGIN + qwen_bridge.BRIDGE_ROUTE)
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_PRIVATE_KEY", private)
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_DEVICE_ID", "synthetic-device")
    monkeypatch.setattr(qwen_bridge.httpx, "AsyncClient", lambda **kwargs: LocalAsyncClient(client))

    class LocalAsyncClient:
        def __init__(self, local_client, **kwargs): self.local_client=local_client
        async def __aenter__(self): return self
        async def __aexit__(self,*args): return False
        async def post(self, url, *, content, headers):
            response=self.local_client.post(urlparse(url).path,content=content,headers=headers)
            class Wrapped:
                def raise_for_status(self): response.raise_for_status()
                def json(self): return response.json()
            return Wrapped()

    result={}
    import threading
    def hotel_request(): result["answer"]=asyncio.run(qwen_bridge.ask("synthetischer Durchlauf"))
    thread=threading.Thread(target=hotel_request);thread.start()
    deadline=time.monotonic()+3
    queued=None
    while time.monotonic()<deadline:
        with bridge_gateway._lock:
            queued=next((row["job"] for row in bridge_gateway._jobs.values() if row["state"]=="queued"),None)
        if queued: break
        time.sleep(.02)
    assert queued and queued["tenant"]=="hotel-alpha"
    claimed=signed("/api/public/local-ai/claim",{"device_id":"synthetic-device"})
    assert claimed.status_code==200 and claimed.json()["job"]["request_id"]==queued["request_id"]
    completion=signed("/api/public/local-ai/complete",{"device_id":"synthetic-device",
        "request_id":queued["request_id"],"lease_id":queued["lease_id"],"state":"succeeded",
        "answer":"Qwen synthetic answer","model":r"C:\models\Qwen.gguf"})
    assert completion.status_code==200
    thread.join(timeout=3)
    assert not thread.is_alive()
    assert result["answer"]==("Qwen synthetic answer","Qwen.gguf")


def test_failed_worker_completion_unblocks_ask_with_redacted_error(monkeypatch):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    key = Ed25519PrivateKey.generate()
    private = base64.b64encode(key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8, serialization.NoEncryption())).decode()
    public = base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo)).decode()
    monkeypatch.setenv("WERKZ_SYNTHETIC_BRIDGE", "1")
    monkeypatch.setenv("WERKZ_SYNTHETIC_DEVICE_ID", "synthetic-device")
    monkeypatch.setenv("WERKZ_SYNTHETIC_DEVICE_PUBLIC_KEY", public)
    monkeypatch.setenv("WERKZ_SYNTHETIC_DEVICE_TENANT", "hotel-alpha")
    bridge_gateway._jobs.clear(); bridge_gateway._nonces.clear()
    client = TestClient(app)

    def signed(path, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        timestamp, nonce = str(int(time.time())), __import__("secrets").token_hex(16)
        signature = qwen_bridge._sign(private, "synthetic-device", path, body.decode(), timestamp, nonce)
        return client.post(path, content=body, headers={"content-type":"application/json",
            "x-werkz-device":"synthetic-device", "x-werkz-timestamp":timestamp,
            "x-werkz-nonce":nonce, "x-werkz-signature":signature})

    result = {}
    import threading
    def hotel_request():
        body = json.dumps({"device_id":"synthetic-device","question":"synthetic failure"},separators=(",", ":"))
        timestamp, nonce = str(int(time.time())), __import__("secrets").token_hex(16)
        signature = qwen_bridge._sign(private, "synthetic-device", "/api/public/local-ai/ask", body, timestamp, nonce)
        result["response"] = client.post("/api/public/local-ai/ask", content=body, headers={"content-type":"application/json",
            "x-werkz-device":"synthetic-device", "x-werkz-timestamp":timestamp,
            "x-werkz-nonce":nonce, "x-werkz-signature":signature})
    thread=threading.Thread(target=hotel_request);thread.start()
    deadline=time.monotonic()+3
    queued=None
    while time.monotonic()<deadline:
        with bridge_gateway._lock:
            queued=next((row["job"] for row in bridge_gateway._jobs.values() if row["state"]=="queued"),None)
        if queued: break
        time.sleep(.02)
    assert queued
    assert signed("/api/public/local-ai/claim",{"device_id":"synthetic-device"}).status_code==200
    completion=signed("/api/public/local-ai/complete",{"device_id":"synthetic-device",
        "request_id":queued["request_id"],"lease_id":queued["lease_id"],"state":"failed","error_code":"MODEL_UNAVAILABLE"})
    assert completion.status_code==200 and completion.json()=={"state":"failed"}
    thread.join(timeout=3)
    assert not thread.is_alive()
    assert result["response"].status_code==503
    assert result["response"].json()=={"detail":"BRIDGE_WORKER_UNAVAILABLE"}


def test_cancelled_openai_request_closes_budget_reservation(monkeypatch):
    user=SimpleNamespace(role="admin",tenant="hotel-alpha",id="owner")
    finished=[]
    monkeypatch.setattr(ai,"_cloud_allowed",lambda value: True)
    monkeypatch.setattr(ai,"_reserve_openai",lambda value,question: "reservation-id")
    monkeypatch.setattr(ai,"_finish_openai",lambda tenant,reservation,state,usage=None: finished.append((tenant,reservation,state,usage)))
    async def cancelled(question):
        raise asyncio.CancelledError
    monkeypatch.setattr(ai,"_openai",cancelled)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(ai.ask(ai.HotelQuestion(provider="openai",question="synthetic cancel"),user))
    assert finished==[("hotel-alpha","reservation-id","cancelled",None)]


def test_online_qwen_bridge_rejects_non_https_and_redirects(monkeypatch):
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", "http://example.test/ask")
    with pytest.raises(ValueError): asyncio.run(qwen_bridge.ask("test"))
    monkeypatch.setenv("WERKZ_QWEN_BRIDGE_URL", qwen_bridge.BRIDGE_ORIGIN + "/ask?next=evil")
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
