# Lokale Programm- und Demo-Sicherungen

## Hotelprogramm – geprüfte Korrektur vom 29.10.2026

Der Entwicklungsstand unterstützt jetzt auch `-Package hotel -Mode production`
in `backup.ps1`, `restore.ps1` und der Python-CLI. Zuvor fehlte `hotel` in den
Parameterlisten. Der Wiederherstellungs-Portschutz ordnet Hotel korrekt8001 zu
(nicht dem bisherigen Standard8000). Das Archivformat und die bestehenden
Paket-/Modusgrenzen bleiben unverändert.

Mit einer temporären synthetischen Hotel-Programmdatenbank wurden Windows-DPAPI,
verschlüsselter CLI-Export, Byte-Lesekontrolle, tatsächlicher Restore samt
SQLite-Integrität und Zimmererhalt, Sitzungswiderruf, falsches Paket und
Archivbeschädigung geprüft. Der tatsächliche CLI-Restorepfad wurde mit einem
simuliert belegten8001 geprüft und bricht vor Datenänderungen ab. Es wurde kein
neuer Listener gestartet. Vier Paket-Sicherungsfälle bestanden (26,72s), beide
PowerShell-Dateien bestanden die Syntaxprüfung. Nur synthetische temporäre Daten.

Die installierte Hotel-Anwendung und ihre Sicherungsskripte wurden hier NICHT
aktualisiert. Damit ist die fehlende Paketunterstützung dort weiterhin ein
Übernahme-Gate. Kein aktuelles Backup persönlicher Daten, kein externes Backup
und kein geräteübergreifender Restore werden aus diesen Tests abgeleitet.

## Bestehende kompatible Demo-Sicherungen

Stand: 26.10.2026. `backup.ps1 -Package hotel-demo` sichert analog auch `handwerk-demo` und `schrotties-demo`. Standardziel: `data/backups/*.wzb`.

Die Betreiberbefehle schützen das gesamte Archiv mit Windows-DPAPI und prüfen es anschließend durch Entschlüsseln und Bytevergleich. Die Sicherung ist an denselben Windows-Benutzer auf dessen Installation gebunden. Sie ist kein portabler Wiederherstellungsweg bei Verlust des Windows-Profils. Ein unabhängiger verschlüsselter Export mit separat verwahrtem Wiederherstellungsschlüssel bleibt ein offenes Betriebsgate.

Eine Sicherung enthält einen konsistenten SQLite-Snapshot und hochgeladene Dateien. Anmeldesitzungen, Gästeportal-Sitzungen und Demo-Wechselberechtigungen werden entfernt. Konten und deren Passwort-Hashes bleiben erhalten; nach Restore erneut anmelden. Ein Wiederherstellungsversuch in ein anderes Paket oder einen anderen Betriebsmodus wird vor Änderungen abgewiesen.

Vor Restore die betroffene Instanz stoppen, z. B. `stop.ps1 -Port 8001 -KeepModel`. Danach `restore.ps1 -Package hotel-demo -Archive <vollständiger Pfad zur wzb-Datei>` und `start.ps1 -Package hotel-demo -Port 8001`. Bestehende Daten werden zusätzlich gesichert und als `*.before-restore-*` aufbewahrt. Diese zusätzlichen lokalen Kopien liegen im ursprünglichen Datenordner; dessen Zugriffsschutz und Laufwerksverschlüsselung bleiben erforderlich.

Die internen Funktionen `create` und `restore` arbeiten für Archivprüfungen mit temporären ZIP-Dateien. Betreiber verwenden die geschützten Befehle. Unverschlüsselte Altarchive werden von `restore.ps1` abgewiesen und müssen gesondert geprüft werden.

Nachweis: `tests/backup_scenarios.py` prüft für jedes der drei echten Demo-Datenbankschemata Verschlüsselung, Lesekontrolle, Wiederherstellung, Paketgrenze, Sitzungswiderruf und Ablehnung beschädigter Archive. Tests laufen mit temporären synthetischen Daten. Physischer Geräteverlust oder Wiederherstellung auf einem anderen Rechner sind damit nicht abgenommen.
