"""GINI Cloud voice output (contract gini-cloud/1.1.0): ElevenLabs TTS with the one owner-selected voice.

The key is injected by the host (Render secret, owned by Codex). GINI Cloud never reads files,
local key stores or the local voice profile; the voice is pinned here and checked by a test
against integrations/gini/voice-profile.json. No voice cloning, no other voice, no STT.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, ProxyHandler

from .contract import GiniCloudError

# GINI V10, take 2 – the only voice GINI may use (owner decision).
GINI_VOICE = {'provider': 'elevenlabs', 'voice_id': '',
              'model_id': 'eleven_multilingual_v2', 'voice_reference': 'V10 take 2', 'language_code': 'de'}
ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128'
MAX_TTS_CHARS = 1200
MAX_AUDIO_BYTES = 8 * 1024 * 1024
# Headers the host must set on the audio response (owner/tenant audio is private).
AUDIO_RESPONSE_HEADERS = {'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store',
                          'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff'}


def is_mp3(data) -> bool:
    """ID3 tag or an MPEG audio frame sync at the start."""
    if not isinstance(data, (bytes, bytearray)) or len(data) < 4:
        return False
    return data[:3] == b'ID3' or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)


class ElevenLabsVoicePort:
    """Budget units are characters (ElevenLabs bills characters): reserve == commit == len(text)."""

    def __init__(self, *, api_key: str, budget, enabled: bool = True, transport=None, timeout: float = 45, voice_id: str = ''):
        self._key = api_key or ''
        self.voice_id = voice_id
        self.budget = budget
        self.enabled = enabled
        self.transport = transport or build_opener(ProxyHandler({}))
        self.timeout = timeout

    def status(self) -> dict:
        base = {'provider': 'elevenlabs', 'voice_reference': GINI_VOICE['voice_reference']}
        if not self.enabled:
            return {**base, 'state': 'offline', 'reason': 'Not-Aus aktiv'}
        if not self._key or not self.voice_id:
            return {**base, 'state': 'NOT_CONNECTED', 'reason': 'Kein Schlüssel im Host konfiguriert'}
        if self.budget.limit <= 0:
            return {**base, 'state': 'offline', 'reason': 'Zeichenlimit 0'}
        return {**base, 'state': 'online', 'reason': 'konfiguriert'}

    def synthesize(self, text: str) -> bytes:
        if not self.enabled:
            raise GiniCloudError('PROVIDER_DISABLED', 503, 'Sprachausgabe per Not-Aus abgeschaltet')
        if not self._key:
            raise GiniCloudError('PROVIDER_NOT_CONFIGURED', 503, 'Sprachausgabe nicht konfiguriert')
        self.budget.reserve(len(text))
        body = json.dumps({'text': text, 'model_id': GINI_VOICE['model_id'],
                           'language_code': GINI_VOICE['language_code']}).encode('utf-8')
        req = Request(ELEVENLABS_TTS_URL.format(voice_id=self.voice_id), data=body, method='POST',
                      headers={'xi-api-key': self._key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        try:
            with self.transport.open(req, timeout=self.timeout) as resp:
                audio = resp.read(MAX_AUDIO_BYTES + 1)
        except HTTPError as exc:
            code = 'PROVIDER_RATE_LIMITED' if exc.code == 429 else 'PROVIDER_REJECTED'
            raise GiniCloudError(code, 502, f'ElevenLabs HTTP {exc.code}') from None
        except (URLError, OSError, TimeoutError):
            raise GiniCloudError('PROVIDER_UNAVAILABLE', 503, 'ElevenLabs nicht erreichbar') from None
        if not audio:
            raise GiniCloudError('PROVIDER_EMPTY', 502, 'Keine Audiodaten erhalten')
        if len(audio) > MAX_AUDIO_BYTES or not is_mp3(audio):
            raise GiniCloudError('PROVIDER_INVALID_AUDIO', 502, 'Antwort ist kein gültiges MP3')
        self.budget.commit(len(text))
        return bytes(audio)


class VoiceCache:
    """Short-lived audio cache per tenant + principal, so replay and double clicks cost nothing.

    In memory only, never persisted. Hosts that build a GiniCloud per request share one instance
    (default: module-level DEFAULT_VOICE_CACHE). Cleared per principal on logout.
    """

    def __init__(self, *, ttl_seconds: int = 15 * 60, max_entries: int = 30, monotonic=time.monotonic):
        self.ttl = ttl_seconds
        self.max = max_entries
        self._now = monotonic
        self._items: dict[tuple, tuple[float, bytes]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def key(tenant_id: str, principal_id: str, text: str) -> tuple:
        return tenant_id, principal_id, hashlib.sha256(text.encode('utf-8')).hexdigest()

    def get(self, key: tuple):
        now = self._now()
        with self._lock:
            for k, (stamp, _) in list(self._items.items()):
                if now - stamp > self.ttl:
                    del self._items[k]
            hit = self._items.get(key)
            return hit[1] if hit else None

    def put(self, key: tuple, audio: bytes) -> None:
        with self._lock:
            if key not in self._items and len(self._items) >= self.max:
                del self._items[min(self._items, key=lambda k: self._items[k][0])]
            self._items[key] = (self._now(), audio)

    def clear_principal(self, tenant_id: str, principal_id: str) -> int:
        with self._lock:
            gone = [k for k in self._items if k[0] == tenant_id and k[1] == principal_id]
            for k in gone:
                del self._items[k]
            return len(gone)


DEFAULT_VOICE_CACHE = VoiceCache()
