"""Optional, privacy-gated model choices for the EXISTING Hotel workspace.

No hotel record or tenant-scoped data is ever forwarded to cloud providers.
The public synthetic demo is never allowed to spend OpenAI credits.
"""
from contextlib import aclosing
from math import ceil
import os
from pathlib import Path
from typing import Literal
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ... import engine
from ...db import MODE, PACKAGE
from ...db import Session
from ...write_lock import begin_write
from ..registry import guard
from .service import require
from .openai_credentials import openai_api_key
from .models import HotelAiUsage
from sqlalchemy import func, select

router = APIRouter(prefix="/api/hotel/ai", tags=["hotel_ai"])
permission = guard("hotel_ai")
SYSTEM = (
    "Du bist der WerkZ-Hotel-Assistent im Testbetrieb. Antworte auf Deutsch "
    "und behaupte keine aktuelle Zimmerverfuegbarkeit, Buchung oder erfolgte "
    "Aktion. Fuer Buchungen ist eine separate autorisierte Datenbankpruefung "
    "durch die Rezeption erforderlich. Erfinde keine Hotel- oder Gastdaten."
)
CLOUD_MODEL = "gpt-6-luna"
MAX_ANSWER_CHARS = 4500
MAX_COMPLETION_TOKENS = 400
DEFAULT_CALL_LIMIT = 20
DEFAULT_BUDGET_MICROUSD = 5000


class HotelQuestion(BaseModel):
    provider: Literal["local", "openai"]
    question: str = Field(min_length=2, max_length=1000)
    model_config = {"extra": "forbid"}


def _cloud_allowed(user) -> bool:
    # Operator account only, not unlimited public demo personas.
    return (
        PACKAGE == "hotel"
        and MODE == "production"
        and user.role == "admin"
        and os.environ.get("WERKZ_HOTEL_OPENAI_ENABLED") == "1"
        and bool(openai_api_key())
    )


def _role_allowed(user):
    require(user, "admin", "management", "reception", "rooms", "housekeeping",
            "housekeeping_own", "maintenance", "inventory", "kitchen",
            "restaurant", "staff", "wellness")


def _positive_limit(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return 0
    return value if value > 0 else 0


def _reserve_openai(user, question: str) -> str:
    # Conservative upper bound: each Unicode character may become a token.
    # GPT-6 Luna standard pricing: $0.10/M input and $0.50/M output tokens.
    reserved = ceil((len(SYSTEM) + len(question)) * 0.1 + MAX_COMPLETION_TOKENS * 0.5)
    call_limit = _positive_limit("WERKZ_HOTEL_OPENAI_CALL_LIMIT", DEFAULT_CALL_LIMIT)
    budget = _positive_limit("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", DEFAULT_BUDGET_MICROUSD)
    if not call_limit or not budget:
        raise HTTPException(503, "OpenAI-Ausgabenlimit ist sicher gesperrt.")
    with Session() as db:
        begin_write(db)
        calls = db.scalar(select(func.count()).select_from(HotelAiUsage).where(
            HotelAiUsage.tenant == user.tenant,
            HotelAiUsage.provider == "openai",
        )) or 0
        spent = db.scalar(select(func.coalesce(func.sum(HotelAiUsage.reserved_microusd), 0)).where(
            HotelAiUsage.tenant == user.tenant,
            HotelAiUsage.provider == "openai",
        )) or 0
        if calls >= call_limit or spent + reserved > budget:
            raise HTTPException(429, "OpenAI-Ausgabenlimit erreicht.")
        row = HotelAiUsage(id=str(uuid.uuid4()), tenant=user.tenant, actor=user.id,
                           provider="openai", model=CLOUD_MODEL,
                           reserved_microusd=reserved)
        db.add(row)
        db.commit()
        return row.id


def _finish_openai(reservation_id: str, state: str, usage: dict | None = None) -> None:
    usage = usage or {}
    input_tokens = max(0, int(usage.get("prompt_tokens", 0) or 0))
    output_tokens = max(0, int(usage.get("completion_tokens", 0) or 0))
    actual = ceil(input_tokens * 0.1 + output_tokens * 0.5)
    with Session() as db:
        begin_write(db)
        row = db.get(HotelAiUsage, reservation_id)
        if row:
            row.state = state
            row.input_tokens = input_tokens
            row.output_tokens = output_tokens
            row.actual_microusd = actual
            db.commit()


def _usage_status(user) -> dict:
    with Session() as db:
        calls = db.scalar(select(func.count()).select_from(HotelAiUsage).where(
            HotelAiUsage.tenant == user.tenant,
            HotelAiUsage.provider == "openai",
        )) or 0
        reserved = db.scalar(select(func.coalesce(func.sum(HotelAiUsage.reserved_microusd), 0)).where(
            HotelAiUsage.tenant == user.tenant,
            HotelAiUsage.provider == "openai",
        )) or 0
        actual = db.scalar(select(func.coalesce(func.sum(HotelAiUsage.actual_microusd), 0)).where(
            HotelAiUsage.tenant == user.tenant,
            HotelAiUsage.provider == "openai",
        )) or 0
    return {"calls": calls, "reservedMicroUsd": reserved, "actualMicroUsd": actual,
            "callLimit": _positive_limit("WERKZ_HOTEL_OPENAI_CALL_LIMIT", DEFAULT_CALL_LIMIT),
            "budgetMicroUsd": _positive_limit("WERKZ_HOTEL_OPENAI_BUDGET_MICROUSD", DEFAULT_BUDGET_MICROUSD)}


@router.get("/providers")
def providers(user=Depends(permission)):
    _role_allowed(user)
    return {
        "local": {"state": "NOT_CONNECTED" if os.environ.get("WERKZ_ONLINE_TEST") == "1"
                  else "CHECK_ON_REQUEST"},
        "openai": {"state": "CONFIGURED" if _cloud_allowed(user) else "NOT_CONNECTED"},
        "cloudDataScope": "USER_QUESTION_ONLY",
        "hotelRecordsShared": False,
        "outboundBridge": "NOT_CONNECTED",
        "openaiUsage": _usage_status(user) if user.role == "admin" else None,
    }


async def _openai(question: str) -> tuple[str, str, dict]:
    # Fixed vendor endpoint: no user-configurable URL, redirect or model.
    key = openai_api_key()
    if not key:
        raise HTTPException(503, "OpenAI-Schluessel ist lokal nicht verfuegbar.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(35.0, connect=5.0),
                                     trust_env=False, follow_redirects=False) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": "Bearer " + key,
                         "Content-Type": "application/json"},
                json={"model": CLOUD_MODEL,
                      "messages": [{"role": "system", "content": SYSTEM},
                                   {"role": "user", "content": question}],
                      "max_completion_tokens": MAX_COMPLETION_TOKENS, "reasoning_effort": "none"},
            )
            response.raise_for_status()
            body = response.json()
        message = body["choices"][0]["message"]["content"]
        if not isinstance(message, str) or not message.strip():
            raise ValueError("Missing answer")
        if len(message) > MAX_ANSWER_CHARS:
            raise ValueError("Oversized answer")
        usage = body.get("usage", {})
        return message, body.get("model", CLOUD_MODEL), usage if isinstance(usage, dict) else {}
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        # Never include provider response bodies or authorization headers in errors.
        raise HTTPException(503, "OpenAI konnte keine bestaetigte Antwort liefern.") from None


async def _local(question: str) -> tuple[str, str]:
    if os.environ.get("WERKZ_ONLINE_TEST") == "1":
        raise HTTPException(503, "Die private Qwen-Bridge ist online noch nicht verbunden.")
    try:
        models = await engine.models()
        if not models:
            raise ValueError("No loaded model")
        model = models[0]["id"]
        messages = [{"role": "system", "content": SYSTEM + " /no_think"},
                    {"role": "user", "content": question}]
        chunks = []
        async with aclosing(engine.tokens(messages, model, 0.4, 400)) as tokens:
            async for token in tokens:
                chunks.append(token)
                if sum(map(len, chunks)) > MAX_ANSWER_CHARS:
                    raise ValueError("Oversized answer")
        answer = "".join(chunks)
        if not answer.strip():
            raise ValueError("Empty answer")
        return answer, Path(model).name
    except (httpx.HTTPError, OSError, ValueError, LookupError, KeyError, TypeError):
        raise HTTPException(503, "Das lokale Qwen-Modell ist nicht bereit.") from None


@router.post("/ask")
async def ask(input: HotelQuestion, user=Depends(permission)):
    _role_allowed(user)
    if not input.question.strip():
        raise HTTPException(422, "Frage erforderlich.")
    if input.provider == "openai":
        if not _cloud_allowed(user):
            raise HTTPException(403, "OpenAI ist nur fuer den freigeschalteten Betreiber zugaenglich.")
        reservation_id = _reserve_openai(user, input.question)
        try:
            answer, model, usage = await _openai(input.question)
        except HTTPException:
            _finish_openai(reservation_id, "failed")
            raise
        _finish_openai(reservation_id, "complete", usage)
    else:
        answer, model = await _local(input.question)
    # No guest records, employee names, reservations or chat history read or sent.
    return {"provider": input.provider, "model": model, "answer": answer,
            "verifiedHotelData": False, "createdReservation": False,
            "dataScope": "USER_QUESTION_ONLY",
            "openaiUsage": _usage_status(user) if input.provider == "openai" else None}
