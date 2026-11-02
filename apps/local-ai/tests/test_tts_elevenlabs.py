"""ElevenLabs-Anbieter: Freigabe, Anfrageform, Fehlerpfade. Niemals echte API-Aufrufe.

Alle Tests injizieren einen Fake-Transport. Es gibt keinen Netzwerkzugriff.
"""
import io
import json
import os
import unittest
import wave
from unittest import mock

from backend.tts import core as tts
from backend.tts.core import Config, TtsError, TtsService, allowed_providers
from backend.tts.elevenlabs import (
    API_BASE, MODEL_ID, OUTPUT_FORMAT, ElevenLabsError, ElevenLabsProvider, pcm_to_wav,
)

VOICE = "8pVdES9f9x71wHWeQsgz"
SECRET = "sk-test-DO-NOT-LEAK-123"


def _pcm(samples=1600):
    return b"\x01\x00" * samples  # 16-Bit-Mono-PCM


class FakeTransport:
    def __init__(self, reply=None, error=None):
        self.reply, self.error = reply if reply is not None else _pcm(), error
        self.calls = []

    def __call__(self, url, headers, body, timeout):
        self.calls.append((url, headers, body, timeout))
        if self.error:
            raise self.error
        return self.reply


def _env(**extra):
    base = {"ELEVENLABS_API_KEY": SECRET, "TTS_ALLOW_PAID_PROVIDER": "1"}
    base.update(extra)
    return mock.patch.dict(os.environ, base, clear=False)


class GateTests(unittest.TestCase):
    def test_paid_provider_blocked_without_explicit_allow(self):
        with mock.patch.dict(os.environ, {"ELEVENLABS_API_KEY": SECRET}, clear=False):
            os.environ.pop("TTS_ALLOW_PAID_PROVIDER", None)
            self.assertNotIn("elevenlabs", allowed_providers())
            self.assertFalse(Config(provider="elevenlabs", voice_id=VOICE).configured)

    def test_paid_provider_blocked_if_allow_is_not_exactly_one(self):
        with _env(TTS_ALLOW_PAID_PROVIDER="true"):
            self.assertNotIn("elevenlabs", allowed_providers())

    def test_paid_provider_needs_key(self):
        with mock.patch.dict(os.environ, {"TTS_ALLOW_PAID_PROVIDER": "1"}, clear=False):
            os.environ.pop("ELEVENLABS_API_KEY", None)
            self.assertFalse(Config(provider="elevenlabs", voice_id=VOICE).configured)

    def test_paid_provider_needs_voice_id(self):
        with _env():
            self.assertFalse(Config(provider="elevenlabs", voice_id="").configured)

    def test_paid_provider_configured_when_all_conditions_hold(self):
        with _env():
            self.assertTrue(Config(provider="elevenlabs", voice_id=VOICE).configured)

    def test_synthetic_still_works_and_is_not_a_voice_fallback(self):
        with _env():
            self.assertTrue(Config(provider="synthetic-test").configured)
            self.assertFalse(Config(provider="", voice_id=VOICE).configured)


class RequestShapeTests(unittest.TestCase):
    def test_request_uses_voice_model_format_and_key_header(self):
        t = FakeTransport()
        ElevenLabsProvider(api_key=SECRET, transport=t).synthesize("Hallo, ich bin Gini.", VOICE, 20)
        url, headers, body, timeout = t.calls[0]
        self.assertEqual(url, f"{API_BASE}/{VOICE}?output_format={OUTPUT_FORMAT}")
        self.assertEqual(headers["xi-api-key"], SECRET)
        payload = json.loads(body)
        self.assertEqual(payload, {"text": "Hallo, ich bin Gini.", "model_id": MODEL_ID})
        self.assertEqual(timeout, 20)

    def test_key_never_in_body_or_url(self):
        t = FakeTransport()
        ElevenLabsProvider(api_key=SECRET, transport=t).synthesize("Test", VOICE, 20)
        url, _, body, _ = t.calls[0]
        self.assertNotIn(SECRET.encode(), body)
        self.assertNotIn(SECRET, url)

    def test_returns_valid_mono_16k_wav(self):
        t = FakeTransport(reply=_pcm(800))
        wav_bytes = ElevenLabsProvider(api_key=SECRET, transport=t).synthesize("Test", VOICE, 20)
        with wave.open(io.BytesIO(wav_bytes), "rb") as w:
            self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()), (1, 2, 16000))
            self.assertEqual(w.getnframes(), 800)

    def test_odd_byte_count_is_truncated_not_corrupt(self):
        wav_bytes = pcm_to_wav(b"\x01\x00\x02")
        with wave.open(io.BytesIO(wav_bytes), "rb") as w:
            self.assertEqual(w.getnframes(), 1)


class ErrorTests(unittest.TestCase):
    def test_missing_key_raises_without_calling_transport(self):
        t = FakeTransport()
        with self.assertRaises(ElevenLabsError):
            ElevenLabsProvider(api_key="", transport=t).synthesize("x", VOICE, 20)
        self.assertEqual(t.calls, [])

    def test_empty_audio_is_error(self):
        with self.assertRaises(ElevenLabsError):
            ElevenLabsProvider(api_key=SECRET, transport=FakeTransport(reply=b"")).synthesize("x", VOICE, 20)

    def test_transport_error_message_does_not_contain_key(self):
        t = FakeTransport(error=ElevenLabsError("HTTP 401"))
        with self.assertRaises(ElevenLabsError) as cm:
            ElevenLabsProvider(api_key=SECRET, transport=t).synthesize("x", VOICE, 20)
        self.assertNotIn(SECRET, str(cm.exception))

    def test_service_maps_provider_failure_to_503_without_leaking(self):
        with _env():
            svc = TtsService(Config(provider="elevenlabs", voice_id=VOICE),
                             provider_factory={"elevenlabs": lambda: ElevenLabsProvider(
                                 api_key=SECRET, transport=FakeTransport(error=ElevenLabsError("HTTP 500")))},
                             clock=lambda: 0)
            with self.assertRaises(TtsError) as cm:
                svc.synthesize("u1", "t1", "Hallo Welt.")
            self.assertEqual(cm.exception.status, 503)
            self.assertNotIn(SECRET, cm.exception.message)

    def test_service_end_to_end_with_fake_transport(self):
        t = FakeTransport(reply=_pcm(400))
        with _env():
            svc = TtsService(Config(provider="elevenlabs", voice_id=VOICE),
                             provider_factory={"elevenlabs": lambda: ElevenLabsProvider(api_key=SECRET, transport=t)},
                             clock=lambda: 0)
            audio = svc.synthesize("u1", "t1", "Hallo Welt.")
        self.assertTrue(audio.startswith(b"RIFF"))
        self.assertEqual(len(t.calls), 1)


class StatusTests(unittest.TestCase):
    def test_status_never_exposes_key_or_voice_id(self):
        with _env():
            svc = TtsService(Config(provider="elevenlabs", voice_id=VOICE))
            text = json.dumps(svc.status())
        self.assertNotIn(SECRET, text)
        self.assertNotIn(VOICE, text)
        self.assertIn('"paid_provider": true', text)
        self.assertIn('"localOnly": false', text)


if __name__ == "__main__":
    unittest.main()
