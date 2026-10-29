# Prüfbericht 2026-10-26

## Folgestand #84 — lokaler Start

31 Python-Tests im installierten App-Verzeichnis bestanden, Build bestanden.
Windows PowerShell 5.1 und PowerShell 7 Start/Health geprüft. Eine Windows-Aufgabe
Limited/IgnoreNew registriert, doppelte Registrierung erzeugt keinen zweiten Eintrag;
direkter Aufgabenplaner-Lauf LastTaskResult 0. Gleichzeitiger Kaltstart zweier Aufrufe
mit einer Backendinstanz und gemeinsamem Qwen bestanden. Hintergrundprozess-Handlefehler
entdeckt und durch den eng begrenzten Launcher korrigiert; isolierter Regressionstest
beweist schließenden Ausgabekanal. Drei Branchen-Browserläufe sowie Chat-Recovery bestanden.
Echter Windows-Re-Login/Reboot/Sleep und direkte externe Verbindungen bleiben ungeprüft.
Siehe docs/WINDOWS_STARTUP.md. GitHub-CI für diesen Folgestand noch ausstehend.

## Aktueller Folgestand — Kontextfehler #75

27 Python-Tests bestanden; TypeScript/Vite-Build bestanden. Neue Tests decken begrenzte
Betriebsdaten-/Dateiauszüge, Erhaltung der Originale, vollständige Verlaufsturns,
zu lange Eingabe und Folgefrage sowie Modellfehler und erneute Antwort ab.
`tests/browser_chat_recovery.mjs`: Fehlererholung im Browser mit simulierten
Inferenzantworten bestanden (HTTP 413, unterbrochener Stream, nächste Frage, Kontexthinweis).
`tests/local_model_context_regression.py`: vorhandenes echtes Qwen auf 8000/8001/8002,
allgemeine Zusammenfassung und zu lange Eingabe mit kurzer Folgefrage in allen drei
Branchen bestanden. Hotel: 3226 Eingabetokens, Modellgrenze 4096; keine Erhöhung.
Die folgenden älteren Ergebnisse sind historische Prüfschritte, kein neuer CI-Beleg.

## Automatisierte API- und Datenprüfungen

Befehl: .venv/Scripts/python.exe -m pytest -q

14 Tests bestanden. Geprüft: Anmeldung, Origin-Schutz, Rollen, Demodatensätze, deterministische Cent-/Steuerrechnung und PDF-Inhalt, gespeicherte Rückrufe, Mandanten- und Resettrennung, deaktivierte Module einschließlich vorhandener Chats, CSV/XLSX/JSON/PDF/XML/RPT-Analyse, Chatstream und gespeicherte Nachrichten, nicht ausgeführte Automationsfreigaben, Sitzungswiderruf, isolierter Produktionsmodus ohne Demodaten sowie vollständige Sicherung/Wiederherstellung und Pfadmanipulation im Archiv. Hinzu kommen Bildvorschau, Zugriffssperre für deaktiviertes Creative-Modul, Dateilöschung, gespeicherte Anbieter-/Zielmodellmetadaten sowie WAV-Validierung und Modulgrenzen der Sprachendpunkte.

Eine Abkündigungswarnung betrifft Starlette TestClient mit httpx. Sie ist kein fehlgeschlagener Test.

## Tatsächliche lokale KI

Befehl: .venv/Scripts/python.exe tests/live_engine.py

Mit dem vorhandenen Qwen3-4B-Q4_K_M geprüft: echter Tokenstream, Antwort auf aktuelle synthetische Betriebsdaten, gespeicherte Chatantwort, strukturierte Transkriptauswertung mit anschließender Rückrufbestätigung und erneutes Laden des installierten Modells. Der Test verwendet einen eigenen temporären Datenraum.

## Browser

Befehl: node tests/browser.mjs

Edge/Playwright mit temporärer API-Instanz: erste Kontoeinrichtung, Kundenanlage, Angebotsrechnung 214,20 EUR, PDF-Download, CSV-Analyse, Modulaktivierung, Promptstudio, tatsächlicher Qwen-Chat sowie Ansichten bei 390, 768 und 1440 Pixeln. Keine erfassten JavaScriptfehler und kein horizontaler Seitenüberlauf. Screenshots werden lokal unter .runtime abgelegt und nicht ausgeliefert.

## Build und Laufzeit

TypeScript/Vite-Build erfolgreich; Abhängigkeitsprüfung npm für Produktionspakete ohne gemeldete Schwachstellen und pip check ohne defekte Abhängigkeiten. Der JavaScript-Build meldet eine nicht blockierende Größenwarnung. Start, erneuter Start, Stop und Gesundheitsabfrage wurden lokal ausgeführt. Anwendung und Modell melden Bereitschaft.

## Nachprüfung des Gesamtauftrags

Mehrpositionen-Angebot zusätzlich im Browser: erste Kalkulation 214,20 EUR, danach zweite Materialzeile mit 2 × 5 EUR netto ergänzt; korrekter Gesamtbetrag 226,10 EUR. Oberfläche kompiliert und Browserlauf bestanden.

tests/live_speech.py: Deutsche lokale Windows-Erkennung und Stimme vorhanden, über authentifizierte API tatsächliche WAV erzeugt und zurücktranskribiert; bestanden. Das ist ein synthetischer technischer Rundlauf, kein Beweis für fehlerfreie Erkennung und kein Test des physischen Mikrofons. Erkennungsfehler wurden beobachtet, Korrektur vor Übernahme bleibt erforderlich. Keine Cloud-Sprachdienste verwendet.

backup.ps1 ohne Parameter tatsächlich ausgeführt: konsistente Vollsicherung angelegt. Start/Stop und abschließender Healthcheck bestanden. Erstkonto persönlich eingerichtet und Anmeldung geprüft; Zugangsdokument außerhalb Git ergänzt. Keine Zugangsdaten im Bericht oder Installationspaket.

Separates D:/WerkZ: 10 Kundenberater-/Katalogtests und Berater-Browserprüfung bestanden. Bestehende öffentliche Handwerksdemo auf demo.werkz-digital.de erneut mit fünf Profilen, Monteur-/Freigabe-/Buchhaltungsablauf, Besucherisolation und responsiver Ansicht geprüft: bestanden. Das war eine Prüfung mit ausschließlich synthetischen Vorführdaten, kein Deployment.

Diese Prüfungen ersetzen weder eine Prüfung mit echten Kundendaten noch eine öffentliche Sicherheits- oder Produktionsabnahme. Externe Telefonie, andere Modelle und externe Medienanbieter wurden nicht als funktionsfähig getestet.


## P0-Fortsetzung: drei Branchen, Offline und Wiederherstellung

Aktueller Lauf: 21 Tests bestanden, keine Fehler, eine TestClient-Abkündigungswarnung. Die frühere Angabe 14 beschreibt den älteren MVP-Stand. Neu enthalten: isolierter Hotel-Fachworkflow, Gästeportal sowie Handwerk und Schrotties; geschützte Wiederherstellung jeder Branche auf Basis ihres echten DB-Schemas.

`node tests/browser_industries.mjs`: bestanden für alle drei Branchen. Zusätzlich mit WERKZ_TEST_RUNNING=1 gegen die gestarteten lokalen Dienste 8000/8001/8002 bestanden: Paket-/Modusprüfung, synthetischer Demo-Einstieg, Profilwechsel, Rollenansicht, Außendienstauftrag starten und Berichtsformular öffnen, Manifest, kein horizontaler Überlauf bei 390/768/1440 Pixeln, keine erfassten JavaScriptfehler. Zugängliche Beschriftung der Profilauswahl korrigiert. Handy-Abmeldung wieder sichtbar; Auftragsfotos für berechtigte Kollegen lesbar, Fremdmandant bleibt gesperrt.

`node tests/browser_offline.mjs`: reale Browser-Netzunterbrechung, verschlüsselte IndexedDB, Offline-Neuladen und Entsperren, genau eine zentrale Zeitbuchung nach Reconnect. Konkurrierende Serveränderung bleibt unverändert; veraltete Offline-Version erscheint als Konflikt. Keine physische iOS-/Android-Prüfung.

`tests/backup_scenarios.py`: geschützte .wzb-Sicherung mit Windows-DPAPI und Lesekontrolle, Wiederherstellung synthetischer Branchendaten, falsches Zielpaket abgewiesen, Sitzungen/Demo-Grants entfernt, beschädigtes Archiv abgewiesen. Originale lokale Datenstände aller drei Demos zusätzlich als .wzb gesichert. Kein Nachweis einer Wiederherstellung nach Verlust des Windows-Profils.

`tests/local_model_demo_smoke.py`: tatsächlicher Qwen-Tokenstream aus berechtigten aktuellen Daten. Handwerk: 1 offener Auftrag (2,19 s); Hotel: Zimmer 205 freigegeben (2,11 s); Schrotties: 1 offener Auftrag (2,53 s). Ein erster Hotellauf hatte einen falschen Zimmerstatus ausgegeben. Daraufhin wurde der Kontext auf angefragte Zimmer und deren eigene Vorgänge eingegrenzt; Regression und erneute echte Inferenz bestanden. Die drei Beispiele beweisen keine allgemeine Modellzuverlässigkeit.

TypeScript/Vite erneut bestanden; Bundlegrößenwarnung offen. Alle drei regulären lokalen Instanzen melden app=ok und engine=ready. Kein öffentlicher Deploy dieses neuen Stands. Gästeportal-Browserablauf, vollständige öffentliche Abnahme und reale Mobilgeräte bleiben offen.

`node tests/browser_hotel_workflow.mjs`: vollständiger Hotelablauf im Edge-Browser bestanden. Alle Fachänderungen über sichtbare Bedienelemente: Checkout, Zuweisung, Checkliste, sperrrelevante Störung, Reparatur, Reinigung abschließen, persönliche Kontrolle, Freigabe, Rezeptionsstatus und Management-Belegung. Anschließend echte lokale Qwen-Antwort zum gerade freigegebenen Zimmer 101 korrekt. Keine erfassten JavaScriptfehler. Screenshot lokal .runtime/hotel-complete-workflow.png.

`node tests/browser_guest_portal.mjs`: separater Rezeptions- und Gästebrowserkontext bestanden. Temporären Code über sichtbare Rezeptionsoberfläche ausgeben, auf 390 Pixeln einloggen, Servicebestellung mit bestätigtem Preis, Sonderwunsch und Allergie absenden, Sichtbarkeit für Küche und Zugangssperre nach UI-Checkout prüfen. Keine Codes oder Passwörter im Testbericht oder Screenshot.
