# GINI-Sprachausgabe (TTS) – Prototyp, Stand 2026-11-01

Status: LOKAL GEPRÜFT (Kern und ElevenLabs-Adapter mit Fake-Transport, 38 Tests) · IM CHAT VERDRAHTET (Vorlesen unter Assistenten-Antworten) · ECHTER ANBIETER GESPERRT BIS ZUR FREIGABE · NICHT GEPUSHT

## Ablauf der Sprachausgabe
1. Gini V10 (ElevenLabs, Voice-ID aus der Serverumgebung) ist der Hauptweg, sobald beide Freigaben gesetzt sind.
2. Ist der Server nicht eingerichtet oder nicht erreichbar, nutzt die Oberfläche eine Browser-Ersatzstimme. Sie ist als "Ersatzstimme (Browser), nicht Gini V10" gekennzeichnet.
3. Die Sprachausgabe hängt nicht vom Denkmodell ab. Sie bekommt nur den fertigen Antworttext.

## Freigabe für ElevenLabs (bewusst abgeschaltet)
- `TTS_PROVIDER=elevenlabs`
- `TTS_ALLOW_PAID_PROVIDER=1` (genau dieser Wert, sonst gesperrt)
- `ELEVENLABS_API_KEY` (nur in der Umgebung, wird nie ausgegeben oder geloggt)
- `TTS_VOICE_ID` = Gini-V10-Voice-ID (nur in der Umgebung, nicht im Code)
- Modell fest: `eleven_multilingual_v2`, Ausgabe `pcm_16000`, als WAV verpackt.
- Jede Anfrage kostet. Es gibt keinen automatischen Retry.
- Tests rufen nie die echte API auf. Sie verwenden einen injizierten Transport.

## Was gebaut ist
- `backend/tts/sanitize.py`: Markdown → sprechbarer Text. Formatierung entfernt, Codeblöcke ausgelassen, Links auf ihren Text reduziert, Segmente begrenzt.
- `backend/tts/core.py`: Dienst mit Limits (3000 Zeichen Eingabe, 600 je Segment), Einzelauftrag je Benutzer, globales Parallelitätslimit 2, Zeitlimit 20 s ohne automatischen Retry, Abbruch zwischen Segmenten, Tagesbudget je Mandant, Audit nur mit Metadaten (kein Text, kein Audio).
- `backend/tts/router.py`: `GET /api/tts/status`, `POST /api/tts/synthesize`, Zugriff über die bestehende Modulprüfung `guard("voice_ai")`. Voice-ID und Anbieter nur aus der Serverumgebung (`TTS_PROVIDER`, `TTS_VOICE_ID`).
- `backend/app.py`: zwei Zeilen zum Einbinden des Routers.
- `frontend/src/GiniSpeak.tsx`: Button "Vorlesen"/"Stoppen" mit Zuständen (bereit, Audio wird erzeugt, Wiedergabe, gestoppt, fehlgeschlagen, Stimme nicht eingerichtet). Nur auf Klick, nur mit `kind: 'answer'`, Mehrfachklick erzeugt keinen zweiten Auftrag, Abbruch und Freigabe beim Verlassen.

## Nicht verwechseln
- Ohne `TTS_PROVIDER` gibt es keine Stimme. Es gibt keine stillschweigende Ersatzstimme.
- `synthetic-test` erzeugt nur einen Ton. Er ist kein Nachweis für GINIs Stimme.
- Kostenpflichtige Anbieter laufen nur über `allowed_providers()` mit `TTS_ALLOW_PAID_PROVIDER=1`. Der Basiswert `ALLOWED_PROVIDERS` bleibt `synthetic-test`.
- Die Browser-Ersatzstimme ist nicht Gini V10 und ersetzt sie nicht.

## Tests
- `cd apps/local-ai && python3 -m pytest tests/test_tts_core.py tests/test_tts_elevenlabs.py -q`: 38 Tests, alle grün in dieser Sandbox.
- Frontend: `GiniSpeak.tsx` nur eingeschränkt typgeprüft. React-Typen fehlen, weil der npm-Registry-Host vom Gateway gesperrt ist (403). Die Prüfung ersetzt keinen vollständigen Build.
- Nicht ausgeführt: HTTP-Schicht (Anmeldung, Benutzerwechsel, anderer Benutzer auf Audio), echte Mikrofon- und Lautsprecherprüfung und jede echte ElevenLabs-Anfrage. Diese Tests gehören in die Betreiberumgebung und brauchen eine ausdrückliche Freigabe.

## Offene Freigabegrenzen (vor einem externen Stimmenauftrag)
1. Anbieter, übertragene Daten, Aufbewahrung und Löschung, Nutzungsbedingungen, voraussichtliche Kosten benennen.
2. Berechtigung zur Nutzung der Stimme klären. Die Aufnahme allein ist keine Freigabe.
3. Ob die Aufnahme überhaupt hochgeladen werden darf. Bisher wurde nichts hochgeladen.

## Zur Aufnahme `voice_gini.mpeg`
- Metadaten: MP3, mono, 44,1 kHz, 128 kbit/s, 16,1 s, SHA-256 `1f8fe668690b26144066da0ec9e3a76589b781b53c2b6bb353a9d9b6a26e4523`.
- Pegel: Spitzenpegel -1,7 dBFS, Mittelwert -21,9 dB, kein DC-Offset, 7 Pausen über 0,4 s.
- NICHT angehört. Eine Hörprüfung ist Sache des Betreibers.
- Die Originaldatei wurde nicht verändert.

## Blockiert
- `D:\voice_gini.mpeg` ist aus der Cloud-Sandbox nicht erreichbar (BLOCKED_LOCAL_AUDIO_ACCESS). Die Analyse stammt aus dem bereitgestellten Anhang.
- Der Chat `/gini` und die Operator-Route liegen laut Gate-Dokument in der WerkZ-Control-Center-Anwendung, nicht in diesem Repo-Stand. Die Lovable-Oberfläche `9081192e-…` ist von hier aus nicht erreichbar.
- Push und Pull Request: nur mit Schreibzugriff. Dieser Branch ist lokal.
