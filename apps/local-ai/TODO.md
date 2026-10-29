# Weitere Ausbaustufen

Der lokale MVP läuft; folgende Erweiterungen sind nicht als fertig ausgewiesen:

- SIP-/Telefonanbieter und echte Kundenanrufe bleiben spätere Integrationen. Lokale Mikrofonaufnahme und Windows-STT/TTS sind jetzt implementiert; der physische Mikrofonpfad ist noch mit einer bewussten Aufnahme des Nutzers zu prüfen.
- Bild-/Videogenerierungsanbieter und externe Integrationen erst nach konkreter Konfiguration; momentan Promptstudio und Vorschlags-/Freigabeprotokoll ohne Ausführung.
- Weitere GGUF-Modelle auf dieser Hardware einzeln auf Ladeverhalten, Qualität und Speicherverbrauch prüfen. Erneutes Laden des vorhandenen Qwen ist geprüft.
- Fachliche DeutschZ-XML-/RPT-Regelsätze anhand konkreter Serverversionen erweitern; derzeit strukturelle Analyse und Fehlerfundstellen.
- Erledigt: Angebotsoberfläche unterstützt jetzt bis zu 50 frei editierbare Materialpositionen; mehrere Positionen werden im Browser geprüft.
- Produktivabnahme mit Sicherungs-/Aufbewahrungskonzept, Berechtigungsprüfung, TLS bei Fernzugriff und getrenntem Datenschutzkonzept. Bis dahin synthetische Daten verwenden.
- Installationsarchiv auf einem zweiten sauberen Windows-Rechner prüfen. Es ist kein vollständig autarker Offline-Installer.
- Die TestClient-Abkündigungswarnung bei künftigem Abhängigkeitsupdate bearbeiten.
