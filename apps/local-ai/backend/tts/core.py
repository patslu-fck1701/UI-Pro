"""TTS-Dienst: Autorisierung ist Sache des Aufrufers (Router nutzt die bestehende Modulprüfung).
Hier: Limits, Einzelauftrag je Benutzer, Abbruch, Zeitlimit, Zeichenbudget, Audit ohne Textinhalt."""
from __future__ import annotations

import io
import math
import os
import struct
import threading
import time
import uuid
import wave
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass, field

from .elevenlabs import ElevenLabsProvider
from .sanitize import segments

MAX_INPUT_CHARS = 3000
MAX_SEGMENTS = 8
SEGMENT_CHARS = 600
TIMEOUT_S = 20.0
GLOBAL_CONCURRENCY = 2
DAILY_CHAR_BUDGET = 30000  # je Mandant und Tag, im Prozess gehalten (nicht persistiert)
ALLOWED_PROVIDERS = {"synthetic-test"}  # Basis; kostenpflichtige Anbieter nur über allowed_providers()


def allowed_providers() -> set[str]:
    """Kostenpflichtige Anbieter erst mit ausdrücklicher Freigabe TTS_ALLOW_PAID_PROVIDER=1."""
    allowed = set(ALLOWED_PROVIDERS)
    if os.environ.get("TTS_ALLOW_PAID_PROVIDER", "").strip() == "1":
        allowed.add("elevenlabs")
    return allowed


def _paid_ready() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY", "").strip())


class TtsError(Exception):
    def __init__(self, code: str, status: int, message: str):
        super().__init__(message)
        self.code, self.status, self.message = code, status, message


class CancelToken:
    def __init__(self):
        self._event = threading.Event()

    def cancel(self):
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()


class SyntheticProvider:
    """Nur zum Testen: erzeugt einen Ton, KEINE Stimme. Muss ausdrücklich konfiguriert werden."""
    name = "synthetic-test"

    def synthesize(self, text: str, voice_id: str, timeout: float) -> bytes:
        rate = 16000
        seconds = min(0.05 * len(text), 3.0)
        frames = int(rate * seconds)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(b"".join(
                struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / rate))) for i in range(frames)))
        return buf.getvalue()


def _fmt(w):
    return (w.getnchannels(), w.getsampwidth(), w.getframerate())


def concat_wav(parts: list[bytes]) -> bytes:
    """Mehrere WAV-Segmente mit gleichem Format (Kanäle, Samplebreite, Rate) zusammenfügen.
    Die Frame-Anzahl je Segment ist erwartungsgemäß verschieden und wird nicht verglichen."""
    out = io.BytesIO()
    with wave.open(io.BytesIO(parts[0]), "rb") as first:
        fmt = _fmt(first)
    with wave.open(out, "wb") as w:
        w.setnchannels(fmt[0])
        w.setsampwidth(fmt[1])
        w.setframerate(fmt[2])
        for p in parts:
            with wave.open(io.BytesIO(p), "rb") as r:
                if _fmt(r) != fmt:
                    raise TtsError("PROVIDER_ERROR", 503, "Anbieter lieferte uneinheitliches Audioformat.")
                w.writeframes(r.readframes(r.getnframes()))
    return out.getvalue()


@dataclass
class Config:
    provider: str = ""
    voice_id: str = ""

    @property
    def configured(self) -> bool:
        if self.provider not in allowed_providers():
            return False
        if self.provider == "synthetic-test":
            return True
        if self.provider == "elevenlabs":
            return bool(self.voice_id) and _paid_ready()
        return False


@dataclass
class TtsService:
    config: Config
    provider_factory: dict = field(default_factory=lambda: {"synthetic-test": SyntheticProvider,
                                                              "elevenlabs": ElevenLabsProvider})
    clock: object = time.time
    audit: list = field(default_factory=list)  # nur Metadaten, nie Text oder Audio

    def __post_init__(self):
        self._user_busy: set[str] = set()
        self._lock = threading.Lock()
        self._slots = threading.BoundedSemaphore(GLOBAL_CONCURRENCY)
        self._budget: dict[tuple[str, str], int] = {}
        self._pool = ThreadPoolExecutor(max_workers=GLOBAL_CONCURRENCY)

    def status(self) -> dict:
        # Nie Schlüssel, nie Voice-ID im Status: nur Zustand für die Oberfläche.
        return {"configured": self.config.configured, "provider": self.config.provider or None,
                "test_only": self.config.provider == "synthetic-test",
                "paid_provider": self.config.provider == "elevenlabs",
                "localOnly": self.config.provider != "elevenlabs"}

    def _log(self, request_id, user_id, tenant, status, started, chars, segs, provider):
        self.audit.append({"request_id": request_id, "user": user_id, "tenant": tenant, "status": status,
                           "ms": int((time.monotonic() - started) * 1000), "chars": chars,
                           "segments": segs, "provider": provider})

    def synthesize(self, user_id: str, tenant: str, text: str, cancel: CancelToken | None = None) -> bytes:
        cancel = cancel or CancelToken()
        rid, started = str(uuid.uuid4()), time.monotonic()
        if not self.config.configured:
            raise TtsError("NOT_CONFIGURED", 503, "Stimme ist noch nicht eingerichtet.")
        if not isinstance(text, str) or not text.strip():
            raise TtsError("VALIDATION_ERROR", 400, "Kein Text zum Vorlesen.")
        if len(text) > MAX_INPUT_CHARS:
            raise TtsError("VALIDATION_ERROR", 400, f"Text ist länger als {MAX_INPUT_CHARS} Zeichen.")
        segs = segments(text, SEGMENT_CHARS)
        if not segs:
            raise TtsError("VALIDATION_ERROR", 400, "Der Text enthält nichts Sprechbares.")
        if len(segs) > MAX_SEGMENTS:
            raise TtsError("VALIDATION_ERROR", 400, "Antwort ist zu lang zum Vorlesen. Bitte Ausschnitt wählen.")
        chars = sum(len(s) for s in segs)

        with self._lock:
            if user_id in self._user_busy:
                raise TtsError("BUSY", 409, "Es läuft bereits eine Vorlesung.")
            day = time.strftime("%Y-%m-%d", time.gmtime(self.clock()))
            used = self._budget.get((tenant, day), 0)
            if used + chars > DAILY_CHAR_BUDGET:
                raise TtsError("BUDGET_EXCEEDED", 429, "Tageskontingent für Vorlesen erreicht.")
            self._budget[(tenant, day)] = used + chars
            self._user_busy.add(user_id)
        status = "failed"
        try:
            if not self._slots.acquire(timeout=2):
                raise TtsError("BUSY", 409, "Sprachdienst ist ausgelastet. Bitte kurz warten.")
            try:
                provider = self.provider_factory[self.config.provider]()
                parts = []
                for seg in segs:
                    if cancel.cancelled:
                        status = "cancelled"
                        raise TtsError("CANCELLED", 499, "Vorlesen abgebrochen.")
                    fut = self._pool.submit(provider.synthesize, seg, self.config.voice_id, TIMEOUT_S)
                    try:
                        parts.append(fut.result(timeout=TIMEOUT_S))  # kein automatischer Retry
                    except FutureTimeout:
                        fut.cancel()
                        status = "timeout"
                        raise TtsError("TIMEOUT", 504, "Stimme antwortet nicht rechtzeitig. Bitte erneut versuchen.")
                    except TtsError:
                        raise
                    except Exception:
                        raise TtsError("PROVIDER_ERROR", 503, "Sprachausgabe fehlgeschlagen.")
                if cancel.cancelled:
                    status = "cancelled"
                    raise TtsError("CANCELLED", 499, "Vorlesen abgebrochen.")
                audio = concat_wav(parts)
                status = "ok"
                return audio
            finally:
                self._slots.release()
        finally:
            with self._lock:
                self._user_busy.discard(user_id)
            self._log(rid, user_id, tenant, status, started, chars, len(segs), self.config.provider)
