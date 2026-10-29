# Hotel: Reservierungen bearbeiten und stornieren

Lokaler Funktionsstand vom 28.10.2026: Commit `30c4492` plus Browserprüfung auf dem mit Remote-Streaming-Korrekturen abgeglichenen Arbeitsstand.

Implementiert: PATCH für offene/ bestätigte Reservierungen; POST für ausdrücklich bestätigte Stornierung. Beide verlangen Rezeption-Rechte, mandantengebundenen Datensatz und aktuelle Revision. Änderungen prüfen Zeitraum, Kapazität, Sperren und bei bestätigter Reservierung Doppelbuchung in derselben Schreibtransaktion. Eingecheckte, ausgecheckte und stornierte Buchungen sind davon ausgeschlossen. Das bestehende Audit verzeichnet Ereignis und Datensatz-ID; eine vollständige fachliche Vorher/Nachher-Historie ist noch offen.

Prüfungen: synthetisches Backend-Szenario bestanden (Konflikt, veraltete Revision, Bestätigung, Stornierung, erneute Verfügbarkeit). Installierter Frontend-Build/Typecheck bestanden; Bundlegrößenwarnung bleibt. Erweiterter echter Edge-Browserablauf mit temporärer synthetischer Datenbank und tatsächlichem lokalem Qwen bestanden: Gastanlage, Buchung, Reload, Datenbankkennzahlen, 390/768/1440, Qwen-Gastname aus Datenbank, Bearbeiten, Stornieren und Reload/DB-Readback. Ein erster Browserdurchlauf wartete nach dem Speichern nicht auf den Formularwechsel; die Prüfung wurde an den tatsächlichen Reloadzustand gebunden und erneut bestanden.

Installation: verschlüsselte Hotel-Datenbanksicherung `.runtime/hotel-before-reservation-edit-20261028.wzb`; vorhandene Quelldateien unter `.runtime/reservation-edit-source-20261028/` erhalten. Installiertes Frontend neu gebaut und nur Hotel-Port 8001 mit `-KeepModel` neu gestartet. Keine öffentliche Bereitstellung. Browserprüfung verwendet ausschließlich temporäre synthetische Daten.

Desktop: Im bestehenden `WERKZ-DEMO-HEUTE` eindeutige Starter für Hotel (8001), Handwerk (8000), Schrotties (8002), vorhandenes privates Control Center und gespeicherte lokale Startprüfung angelegt und Ziele zurückgelesen. Eine gemeinsame Qwen-Engine auf Loopback 8080; drei getrennte lokale App-Dienste. Die ältere Verknüpfung `WERKZ AI` startet standardmäßig Handwerk. Kein zweites Control Center erstellt.

Offen: vollständige Reservierungshistorie, weitere P0-Hotelanforderungen einschließlich Dokumentfunktionen und umfassender Rollen-/Geräteabnahme. GitHub-CI, Drive-Abgleich und öffentliche Bereitschaft werden durch diesen lokalen Test nicht bestätigt.
