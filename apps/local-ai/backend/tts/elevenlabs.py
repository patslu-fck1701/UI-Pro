"""ElevenLabs-Anbieter für GINI V10 (Stimmprofil, bereits ausgewählt).

Sicherheitsregeln:
- Wird nur verwendet, wenn BEIDE gelten: TTS_PROVIDER=elevenlabs UND TTS_ALLOW_PAID_PROVIDER=1.
  Ohne die zweite Freigabe bleibt der Anbieter gesperrt (siehe core.allowed_providers()).
- Der API-Schlüssel kommt nur aus der Umgebung (ELEVENLABS_API_KEY). Er wird nie geloggt,
  nie zurückgegeben und nie in Fehlermeldungen übernommen.
- Es werden ausschließlich Texte gesendet, nie Aufnahmen. Kein Voice-Cloning, kein Upload.
- Kein automatischer Retry (jede Anfrage kostet).
- Tests verwenden einen injizierten Transport und rufen niemals die echte API auf.
"""
from __future__ import annotations

import io
import json
import os
import urllib.error
import urllib.request
import wave
from typing import Callable

API_BASE = "https://api.elevenlabs.io/v1/text-to-speech"
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "pcm_16000"  # rohe 16-Bit-PCM, Mono, 16 kHz -> wird unten als WAV verpackt
SAMPLE_RATE = 16000

# transport(url, headers, body_bytes, timeout) -> bytes ; wirft Exception bei Fehler
Transport = Callable[[str, dict, bytes, float], bytes]


class ElevenLabsError(Exception):
    """Fehler ohne Schlüssel-, Text- oder Antwortinhalt."""


def _urllib_transport(url: str, headers: dict, body: bytes, timeout: float) -> bytes:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        # Nur der Statuscode; Antwortkörper könnte Kontodetails enthalten.
        raise ElevenLabsError(f"HTTP {e.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ElevenLabsError("Verbindung fehlgeschlagen") from None


def pcm_to_wav(pcm: bytes, rate: int = SAMPLE_RATE) -> bytes:
    if len(pcm) % 2:
        pcm = pcm[:-1]  # 16-Bit-Samples müssen vollständig sein
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


class ElevenLabsProvider:
    name = "elevenlabs"

    def __init__(self, api_key: str | None = None, transport: Transport | None = None):
        self._key = api_key if api_key is not None else os.environ.get("ELEVENLABS_API_KEY", "").strip()
        self._transport = transport or _urllib_transport

    def synthesize(self, text: str, voice_id: str, timeout: float) -> bytes:
        if not self._key:
            raise ElevenLabsError("Kein Schlüssel konfiguriert.")
        if not voice_id:
            raise ElevenLabsError("Keine Voice-ID konfiguriert.")
        url = f"{API_BASE}/{voice_id}?output_format={OUTPUT_FORMAT}"
        headers = {"xi-api-key": self._key, "Content-Type": "application/json", "Accept": "audio/*"}
        body = json.dumps({"text": text, "model_id": MODEL_ID}, ensure_ascii=False).encode("utf-8")
        pcm = self._transport(url, headers, body, timeout)
        if not pcm:
            raise ElevenLabsError("Leere Audioantwort.")
        return pcm_to_wav(pcm)
