"""Opt-in in-memory bridge gateway for synthetic integration runs only."""
from __future__ import annotations

import asyncio
import calendar
import json
import os
import threading
import time
import uuid

from fastapi import APIRouter, HTTPException, Request

from .bridge_protocol import verify_request

router = APIRouter(prefix="/api/public/local-ai", tags=["synthetic_bridge"])
_jobs: dict[str, dict] = {}
_nonces: dict[str, float] = {}
_lock = threading.Lock()


def _enabled() -> bool:
    return os.environ.get("WERKZ_SYNTHETIC_BRIDGE") == "1"


def _device() -> tuple[str, str, str]:
    prefix = "WERKZ_SYNTHETIC_DEVICE_" if os.environ.get("WERKZ_SYNTHETIC_BRIDGE") == "1" else "WERKZ_QWEN_BRIDGE_"
    values = (os.environ.get(prefix + "ID", ""),
              os.environ.get(prefix + "PUBLIC_KEY", ""),
              os.environ.get(prefix + "TENANT", ""))
    if not all(values):
        raise HTTPException(503, "BRIDGE_DEVICE_NOT_AUTHORIZED")
    return values


async def _auth(request: Request, body: bytes) -> tuple[str, str]:
    if not _enabled():
        raise HTTPException(404, "Not found")
    device, public, tenant = _device()
    headers = request.headers
    if headers.get("x-werkz-device") != device:
        raise HTTPException(403, "BRIDGE_DEVICE_DENIED")
    timestamp, nonce = headers.get("x-werkz-timestamp", ""), headers.get("x-werkz-nonce", "")
    try:
        verify_request(public, request.method, request.url.path, timestamp, nonce,
                       headers.get("x-werkz-signature", ""), body)
    except ValueError as exc:
        raise HTTPException(401, str(exc)) from None
    now = time.time()
    key = device + ":" + nonce
    with _lock:
        for old, expiry in list(_nonces.items()):
            if expiry < now:
                _nonces.pop(old, None)
        if key in _nonces:
            raise HTTPException(409, "BRIDGE_REPLAY_REJECTED")
        _nonces[key] = now + 180
    return device, tenant


@router.post("/ask")
async def ask(request: Request):
    raw = await request.body()
    if len(raw) > 8192:
        raise HTTPException(413, "BRIDGE_REQUEST_TOO_LARGE")
    device, tenant = await _auth(request, raw)
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(400, "BRIDGE_INVALID_REQUEST") from None
    if not isinstance(payload, dict):
        raise HTTPException(400, "BRIDGE_INVALID_REQUEST")
    question = payload.get("question")
    if payload.get("device_id") != device or not isinstance(question, str) or not question.strip() or len(question) > 1000:
        raise HTTPException(422, "BRIDGE_INVALID_REQUEST")
    request_id, lease_id = str(uuid.uuid4()), str(uuid.uuid4())
    job = {"request_id": request_id, "lease_id": lease_id, "tenant": tenant,
           "prompt": question, "expires_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time()+90)),
           "device_id": device}
    with _lock:
        _jobs[request_id] = {"job": job, "state": "queued"}
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        with _lock:
            row = dict(_jobs[request_id])
        if row["state"] == "succeeded":
            return {"answer": row["answer"], "model": row["model"]}
        if row["state"] in {"failed", "revoked", "expired"}:
            raise HTTPException(503, "BRIDGE_WORKER_UNAVAILABLE")
        await asyncio.sleep(.05)
    with _lock:
        _jobs[request_id]["state"] = "expired"
    raise HTTPException(504, "BRIDGE_WORKER_TIMEOUT")


@router.post("/claim")
async def claim(request: Request):
    raw = await request.body()
    device, tenant = await _auth(request, raw)
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(400, "BRIDGE_INVALID_REQUEST") from None
    if not isinstance(payload, dict) or payload.get("device_id") != device:
        raise HTTPException(403, "BRIDGE_DEVICE_DENIED")
    with _lock:
        for row in _jobs.values():
            job = row["job"]
            if row["state"] == "queued" and job["device_id"] == device and job["tenant"] == tenant:
                row["state"] = "leased"
                return {"state": "ready", "job": job}
    return {"state": "idle"}


@router.post("/complete")
async def complete(request: Request):
    raw = await request.body()
    if len(raw) > 16384:
        raise HTTPException(413, "BRIDGE_REQUEST_TOO_LARGE")
    device, tenant = await _auth(request, raw)
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError
        request_id = payload["request_id"]
        with _lock:
            row = _jobs[request_id]
            job = row["job"]
            state = row["state"]
    except (ValueError, TypeError, KeyError):
        raise HTTPException(404, "BRIDGE_JOB_NOT_FOUND") from None
    if (payload.get("device_id") != device or payload.get("lease_id") != job["lease_id"]
            or job["device_id"] != device or job["tenant"] != tenant):
        raise HTTPException(403, "BRIDGE_LEASE_DENIED")
    expiry = time.strptime(job["expires_at"], "%Y-%m-%dT%H:%M:%SZ")
    if time.time() >= calendar.timegm(expiry):
        with _lock:
            row["state"] = "expired"
        raise HTTPException(410, "BRIDGE_LEASE_EXPIRED")
    if state != "leased":
        raise HTTPException(409, "BRIDGE_JOB_ALREADY_COMPLETED")
    answer, model = payload.get("answer"), payload.get("model", "Qwen")
    if payload.get("state") != "succeeded" or not isinstance(answer, str) or not answer.strip() or len(answer) > 4500 or not isinstance(model, str):
        raise HTTPException(502, "BRIDGE_WORKER_FAILED")
    with _lock:
        row.update(state="succeeded", answer=answer, model=model.replace("\\", "/").rsplit("/", 1)[-1][:200])
    return {"state": "succeeded"}
