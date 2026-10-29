# WERKZ AI

Lokales Beratungs- und Arbeitsprogramm mit Qwen3-4B, persönlicher Anmeldung und modularer Oberfläche. Standardpaket: Handwerksdemo mit ausschließlich synthetischen Beispieldaten.

## Start

Doppelklick auf Start-WERKZ-AI.cmd. Oberfläche: http://127.0.0.1:8000. Der Start lädt das bereits vorhandene lokale GGUF-Modell und öffnet die Oberfläche. Wiederholter Start verwendet die passende laufende Instanz. Erstinstallation: install.ps1. Modelle werden nicht mitgeliefert.

## Nutzbare Funktionen

- Lokaler Chat mit Streaming, Verlauf, Suche, Systemprompt, Modellparametern, Abbruch und Export.
- Kunden, Aufträge, Notizen, Termine, Prioritäten, Status, Rechnungsübersicht und Rückrufe in SQLite.
- Deterministische Angebotsrechnung mit PDF; KI liest auf Wunsch die aktuellen Betriebsdaten. Die KI berechnet keine verbindlichen Angebotspreise.
- Dateiimport und Analyse von CSV, XLSX, JSON, PDF, TXT, Log/RPT und XML; Bildreferenzen werden gespeichert, nicht durch das Textmodell gesehen.
- Creative Studio für allgemeine Bild-/Videoprompts; im Handwerkspaket über die Administration aktivierbar.
- Rollen admin/staff/reader, Mandantentrennung, serverseitige Modulprüfung und Auditprotokoll.
- Telefonvorführung: Transkript durch die lokale KI strukturieren, Ergebnis prüfen und erst danach als Rückruf speichern.

Lokale Spracherkennung und WAV-Sprachausgabe verwenden den vorhandenen deutschen Windows-Sprachdienst. Mikrofonaufnahmen starten nur nach Klick, dauern höchstens 55 Sekunden und werden lokal transkribiert; erkannte Angaben bleiben vor dem Senden bearbeitbar. Echte Telefonie, Bild-/Videogenerierung und externe Automationsausführung sind nicht angeschlossen. Siehe TODO.md. Kein Live-Deployment dieses Projekts.

Weitere Dokumente: INSTALLATION.md, ARCHITECTURE.md, SECURITY.md, TEST_REPORT.md, PROGRESS.md und TODO.md.


## Drei getrennte lokale Branchendemos

`Start-WERKZ-Demos.cmd` startet Handwerk (8000), Hotel (8001) und Schrotties (8002) mit derselben vorhandenen lokalen Qwen-Engine. Der Desktopordner WERKZ-DEMO-HEUTE enthält den geprüften Einstieg und eine Verknüpfung zum geschützten Betreiber-Zugangsdokument. Auf den Anmeldeseiten kann ein eigener synthetischer Vorführmandant mit fertigen Rollen gestartet werden. Details: HOTEL_DEMO.md, TEST_REPORT.md, FORTSETZUNGSPLAN.md und CUSTOMER_DEPLOYMENT.md.
