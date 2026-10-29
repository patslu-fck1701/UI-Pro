# Stand 2026-10-26

Der lokale MVP mit Handwerksmodul ist implementiert: Anmeldung und Rollen, Streamingchat, Modellstatus und erneutes Laden des vorhandenen Modells, Verlauf/Suche/Export, Systemprompts, modulare Dateianalyse, Creative-Promptstudio, Businessdaten, Angebotsrechnung/PDF, Transkriptprüfung und Rückrufe, Administration und Backupskripte.

Der reale Qwen-Test hat aktuelle synthetische Aufträge aus der Datenbank in der Antwort verwendet, ein Transkript strukturiert und einen bestätigten Rückruf gespeichert. Das ist eine lokale Integration, keine bloße simulierte Chatantwort. Browserprüfungen verwenden einen getrennten temporären Datenraum.

Die öffentliche Website, D:/WerkZ, bestehende Demoauslieferungen und externe Tokens wurden im Rahmen dieses lokalen Aufbaus nicht verändert. Kein Merge und kein Live-Deployment.

Abnahmegrenzen und offene Erweiterungen stehen in TODO.md und TEST_REPORT.md. Produktionsfreigabe für echte Kundendaten bleibt offen.

Nacharbeit des vollständigen Auftragsabgleichs: Angebotsmaske auf 50 Materialzeilen erweitert; Medienbibliothek mit geschützter Bildvorschau und Löschfunktion ergänzt; Anbieter-/Zielmodellwahl speichert transparente Prompt-Metadaten ohne fremden Dienstaufruf. Lokale Windows-STT/TTS samt Mikrofonaufnahme und WAV-Import implementiert. Echter synthetischer Sprach-Rundlauf über die API bestanden, Erkennungsfehler erfordern menschliche Prüfung. Physisches Mikrofon wurde nicht aufgenommen. Persönlichen Adminzugang mit vorhandener gewählter PIN eingerichtet und Anmeldung geprüft; Creative/DeutschZ für diesen Nutzer aktiviert, Zugangsdokument ergänzt und Desktopstart erstellt. Externe Adapter besitzen gemeinsame erweiterbare Registrierungs- und Freigabeverträge; keine externen Aktionen oder Tokenänderungen.


P0-Fortsetzung: Hotel-, Handwerk- und Schrotties-Oberflächen und Fachabläufe implementiert. 21 automatisierte Tests, drei Branchen-Browserprüfungen, Offline-Konfliktprüfung und geschützte Wiederherstellung bestanden. Lokale Dienste 8000/8001/8002 mit vorhandener Qwen-Engine gestartet und tatsächlich geprüft. Echte Qwen-Antworten für jede Branche bestanden; Fehler im Hotelkontext davor erkannt und korrigiert. Gesamtabnahme bleibt offen; maßgeblich FORTSETZUNGSPLAN.md und TEST_REPORT.md. #72 folgt nach P0; GitHub-/Drive-Nachpflege dieses Checkpoints steht noch aus.
