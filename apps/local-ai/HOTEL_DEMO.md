# WERKZ HOTEL AI – lokale Vorführung

Stand 26.10.2026. Quelle: Hotel-Masterauftrag; Fortschrittsnachweise in TEST_REPORT.md. P0-Gesamtabnahme weiterhin offen.

Start: `Start-WERKZ-Hotel.cmd`, alternativ `start.ps1 -Package hotel-demo -Port 8001`. Einstieg: http://127.0.0.1:8001. „Hoteldemo mit fertigen Profilen starten“ legt einen getrennten synthetischen Vorführmandanten an. Der Rollenwechsel gilt ausschließlich innerhalb dieses Demo-Mandanten. Persönliche Betreiberkonten besitzen diese Umschaltung nicht.

Das fiktive Grand Hotel Bad Pyrmont besitzt 42 Zimmer. Es gibt Profile für Administration, Direktion, Rezeption, Hausdame, Reinigung, Küchenleitung, Küche, Restaurant/Service, Lager, Technik, Personal und Wellness. Keine echten Gäste oder Mitarbeiter eingeben.

Vorführfolge: Rezeption → Abreise eines eingecheckten Gasts → Hausdame weist Reinigungsauftrag zu → Reinigung beginnt, prüft die Checkliste und meldet einen sperrrelevanten Defekt → Technik dokumentiert Reparatur → Reinigung schließt ab → Hausdame kontrolliert und gibt frei → Rezeption sieht den neuen Zimmerstatus. Dieser Ablauf ist gegen die echte temporäre Datenbank und durchgängig im Edge-Browser geprüft, einschließlich aktualisierter Rezeptions-/Managementansicht und anschließender echter Qwen-Statusantwort.

Weitere implementierte Abläufe: Reservierungsanfrage/Bestätigung mit Belegungsprüfung, Frühstücksplanung, Service/Küche, Lagerbewegungen und Einkaufsvorschläge, Dienstplan mit Kollisionen und Abwesenheiten, Spa-Terminprüfung, Gästeportal mit eigener Zugriffssitzung und Sonderwünschen, Zeitbuchungen, geschützte Bilder und QR-Einstiege. Telefonie ist lokale Sprach-/Transkriptdemo; ein externer Telefonanschluss ist nicht eingerichtet.

Die lokale KI liest rollenberechtigte Daten. Geprüft: konkrete Statusfrage zu Zimmer 205 mit tatsächlichem Qwen-Tokenstream. Antworten bleiben prüfpflichtig. Bei zimmerspezifischen Fragen erhält das Modell nur die berechtigten Zimmer und zugehörigen Vorgänge.

Offline: zuvor mit eigener Passphrase vorbereiten. Unterstützte Änderungen werden verschlüsselt lokal vorgemerkt und später mit Versionsprüfung übertragen. Reservierungsbestätigungen und verbindliche Freigaben benötigen den Server. Browserprüfungen bei mobilen Breiten sind bestanden; reale iOS-/Android-Geräte bleiben ungeprüft.

Sicherung und Wiederherstellung: docs/LOCAL_BACKUP_AND_RESTORE.md. Veröffentlichung, TLS, Mehrgerätebetrieb, Aufbewahrung und Wiederherstellung nach Geräteverlust brauchen weitere Betriebsprüfung. Die lokale Demo ist noch kein freigegebener Hotel-Produktivbetrieb.
