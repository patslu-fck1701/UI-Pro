# GINI-Sprachausgabe (TTS), Stand 2026-11-02

Status: Lokaler TTS-Kern und Browser-Ersatzstimme geprüft (22 Tests). Gini V10 (ElevenLabs) ist NICHT in diesem Branch. Keine echte Anfrage an einen externen Anbieter ist ausgeführt.

## Zuständigkeiten (verbindlich)
- **WerkZ (Node, `src/integrations/gini*.js`)**: Einziger Ort für kostenpflichtige Anbieter. ElevenLabs für Gini V10 (TTS und STT), KundenZ-Entscheidung, `consent_ref`, Scope-Prüfung. Die Voice-ID steht in `integrations/gini/voice-profile.json`.
- **UI-Pro (Python, `backend/tts/`)**: Ausschließlich lokal und offline. Enthält nur den synthetischen Testanbieter, der keine Stimme ist. Ein Python-ElevenLabs-Adapter existiert hier bewusst NICHT, damit es nicht zwei kostenpflichtige Pfade gibt.
- **Browser (`frontend/src/GiniSpeak.tsx`)**: Ruft zuerst den Server auf. Nur wenn der Server nicht eingerichtet oder nicht erreichbar ist, greift die Browser-Stimme. Sie ist als "Ersatzstimme (Browser), nicht Gini V10" gekennzeichnet.
- **STT**: Lokal über den Windows-Offline-Pfad (`backend/speech.py`, System.Speech). Keine Browser-Spracherkennung, weil Chrome dabei Audio an Google sendet. WerkZ hat zusätzlich einen ElevenLabs-STT-Pfad mit KundenZ-Freigabe. Er wird nur nach Freigabe genutzt.

## Was in diesem Branch ist
- `backend/tts/core.py`: Limits (3000 Zeichen Eingabe, 600 je Segment, 8 Segmente), Einzelauftrag je Benutzer, Parallelitätslimit 2, Zeitlimit 20 s ohne Retry, Abbruch, Tagesbudget je Mandant, Audit ohne Text und Audio.
- `backend/tts/sanitize.py`: Markdown wird zu sprechbarem Text.
- `frontend/src/GiniSpeak.tsx`: Vorlesen-Button mit Sitzungs-ID für die Browser-Ausgabe. Kein Doppelstart, und ein Stopp räumt alle wartenden Starts und Callbacks ab.

## Was NICHT in diesem Branch ist (bewusst)
- `backend/tts/router.py` und die Chat-Verdrahtung in `frontend/src/main.tsx`. Beide hängen an Modulen (`modules/registry`, Hauptoberfläche), die auf `main` fehlen. Sie liegen im lokalen Arbeitsbranch `claude/gini-tts-prototype-20261101`, Commit `73b65b9` und Vorgänger. Der Router dort enthält noch den entfernten Python-ElevenLabs-Pfad und muss vor einer Übernahme bereinigt werden.
- Gini-V10-Anbindung. Sie kommt aus WerkZ, nicht aus diesem Branch.

## Offene Sperren vor Produktivnutzung
1. **Kostenlimit in WerkZ fehlt.** `createGiniSpeechService` prüft Berechtigung, aber nicht die Anzahl oder das Volumen der Anfragen. Nötig sind ein dauerhaftes Tages- und Monatslimit (persistent, nicht nur im Speicher), ein Rate-Limit je Benutzer und ein Audit mit Kosten-Metadaten. Ein Umgebungs-Flag darf kein unbegrenztes Budget freischalten.
2. **Voice-Referenz nicht archiviert.** `voice-profile.json` steht auf `asset_status: not_archived`. Ob die Voice-ID im ElevenLabs-Konto tatsächlich V10 ist, ist nicht geprüft. Das braucht eine Konto-Abfrage, und die ist kostenpflichtig oder zumindest extern.
3. **Hörbestätigung fehlt.** Niemand hat die Ausgabe bisher gehört.
4. **Geräte- und Browsertest fehlt.** Mikrofon, Lautsprecher, Chrome und Firefox. Das geht nur in einer Umgebung mit Gerät.
5. **Vollständiger Build nicht möglich.** Der npm-Registry-Host wird vom Gateway gesperrt (403), und der Offline-Cache enthält die Pakete nicht. `GiniSpeak.tsx` ist nur eingeschränkt typgeprüft (React-Typen fehlen).

## Livetest (vorbereitet, NICHT ausgeführt)
Ein einziger Aufruf mit einem festen Testsatz (41 Zeichen). Er braucht die ausdrückliche Kostenfreigabe von Pat. Das Skript liegt außerhalb des Repos, im Scratchpad. Es hat einen Trockenlauf als Standard und verlangt ein Freigabe-Token. Nach dem ersten Lauf ist es durch eine Marker-Datei gesperrt. Es umgeht bewusst die KundenZ-Entscheidung, nur für diesen einen freigegebenen Lauf.

## Tests
- `cd apps/local-ai && python3 -m pytest tests/test_tts_core.py -q`: 22 Tests, grün.
- WerkZ: `node --test test/gini-voice-transport.test.js` im PR-Branch `feat/gini-voice-stt-tts-20261101`: 6 Tests, grün. Alle Provider-Aufrufe sind Fake-Transporte.
- Frontend: nur eingeschränkte Typprüfung von `GiniSpeak.tsx`.
- Nicht ausgeführt: HTTP-Schicht, Browser-Verhalten der Sprachausgabe, echte ElevenLabs-Anfragen.
