# Hotelmanagement: erster funktionsgeprüfter Schritt

Stand: 27.10.2026. Quelle: `apps/local-ai` auf `codex/local-ai-demos-20261026` (Draft-PR #74). Nur lokale synthetische Hotel-Demo; kein öffentlicher Deploy.

## Tatsächlich umgesetzt

- Der Hotelüberblick berechnet Zimmer-, Belegungs-, Anreise-, Abreise-, Reinigungs-, Aufgaben- und Hinweiszahlen aus einem mandantengebundenen Datenbank-Snapshot. Kennzahlen öffnen zugehörige Listen. Buchungs- und Reinigungszustand bleiben getrennt.
- Die Rezeption kann einen neuen Gast direkt beim Anlegen einer Reservierung mit Namen und Kontakt speichern. Gast und Reservierung stehen in einer Transaktion; ein Buchungskonflikt hinterlässt keinen verwaisten Gast.
- Bestehende Gastdaten lassen sich mit Revisionskontrolle bearbeiten. Die Verfügbarkeitsabfrage prüft Datum, Personen, Sperren und bestehende bestätigte Buchungen. Der Server prüft den Zeitraum beim Speichern erneut. Die Abreise ist das exklusive Intervallende.
- Der Hotelkontext für Qwen enthält bei berechtigter Frage passende Reservierungen samt Gastname und Quellenangabe aus der Hotel-Datenbank. Das Modell bleibt auf Loopback und erhält keinen allgemeinen SQL- oder Dateizugriff.

## Prüfbelege

- Python: `39 passed, 1 skipped` in der vollständigen lokalen `apps/local-ai/tests`-Suite; Hotel-Szenarien umfassen zwei synthetische Mandanten, Rollenverweigerung, Transaktions-Rollback, Doppelbuchung und zwei konkurrierende Anfragen.
- Browser: `browser_hotel_management.mjs` gegen isolierte temporäre Datenbank und das tatsächlich laufende lokale Qwen: Kennzahlen, Inline-Gast, bestätigte Reservierung, Reload, Filter, Breiten 390/768/1440 und Qwen-Namensabgleich mit dem Datenbankeintrag bestanden. Bilder unter der lokalen Runtime `.runtime/hotel-management-20261027/evidence/`.
- Vorhandene Browserregression `tests/browser_industries.mjs`: Handwerk, Hotel und Schrotties bestanden.
- Vor der Installation wurden die vier bestehenden Quelldateien mit der Git-Basis verglichen. Quellkopien und ein verschlüsselter Datenbank-Snapshot liegen lokal unter `.runtime/hotel-management-20261027/`. Nur Hotel-Port 8001 wurde neu gestartet; andere Demo-Dienste und Qwen blieben erhalten.

## Noch offen aus dem P0-Hotelauftrag

Reservierungen bearbeiten/stornieren mit nachvollziehbarer Historie, Zimmerwunsch und Reservierungsnotizen, vollständig rollengetrennte Housekeeping-Bedienung, kontrollierte Dokument- und Dateiverarbeitung mit Versionierung/Bestätigung, breitere freigegebene KI-Werkzeuge, Tests auf echten Mobilgeräten sowie vollständige Rollenabnahme. Diese Stufe beweist keine vollständige Hotelmanagement-Fertigstellung und keine öffentliche Bereitschaft.
