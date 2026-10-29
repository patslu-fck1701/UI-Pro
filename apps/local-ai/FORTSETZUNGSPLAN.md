# WERKZ – verbindlicher Fortsetzungsstand

## Master Control und bedienbares AiZ – 29.10.2026

Aktueller Entwicklungsauftrag: `docs/MASTER_CONTROL_HOTEL_2026-10-29.md`.
AiZ-Adaptercheckpoint435db78 hat beide Wissenswege und echten Qwen-Aufruf geprüft.
Folgecheckpoint c2f347f schützt gespeicherte Wissensgespräche/Export nach Widerruf.
Neue Entwicklungsstufe ergänzt vorhandene Betreiberansicht, CAS-gesicherte
Hotelrollenänderung, Verbindungsprobes/Veraltung und AiZ-Chatoption mit Quellen.
Keine zweite Rechteverwaltung oder KI-Engine. Rechteentzug via tatsächlichem
Betreiber-PATCH während laufendem Hotelstream zusätzlich getestet.
Offline-Widerruf für Hotel ergänzt: nach `/api/me`-Abgleich werden alte Modul-Caches
und Entwürfe entfernt, die App-Identität aktualisiert und vorgemerkte Schreibvorgänge
zur Prüfung gesperrt. Browser-/Buildnachweis und Grenze ohne Netz stehen in
`docs/OFFLINE_ENTITLEMENT_REVOCATION_2026-10-29.md`.
Persönliche installierte Anwendung NICHT aktualisiert, keine echten Rollen geändert.
Produktive Modulfreigaben, Betriebswechsel und externe Identitätsföderation bleiben
gesondert offen. Frühere Angaben zu offenen laufenden KI-Widerrufen sind historisch;
die neuen Stream- und gespeicherten Gesprächsprüfungen sind in den Berichten belegt.

### Abgleich 29.10.2026

- Offline-Modulwiderruf: `npm run build`, `node tests/browser_offline.mjs` sowie
  `pytest tests/test_entitlements.py tests/test_stream_revocation.py -q` bestanden
  (4 Backendtests). Änderungen sind lokal, noch nicht installiert.
- PR #74 ist weiterhin Draft auf Remote-Head `20b9389d3e872387313c9bb2ddd6268e68c35ce5`.
  Der aktuelle CI-Run wurde vom GitHub-Kontogate abgewiesen (fehlgeschlagene Zahlung
  oder Spending-Limit); kein Job startete. Deshalb nicht gepusht oder blind neu gestartet.
- Render-Readback im bestätigten Workspace: `werkz-pilot-db` steht weiterhin auf Free
  und läuft laut Render am 06.11.2026 aus; `werkz-business-db` steht auf `basic_256mb`.
  Kein Datenbankplan geändert.
- Lovable-Projekt-Readback: Preview-Head `5f806d6030b6063c8ca5af48e4d0653da07810bb`,
  `publish_audience=public`. Keine Veröffentlichung vorgenommen. Der Connector verweigerte
  einen weiteren Agentenlauf mit „Workspace out of credits“; Google-OIDC ist daher nicht
  erneut geprüft oder durch einen echten Betreiber-Consent bestätigt.

## Hotel-Steuerung und Mission V3 – 29.10.2026

Mission V3 ersetzt den bisherigen Umbauauftrag im bestehenden Operationspfad
`docs/operations/WERKZ_AIZ_UNIFIED_REBUILD_2026-10-28.md` (Git-Historie erhalten).
Hotel zuerst bleibt aktuelle konkrete Priorisierung. Neue Backendstufe:
`docs/HOTEL_CONTROL_BINDINGS_2026-10-29.md` – laufende KI-Widerrufe, Hotelkontenrollen,
private Operator-Readbacks und begrenzter read-only AiZ-Port. Plugins sind keine
automatisch verbundenen MCP-Dienste. Keine Wissensfreigaben oder Kundendatenimporte.

## Persönlicher Hotel-Programmstart – 29.10.2026

Betreiberauftrag ersetzt die reine Vorführnutzung: vorhandene Anwendung startet als
Package hotel / Mode production mit leerem eigenen Datenbestand, ohne Demo-Profile,
Seeds oder Reset. Details `docs/HOTEL_PROGRAM_2026-10-29.md`. Kein globaler
Produktionsreife-Nachweis. Hauptstarter und lokale Autostartprüfung auf Hotelprogramm
umgestellt. Zugangsdaten ausschließlich lokal gehasht; niemals in Fortsetzungszeigern.

## Vorrangiger Umbauauftrag und PR-Abgleich – 28.10.2026

Aktuelle Priorisierung: Hotel einschließlich KI Nummer1, danach Handwerk; Schrotties
zurückgestellt. Erste tatsächliche Modulsteuerung im vorhandenen Backend und UI:
`docs/HOTEL_ENTITLEMENTS_2026-10-28.md`. Persistente Freigaben mit Ablauf/Widerruf,
Revisions-/Race-Schutz, Core-Vertragsparität, HTTP-Negativ- und Browserprüfungen.
Produktive KundenZ-Policy, gemeinsamer Mehrbetriebs-Login und laufende KI-Widerrufe
sind noch offen; keine Vollfertigstellung daraus ableiten.

Aktueller Benutzerauftrag: eine gemeinsame WerkZ-App mit serverseitig freigegebenen
Fachmodulen, einer Qwen-Engine und separatem AiZ-Wissensspeicher. Keine weitere
unabhängige Branchen-App entwickeln. WebsitePublisher23947 vollständig unverändert.
Vor weiteren Funktionsänderungen vollständigen PR-Abgleich lesen:
`../../docs/operations/PR_RECONCILIATION_2026-10-28.md` (ab Repositorywurzel:
`docs/operations/PR_RECONCILIATION_2026-10-28.md`). Auftrag:
`docs/operations/WERKZ_AIZ_UNIFIED_REBUILD_2026-10-28.md`.
Der Bericht enthält alle18WerkZ- und einenAiZ-PR, Konfliktdateien, geprüfte lokale
Auflösungen und offene Gates. Alte Checkpoints unten sind historische Nachweise.
Nächster Schnitt: bestehende Modul-/Auth-Verträge zusammenführen, danach geschützten
Betreiber-Kundenberater und KnowledgeSearchPort anbinden. Keine pauschalen Merges.

## P0-Original-HTTP-Folgeabnahme — 27.10.2026

Vollständige minimale Pilot-Serviceclosure des festgelegten UI-Pro-Commits50d9145
lokal ermittelt. Achtung: sein Pilotmodul e6a3efad ist nicht bytegleich mit dem
archivierten Mirror3802f3ff; beide unverändert erhalten und historische Äquivalenz
annotiert. Neuer HTTP-Abnahmetest auf127.0.0.1 mit zwei synthetischen Mandanten,
Reader, statischen Preisen, Dateireload, Rechner→Auftrag→Tour→Abschluss und gesperrtem
externen Fetch: je7/7Tests an beiden Versionen bestanden. Gesamtverify260pass/1skip.
Bericht: `docs/SCHROTTIES_ORIGINAL_HTTP_2026-10-27.md`. Keine Original-UI gestartet,
keine Geschäftsdatensätze/Migration/Provider. Nächster P0-Schritt: Original-UI-Testhost
mit überprüften Host-/Origin-/Sessiongrenzen und Browserablauf, kein alter Live-Server.

## P0-Schrotties-Folgeabgleich — 27.10.2026

Unverändertes17-Dateien-Originalarchiv vollständig bytegleich geprüft. Originale
Offline-UI-/Runtime-Suite:71/71bestanden (23VM-Runtimefälle,48Quellinvarianten), kein
physischer Geräte- oder Livebeleg. Funktionsmatrix und Startvoraussetzungen:
`docs/SCHROTTIES_PARITY_2026-10-27.md`. Der Mirror allein ist unvollständig und sein
alter Server bindet0.0.0.0/Live-Preisprovider; deshalb nicht unverändert starten.
Nächster P0-Schritt: vollständige commitgebundene Abhängigkeiten ermitteln und Original-
Service zuerst mit zwei synthetischen Mandanten, statischen Preisen, Loopback und
verweigertem externen Netz testen. Keine Python-Neufassung als Originalparität melden.

## Aktueller Folgeabgleich — 26.10.2026, 22:50 UTC

Drei installierte Branchendemos antworten /api/health mit200/appok/engineready.
Windows-Aufgabe LastTaskResult0. #75-Kontextfix und #84-Startcheckpoint bleiben
geprüft; physische Geräte, echter Windows-Login/Resume und öffentliche Hotel-/
Schrotties-Abnahme offen. Kein neuer Modell-/DB-/Provideradapter aktiviert.

Control Center: Design und acht optimierte Originalmotive im Preview umgesetzt
(Design/WebP5bf6a139; aktueller gelesener Headde3ecfac); nicht veröffentlicht.
102 Tests/5 Cloud-Skips und Build laut Lovable-Validierung, keine physische Geräteabnahme.
AI_GATEWAY_URL=null; der Copilot ist noch nicht mit Qwen verbunden. ElevenLabs ist
über den Chat-Connector lesend erreichbar; kein lokaler Adapter oder Audio erzeugt.

PR86/bbae465 bereitet Altlinkkorrektur vor; NICHT veröffentlichen, bis der Betreiber
explizit freigibt. Bericht: ../../docs/audits/RETIRED_ADVISOR_LINK_REPAIR_2026-10-26.md
im eigenen Reparaturbranch, nicht im P0-Branch. Drei Altlinks bleiben öffentlich bis
zur Freigabe; Berater410bewusst, Domain301/Pilot303korrekt. P0-Arbeit unabhängig fortsetzen.

Native Codex-Automation ACTIVE310Minuten. Tatsächlicher Trigger um22:50:10 UTC
beobachtet; zweiter echter Trigger am27.10. um04:00:45 UTC. Abstand310Minuten35Sekunden,
Zwei-Lauf-Beobachtung belegt (docs/operations/NATIVE_RESUME_EVIDENCE_2026-10-27.json). Kein neuer
Runner, kein garantierter Quota-/Offline-Neustart. Historische Angaben unten bleiben
nur als Archiv stehen; dieser Abschnitt hat bei Widersprüchen Vorrang.

## Folgestand #84 — Windows-Start und weitere Integration

Eine vorhandene lokale Startarchitektur erweitert und im installierten Ziel eingerichtet:
ein Anmeldetask, Mutex, Healthstatus, feste Recovery ohne destruktive Aktionen.
31 Python-Tests, Build, gleichzeitiger Start, Modellneustart und Aufgabenplaner-Lauf
bestanden. Echte Neuanmeldung/Reboot/Sleep bleiben offen. Direkte Cloudadapter noch
nicht lokal eingerichtet; kein behaupteter Sync. Lovable Control Center am Head
43d8610a34b4406c1a9fb746f1249b4d188f543a gelesen: bestehender Copilot fail-closed,
noch kein Modell verbunden. Nächster Schritt #72/#79 sichere Verbindung vorbereiten,
ohne öffentlichen Qwen-Port, neue Parallelplattform oder Veröffentlichung.
Nach vollständiger Funktionsabnahme: vollständige belegte Funktionsübersicht und
kundenorientierte gesprochene Erklärungen mit dem ausdrücklich gewünschten ElevenLabs-Plugin;
dessen tatsächliche Verfügbarkeit/Budget vor Nutzung prüfen. Keine Anbieterersetzung behaupten.

## Aktuell: 26.10.2026, Kontextkorrektur #75

Integrationsbranch `codex/local-ai-demos-20261026`, Draft-PR #74. Kontextkorrektur lokal
mit 27 Python-Tests, Frontend-Build, Browser-Fehlererholung und echten Qwen-Abfragen in
allen drei Branchen geprüft. Neuer CI-Nachweis nach Push noch ausstehend.
Codex-Fortsetzung ACTIVE **alle 5 Stunden 10 Minuten**, direkt vom Nutzer klargestellt;
ältere tägliche/stündliche Angaben unten sind überholt. #78 kurzer Pointer-Abgleich
branchlokal begonnen; als Nächstes #84 bestehenden Windows-Start vervollständigen und
verbleibende P0-Demo-Abnahme, danach #72 sowie #76–#82. Kein Modelltraining/Kostenauftrag.
Schrotties-Originalabgleich und reale Mobilgeräte bleiben offen.
Nach jedem materiellen Schritt Quellen/Revision/Tests/Sync-Status mit Readback pflegen.
Details: `../../docs/operations/GITHUB_RECONCILIATION_2026-10-26.md`.

Die folgenden älteren Abschnitte bleiben als historischer Nachweis erhalten.

Stand: 26.10.2026, Europe/Berlin. Laufender Branch: codex/hotel-demo-20261026.

## Reihenfolge

1. **P0 IN_PROGRESS:** Hotel, Handwerk und Schrotties funktional abschließen. Rollen, Mandantentrennung, Gastportal, Offline-Konflikte, Wiederherstellung und Browserabläufe prüfen. Bestehende lokale Änderungen erhalten. Kein vollständiges Demo-Gate allein aus grünem Build ableiten.
2. **P1 PLANNED:** Plattform-Abgleich, bestehendes Cockpit gemäß Issue #66 wiederverwenden, Mission Control/Testlabor gemäß [#71](https://github.com/patslu-fck1701/WerkZ/issues/71). Eigenständiger Integrationsbranch erst am gesicherten P0-Checkpoint. Hauptindex [#70](https://github.com/patslu-fck1701/WerkZ/issues/70) vor externen Schreibvorgängen erneut abgleichen.
3. **P1 PLANNED:** [WERKZ AI Core #72](https://github.com/patslu-fck1701/WerkZ/issues/72), am 26.10.2026 direkt über GitHub gelesen. Vorhandene lokale Qwen-/llama.cpp-Anbindung, Core-Tools, Module und Datenbanken wiederverwenden. Kein Modelltraining, keine unnötige Neuinstallation.

## Stufen für #72

- Stufe 0: Lesende Inventur des aktuellen Modellservers, Provider-Layers und vorhandener Suche. Historische Port-/Modellangaben nicht als aktuellen Laufnachweis ausgeben.
- Stufe 1: Nach gesichertem Demo-Checkpoint ein freigegebenes nicht sensibles Handbuch, vorhandene Suche oder SQLite FTS5, drei belegte Fragen inklusive ehrlichem Quellenfehler. Quellenlink, Version und Zugriffsgrenzen prüfen.
- Stufe 2: Branchen getrennt anbinden; Rollen, Tenants, Löschung und inkrementelle Aktualisierung testen. Laufende Betriebszustände ausschließlich über autorisierte Core-Lesezugriffe; Suchindex bleibt erneuerbarer Cache.
- Stufe 3: Nur bei gemessenem Bedarf Embeddings/Cloud bewerten. Keine Anbieterbuchung, Uploads oder Training ohne passende gesonderte Entscheidung.

## Prüfstand dieser Fortsetzung

- `python -m pytest -q`: 21 bestanden; umfasst isolierte Fachabläufe aller drei Branchen sowie Sitzungssperre nach Hotel-Abmeldung und Abweisung falscher Actor-/Tenant-Bindungen.
- `npm run build`: TypeScript und Vite bestanden; Bundlegrößenwarnung bleibt offen.
- `node tests/browser_offline.mjs`: bestanden in Edge Headless. Echte Netzwerkunterbrechung im Browser, verschlüsselte IndexedDB, ausstehende Zeitbuchung, Offline-Neuladen/Entsperren, Reconnect und genau eine zentrale Buchung nachgewiesen. Ein konkurrierender Serverstand bleibt erhalten; die veraltete Offline-Änderung wird als Konflikt angehalten.
- `node tests/browser_industries.mjs`: drei Branchen bestanden; zusätzlich gegen die gestarteten Instanzen 8000/8001/8002 geprüft. Profilwechsel, beschränkte Außendienstansicht, Auftrag starten und Formular öffnen, Manifest und 390/768/1440 Pixel.
- Vollständiger Hotel-Browserworkflow einschließlich aktueller echter Qwen-Statusantwort bestanden.
- Gastportal-API und geschützte Sicherung/Wiederherstellung aller drei realen Demo-Schemata bestanden.
- Echte Qwen-Antworten: Handwerk 1 offener Auftrag (2,19 s), Hotel Zimmer 205 freigegeben (2,11 s), Schrotties 1 offener Auftrag (2,53 s). Initialer falscher Hotelstatus durch unnötigen Fremdkontext entdeckt; Zimmerkontext eingegrenzt, Regressionstest ergänzt. Kein allgemeines Qualitätsversprechen.
- Offen: reale iOS-/Android-Geräte, öffentliche Hotel-/Schrotties-Bereitstellung und externe Nachpflege.
- Backend-Sitzungswiderruf korrigiert: paketabhängiges Cookie wird serverseitig entfernt. Offline-Anfragen werden an Actor/Tenant gebunden und verspätete Antworten nach Kontowechsel verworfen.

## Nachpflege gemäß #71

Nach jedem Ticket betroffene Quellen, Datenbanken, Tests, Dokumentation und externen Readback protokollieren. `UPDATED / UNCHANGED / NOT_APPLICABLE / BLOCKED / NOT_SYNCHRONIZED` unterscheiden. Persönliche Eigenarbeitszeit nur aus echten Angaben; Agentenlaufzeit ist kein menschlicher Arbeitszeitnachweis. Historische Schätzungen nicht erneut buchen.

Aktuell: lokale Quellen und dieses Journal UPDATED; keine Schemaänderung durch die Sitzungskorrektur (DB-Migration NOT_APPLICABLE); GitHub-Issues #71/#72 gelesen, noch kein externer Fortschrittskommentar; Drive und Mission Control NOT_SYNCHRONIZED. Keine produktive Veröffentlichung dieser Änderungen. Keine menschliche Zeit gebucht.

## Automationen

Codex-Heartbeat `werkz-t-gliche-pr-fung-und-fortsetzung` aktiv, täglich 09:00, für konfliktfreie Fortsetzung und Prüfung. Kontingentgrenzen bleiben wirksam; keine garantierte sofortige Wiederaufnahme beim Reset. Der laut #71 bestehende ChatGPT-Tagesstatus 12:15 und die stündliche Alarmüberwachung werden nicht dupliziert. Deren Ausführung ist in dieser Fortsetzung noch nicht selbst verifiziert.

Zusätzlicher Nachweis: Gästeportal-Browserablauf bestanden (Rezeptionscode, getrennte Gastsitzung, Bestellung, Küchenansicht, Checkout-Widerruf). Schrotties-Originalquellen als unveränderte lokale Kopie unter .runtime archiviert; SHA-256/Dateizahl in docs/SCHROTTIES_ORIGINAL_SOURCE.json. Das beweist keine Funktionsparität der neuen Demo mit dem alten Pilot.
