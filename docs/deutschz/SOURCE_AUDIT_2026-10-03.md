# DeutschZ – Source-Audit 03.10.2026

Verglichene Source-Stände:

- `codex/scheduler-points-rbm-20261003` – aktueller geprüfter Event-/Story-Stand
- `archive/legacy-before-modz-rebuild-2026-09-28` – älterer Vollsource-Vergleich
- `codex/sync-modz-20260711` – älterer Sync-/Migrationsvergleich

## Bestätigt

- WelcomeZ trennt Weltevent-Rotation von persönlichem Storyfortschritt.
- RadioMissionZ ist bereits Story-Director/Funkkanal 89,5 MHz.
- RadioMissionZ enthält Storybezüge zu KOTH, Transport Sieben, Decoder, Signalaktivierung, ToxicZ, ATM, Courier, Battleground und Operation.
- BattlegroundZ und Operation DeutschZ sind technisch bereits verbunden.
- BattlegroundZ liefert registrierten Reader + Operation-KeyCard.
- Operation DeutschZ kombiniert diese zur MasterCardReader-Autorisierung und persistiert Completion.
- Operation EclipseZ ist Legacy/verworfen; aktueller Zweig ist Operation DeutschZ.

## Bestätigte Fehler

### ToxicZ Document Decoder

Aktuell:
`DZToxicZ_DocumentDecoder : ElectronicRepairKit`

Problem:
Decoder kann als Elektronikreparaturset dargestellt werden.

Soll:
GPSReceiver-/CardReader-/Decoder-Vertrag vereinheitlichen.

### BattlegroundZ Reader-Klassenkollision

Aktuell erwartet BattlegroundZ `DZBGZ_CardReader` als Übergabe-/Inventarreader. Dieselbe Klasse dient aber als stationärer Reader und verbietet Hand/Cargo. AIConvoyZ besitzt zusätzlich `deutschz_aiconvoyz_cardreader`.

Soll:
stationären Reader und transportierbares Reader-Item eindeutig trennen; einen kanonischen Klassennamen für die Übergabe verwenden.

## Story-Abweichungen

- ATM RaidZ ist in WelcomeZ/RadioMissionZ aktuell Pflicht; neuer Kanon: optional und nicht blockierend.
- PropertyZ fehlt im persönlichen Hauptstorypfad.
- RAVEN fehlt im persönlichen Hauptstorypfad zwischen CourierZ und BattlegroundZ; bestehender RAVEN-Event bleibt funktional vorerst unverändert.
- ToxicZ besitzt bereits einen Kern mit Signalquelle, zwei Hospitals, NBC-Vorbereitung, Rify, Transport-Sieben-Blackbox, Decoderstation und letzter T-17-Übertragung. Die neue ToxicZ-Roadmap erweitert diesen vorhandenen Kern, statt ihn neu zu bauen.

## Mobile WerkZ-Auswertung

Diese Findings werden im Chef-Assistenten unter Radar → Source angezeigt. Event-Test zeigt zusätzlich eventbezogene bekannte Source-Abweichungen direkt vor dem Start eines Tests.
