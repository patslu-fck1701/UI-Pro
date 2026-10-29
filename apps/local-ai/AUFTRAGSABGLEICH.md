# Vollständiger Abgleich der bisherigen Aufträge – 26.10.2026

Dieser Bericht trennt tatsächlich implementierte Funktionen von bewusst nicht ausgeführten Freigabeschritten und späteren Integrationen. Er ist keine pauschale Produktionsfreigabe.

| Auftrag | Tatsächlicher Stand | Nachweis / Grenze |
|---|---|---|
| Interner Kundenberater statt öffentlichem Fragebogen | In D:/WerkZ implementiert; Login, Gesprächscheckliste, viele gruppierte Bausteine, Abhängigkeiten, interne Kalkulation, gespeicherte Gespräche, Kundenvorschau und getrennter Export | 10 Tests plus Berater-Browserlauf erneut bestanden; localhost:8787/berater/ |
| Bausteine sinnvoll trennen und benennen | Vorhandene Gruppen, Namen und Vorlagen erneut geprüft | Katalog- und Browserprüfung bestanden; kanonische Paketpreise statt erfundener Checkboxpreise |
| Persönliche lokale PIN | Vorhandene vom Nutzer gewählte PIN beibehalten; neuer WERKZ-AI-Zugang verwendet dieselbe Wahl | Keine Werte in Git oder Bericht; Anmeldung am neuen Programm geprüft |
| Öffentliche Handwerksdemo mit vorbereiteten Profilen | Bestehende öffentliche Demo mit fünf Profilen funktioniert | Echter Browserlauf gegen öffentliche Adresse bestanden; externe Dienste bleiben unverbunden |
| Bilder in Handwerksdemo | Sieben passende Motive im separaten UI-Pro-Demo-Branch; lokales Branding zusätzlich in WERKZ AI | Lokale Asset-/Browserprüfung bestanden. Neue öffentliche Bilder noch nicht ausgeliefert |
| Desktop-Zugangsdokument | Bestehendes Dokument um WERKZ AI und lokale Bildvorschau ergänzt; vorherige Datei gesichert | Bestehende Inhalte und Tokens beibehalten; WERKZ-AI-Desktopstart angelegt |
| Lokale KI | Qwen3 über bestehendes llama.cpp verbunden; Chatstream, Verlauf, Suche, Systemprompts, Parameter, Modellneuladen | Echter Modelltest erneut bestanden; andere Modelle nicht geprüft |
| Business und Handwerksdemo im selben WERKZ-AI-Projekt | Kunden, Aufträge, Termine, Notizen, Rechnungen, Rückrufe, Dashboard und lesender KI-Datenzugriff | Integrationstests und tatsächliche Modellantwort auf aktuelle synthetische Aufträge |
| Angebotsassistent | Bis zu 50 Materialzeilen, Arbeitszeit, Cent-/Steuerberechnung und PDF | Mehrpositionen-Kalkulation im Browser und PDF-Inhalt geprüft; unverbindlicher Entwurf |
| Business-Dateianalyse | CSV, XLSX, PDF, JSON, TXT, Statistiken, Diagramme, Berichte und Export | Automatisierte Tests; Mengen-/Dateigrößenlimits dokumentiert |
| Creative Studio | Allgemeine Bild-/Videoprompts, Negative Prompts, Timelines, Charakterbeschreibung, gespeicherte Entwürfe, Anbieter-/Zielmodellwahl, Perchance-Link | Keine Bild-/Videogenerierung oder automatische Übertragung; Metadaten und Promptstudio geprüft |
| Medienbibliothek | Benutzer-/Arbeitsbereichsablage, Bildreferenzen, geschützte Vorschau, Download und Löschung | API- und Modulgrenztests bestanden; Textmodell sieht Bilder nicht |
| DeutschZ | Eigener Chat-/Dateiarbeitsbereich, RPT/Log-Fundstellen, strukturelle XML-Prüfung; Text-/Story-/Promptarbeit über lokale KI | Keine automatische Serveränderung; tatsächliche Mod-Kompatibilität und Serverfunktion nicht behauptet |
| Voice | An echte Demo-Daten angeschlossene Gesprächssimulation sowie lokale Windows-STT/TTS, Mikrofonaufnahme und WAV-Import | Synthetischer Sprach-Rundlauf bestanden; physisches Mikrofon noch bewusst vom Nutzer testen. Keine echte Telefonie |
| Automation / externe Adapter | Gemeinsame erweiterbare Registrierung, Aufgaben, Freigaben und Protokolle für die benannten Dienste | Schnittstellen vorbereitet, keine verbundenen Konten oder ausgeführten externen Aktionen; Tokens unverändert |
| Rollen, Module und Datentrennung | Admin/Staff/Reader, mandantenbezogene Module und Daten, getrennte Demo-/Produktionsspeicher | 14 automatisierte Tests insgesamt, darunter Zugriffssperren und Reset-/Modustrennung |
| Installation und Sicherung | Ein-Klick-Start, Install/Update/Stop/Health, Quellcode-/Frontendpaket, Vollbackup und Restore | Lokale Abläufe geprüft; kein autarker Installer und kein Test auf zweitem Rechner |
| Öffentliche Veröffentlichung, Merge, Kundeneinsatz | Nicht ausgeführt | Ursprünglicher Auftrag verlangt ausdrückliche Freigabe; echte Kundendaten nicht freigegeben |
| Spezieller expliziter Erwachsenenmodus | Nicht implementiert | Allgemeines Creative Studio ist verfügbar; kein gezielter Modus für pornografische Generierung oder Schutzumgehung |

## Noch nicht als abgeschlossen ausweisen

Neue Demo-Bilder sind nicht live veröffentlicht. Physisches Mikrofon, weitere Modelle und ein zweiter Installationsrechner sind nicht geprüft. Externe Medien-/Telefon-/Automationsanbieter sind nicht angeschlossen; dafür wurden keine Zugangsdaten erfunden oder vorhandene Tokens verändert. Ein kundentauglicher Produktionsbetrieb braucht eine gesonderte Abnahme. Diese Punkte sind transparent offen und werden nicht als erledigt umbenannt.
