# Installation und Betrieb

## Voraussetzungen

Windows, Node.js/npm und Python 3.12, llama-server.exe sowie ein vorhandenes GGUF-Modell. Der Installer kann den vorhandenen gebündelten Codex-Python verwenden; alternativ install.ps1 -PythonPath <Pfad>. Internet wird zur Installation der Abhängigkeiten benötigt. Die lokale Chat-Inferenz benötigt keinen externen KI-Anbieter.

## Befehle

Anmeldestart, Diagnose und kontrollierte Wiederherstellung: [Windows-Start](docs/WINDOWS_STARTUP.md).

- Installation: powershell -ExecutionPolicy Bypass -File install.ps1
- Standardstart: Start-WERKZ-AI.cmd
- Persönliches Paket: powershell -ExecutionPolicy Bypass -File start.ps1 -Package personal -Mode demo
- Getrennter Produktionsdatenraum: start.ps1 -Package handwerk-demo -Mode production
- Vor Wechsel von Paket/Modus: stop.ps1
- Diagnose: health-check.ps1
- Beenden: stop.ps1; optional -KeepModel
- Vollständige Sicherung: backup.ps1
- Wiederherstellung bei gestoppter Anwendung: restore.ps1; Parameter siehe Get-Help restore.ps1
- Abhängigkeiten neu installieren, bauen und Tests ausführen: update.ps1. Dieses Skript lädt keine neue Quellcodeversion herunter.
- Installationsarchiv: package.ps1

Der erste Start eines leeren Datenraums zeigt die Kontoeinrichtung. Bestehende Konten werden nicht überschrieben. Benutzerverwaltung erfolgt im Adminbereich. Zugangsdaten gehören nicht in Git oder ein verteiltes Archiv.

## Daten und Modell

Daten liegen unter data/<Paket>-<Modus>; eigene WERKZ_AI_DATA-Wurzel erhält ebenfalls diesen Unterordner. Demo und Produktion verwenden getrennte Datenbanken und Uploads. Nur der Demomodus legt Beispieldaten an und erlaubt einen auf den eigenen Mandanten begrenzten Reset.

Der Modellserver bindet ausschließlich 127.0.0.1:8080, die Anwendung 127.0.0.1:8000. Standardmodell: vorhandenes Qwen3-4B-Q4_K_M.gguf. CPU: vier Threads, Kontext 4096, eine Generierung gleichzeitig. Andere installierte GGUF-Dateien können über die Administration geladen werden; deren Kompatibilität ist gesondert zu prüfen.

Das ZIP enthält Quellcode, gebaute Oberfläche und Installer. Es enthält weder Python-/Node-Laufzeiten noch Modellgewichte, persönliche Daten oder Zugangsdaten. Ein entpacktes Paket benötigt die Installation der Abhängigkeiten und eine lokal verfügbare llama.cpp-Installation samt Modell.


## Gemeinsamer Demo-Start

`Start-WERKZ-Demos.cmd` oder `scripts/start-demos.ps1`: Handwerk http://127.0.0.1:8000, Hotel http://127.0.0.1:8001, Schrotties http://127.0.0.1:8002. Eine vorhandene passende Instanz wird erkannt. Fremde Ports werden nicht beendet. `stop.ps1 -Port 8001 -KeepModel` beendet nur die zugeordnete Hotelinstanz; analog 8000/8002. Der gemeinsame Modellserver bleibt bestehen.

`scripts/prepare-demo-folder.ps1` prüft die drei Ziele und erzeugt den Desktop-Einstieg. Es kopiert keine Passwörter in den Desktop-/OneDrive-Ordner. Die Zugangsliste bleibt im geschützten lokalen Betreiberordner. Sicherungen über `backup.ps1` sind Windows-DPAPI-geschützte .wzb-Dateien; Grenzen und Restore-Befehl siehe docs/LOCAL_BACKUP_AND_RESTORE.md.
