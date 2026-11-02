import io
import os
import tempfile
import threading
import time
import unittest
import wave

from backend.tts import core as tts
from backend.tts.core import CancelToken, Config, SyntheticProvider, TtsError, TtsService, concat_wav
from backend.tts.sanitize import segments, to_plain


def wav_frames(data):
    with wave.open(io.BytesIO(data), "rb") as w:
        return w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()


class ScriptedProvider:
    """Testanbieter. Ist nie der Produktionsanbieter, prüft nur das Verhalten des Dienstes."""
    behaviour = None

    def synthesize(self, text, voice_id, timeout):
        return ScriptedProvider.behaviour(text, voice_id, timeout)


def service(provider=None, provider_name="synthetic-test", voice="v-test", clock=None):
    f = {"synthetic-test": SyntheticProvider if provider is None else (lambda: provider)}
    kw = {"clock": clock} if clock else {}
    return TtsService(Config(provider=provider_name, voice_id=voice), provider_factory=f, **kw)


class SanitizeTests(unittest.TestCase):
    def test_markdown_removed(self):
        md = "## Titel\n**Fett** und _kursiv_ mit [Link](https://x.y) und `code`.\n- Punkt eins\n1. Punkt zwei"
        out = to_plain(md)
        self.assertEqual(out, "Titel Fett und kursiv mit Link und code. Punkt eins Punkt zwei")

    def test_codeblocks_skipped(self):
        md = "Vorher.\n```python\nprint('geheim')\n```\nNachher."
        self.assertNotIn("print", to_plain(md))
        self.assertIn("Vorher.", to_plain(md))
        self.assertIn("Nachher.", to_plain(md))

    def test_table_separator_and_pipes(self):
        md = "| A | B |\n|---|---|\n| 1 | 2 |"
        self.assertEqual(to_plain(md), "A B 1 2")

    def test_html_removed(self):
        self.assertEqual(to_plain("Hallo <b>fett</b> Welt"), "Hallo fett Welt")

    def test_empty_after_cleanup(self):
        self.assertEqual(segments("```\nnur code\n```"), [])
        self.assertEqual(segments("   "), [])

    def test_segments_bounded_and_split_long_sentence(self):
        long = " ".join(["Wort"] * 400)  # ohne Satzzeichen
        segs = segments(long, max_chars=100)
        self.assertTrue(all(len(s) <= 100 for s in segs))
        self.assertEqual(" ".join(segs), long)

    def test_sentences_grouped(self):
        text = "Eins. Zwei. Drei."
        self.assertEqual(segments(text, 600), ["Eins. Zwei. Drei."])
        self.assertEqual(segments(text, 8), ["Eins.", "Zwei.", "Drei."])


class ConfigTests(unittest.TestCase):
    def test_not_configured_by_default_no_substitute_voice(self):
        s = TtsService(Config())
        self.assertFalse(s.status()["configured"])
        with self.assertRaises(TtsError) as e:
            s.synthesize("u1", "t1", "Hallo")
        self.assertEqual(e.exception.code, "NOT_CONFIGURED")
        self.assertEqual(s.audit, [])  # nicht konfiguriert: kein Auftrag, kein Audit

    def test_unknown_provider_rejected(self):
        s = TtsService(Config(provider="https://evil.example", voice_id="x"))
        self.assertFalse(s.status()["configured"])

    def test_test_provider_needs_no_voice_and_empty_provider_never_configured(self):
        self.assertTrue(Config(provider="synthetic-test").configured)  # nur Testanbieter, keine Ersatzstimme für echte Anbieter
        self.assertFalse(Config(provider="", voice_id="v").configured)


class ServiceTests(unittest.TestCase):
    def test_happy_path_returns_wav_and_metadata_only_audit(self):
        s = service()
        audio = s.synthesize("u1", "t1", "**Hallo** Welt. Zweiter Satz.")
        frames, rate, ch, width = wav_frames(audio)
        self.assertEqual((rate, ch, width), (16000, 1, 2))
        self.assertGreater(frames, 0)
        entry = s.audit[-1]
        self.assertEqual(entry["status"], "ok")
        self.assertNotIn("text", entry)
        self.assertNotIn("Hallo", str(entry))  # kein Antworttext im Audit

    def test_empty_and_too_long_rejected(self):
        s = service()
        for bad, code in (("", "VALIDATION_ERROR"), ("   ", "VALIDATION_ERROR"),
                          ("a" * (tts.MAX_INPUT_CHARS + 1), "VALIDATION_ERROR"),
                          ("```x```", "VALIDATION_ERROR")):
            with self.assertRaises(TtsError) as e:
                s.synthesize("u1", "t1", bad)
            self.assertEqual(e.exception.code, code)

    def test_limits_are_consistent_worst_case_stays_under_segment_cap(self):
        # Schlimmster Fall: maximale Eingabe mit Sätzen nahe der Segmentgrenze.
        worst = (("Satz " + "x" * 590 + ". ") * 10)[:tts.MAX_INPUT_CHARS]
        self.assertLessEqual(len(segments(worst, tts.SEGMENT_CHARS)), tts.MAX_SEGMENTS)
        self.assertTrue(service().synthesize("u1", "t1", worst))

    def test_timeout_no_retry(self):
        calls = []

        def slow(text, voice, timeout):
            calls.append(1)
            time.sleep(0.5)
            return b""

        old = tts.TIMEOUT_S
        tts.TIMEOUT_S = 0.05
        try:
            ScriptedProvider.behaviour = slow
            s = service(ScriptedProvider(), )
            with self.assertRaises(TtsError) as e:
                s.synthesize("u1", "t1", "Ein Satz.")
            self.assertEqual(e.exception.code, "TIMEOUT")
            self.assertEqual(len(calls), 1)  # kein automatischer Retry
            self.assertEqual(s.audit[-1]["status"], "timeout")
        finally:
            tts.TIMEOUT_S = old

    def test_provider_error_is_safe(self):
        def boom(text, voice, timeout):
            raise RuntimeError("secret-key-abc123 leaked in message")

        ScriptedProvider.behaviour = boom
        s = service(ScriptedProvider())
        with self.assertRaises(TtsError) as e:
            s.synthesize("u1", "t1", "Ein Satz.")
        self.assertEqual(e.exception.code, "PROVIDER_ERROR")
        self.assertNotIn("secret", e.exception.message)

    def test_cancel_before_start(self):
        s = service()
        tok = CancelToken()
        tok.cancel()
        with self.assertRaises(TtsError) as e:
            s.synthesize("u1", "t1", "Ein Satz.", cancel=tok)
        self.assertEqual(e.exception.code, "CANCELLED")
        self.assertEqual(s.audit[-1]["status"], "cancelled")

    def test_cancel_during_generation_between_segments(self):
        tok = CancelToken()
        count = []

        def first_then_cancel(text, voice, timeout):
            count.append(1)
            tok.cancel()
            return SyntheticProvider().synthesize(text, voice, timeout)

        ScriptedProvider.behaviour = first_then_cancel
        s = service(ScriptedProvider())
        text = ". ".join(["Ein Satz mit etwas Länge"] * 40) + "."
        text = text[:tts.MAX_INPUT_CHARS]
        with self.assertRaises(TtsError) as e:
            s.synthesize("u1", "t1", text, cancel=tok)
        self.assertEqual(e.exception.code, "CANCELLED")
        self.assertEqual(len(count), 1)  # keine weiteren Segmente nach Abbruch

    def test_double_click_same_user_is_busy(self):
        gate = threading.Event()

        def hold(text, voice, timeout):
            gate.wait(2)
            return SyntheticProvider().synthesize(text, voice, timeout)

        ScriptedProvider.behaviour = hold
        s = service(ScriptedProvider())
        results = {}

        def first():
            results["first"] = s.synthesize("u1", "t1", "Erster Auftrag.")

        th = threading.Thread(target=first)
        th.start()
        time.sleep(0.1)
        with self.assertRaises(TtsError) as e:
            s.synthesize("u1", "t1", "Zweiter Auftrag.")
        self.assertEqual(e.exception.code, "BUSY")
        gate.set()
        th.join(5)
        self.assertIn("first", results)
        # nach Abschluss ist der Benutzer wieder frei
        self.assertTrue(s.synthesize("u1", "t1", "Dritter Auftrag."))

    def test_other_user_not_blocked(self):
        gate = threading.Event()

        def hold(text, voice, timeout):
            gate.wait(2)
            return SyntheticProvider().synthesize(text, voice, timeout)

        ScriptedProvider.behaviour = hold
        s = service(ScriptedProvider())
        th = threading.Thread(target=lambda: s.synthesize("u1", "t1", "Eins."))
        th.start()
        time.sleep(0.1)
        self.assertTrue(s.synthesize("u2", "t1", "Zwei."))
        gate.set()
        th.join(5)

    def test_daily_budget_per_tenant(self):
        old = tts.DAILY_CHAR_BUDGET
        tts.DAILY_CHAR_BUDGET = 30
        try:
            s = service(clock=lambda: 1_800_000_000.0)
            s.synthesize("u1", "t1", "Ein kurzer Satz hier.")  # 21 Zeichen
            with self.assertRaises(TtsError) as e:
                s.synthesize("u2", "t1", "Noch ein Satz, der zu viel ist.")
            self.assertEqual(e.exception.code, "BUDGET_EXCEEDED")
            self.assertTrue(s.synthesize("u1", "t2", "Anderer Mandant."))
        finally:
            tts.DAILY_CHAR_BUDGET = old

    def test_no_temp_files_written(self):
        with tempfile.TemporaryDirectory() as d:
            old = tempfile.tempdir
            tempfile.tempdir = d
            try:
                service().synthesize("u1", "t1", "Ein Satz.")
            finally:
                tempfile.tempdir = old
            self.assertEqual(os.listdir(d), [])

    def test_concat_rejects_mixed_formats(self):
        a = SyntheticProvider().synthesize("abc", "", 1)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(b"\0" * 400)
        with self.assertRaises(TtsError):
            concat_wav([a, buf.getvalue()])


if __name__ == "__main__":
    unittest.main()
