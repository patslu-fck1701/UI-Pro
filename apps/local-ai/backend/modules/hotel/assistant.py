"""Optional, privacy-gated model choices for the EXISTING Hotel workspace.

No hotel record or tenant-scoped data is ever forwarded to cloud providers.
The public synthetic demo is never allowed to spend OpenAI credits.
"""
from contextlib import aclosing
import os
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ... import engine
from ...db import MODE, PACKAGE
from ..registry import guard
from .service import require
from .openai_credentials import openai_api_key

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
    }


async def _openai(question: str) -> tuple[str, str]:
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
                      "max_completion_tokens": 400, "reasoning_effort": "none"},
            )
            response.raise_for_status()
            body = response.json()
        message = body["choices"][0]["message"]["content"]
        if not isinstance(message, str) or not message.strip():
            raise ValueError("Missing answer")
        if len(message) > MAX_ANSWER_CHARS:
            raise ValueError("Oversized answer")
        return message, CLOUD_MODEL
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
        return answer, model
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
        answer, model = await _openai(input.question)
    else:
        answer, model = await _local(input.question)
    # No guest records, employee names, reservations or chat history read or sent.
    return {"provider": input.provider, "model": model, "answer": answer,
            "verifiedHotelData": False, "createdReservation": False,
            "dataScope": "USER_QUESTION_ONLY"}
