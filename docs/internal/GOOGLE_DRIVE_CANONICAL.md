# WerkZ – kanonische interne Ablage

Stand: 2026-10-04

## Regel

Google Drive ist die führende interne Ablage für WerkZ-Wissen, Fehlerhistorie, Selbstreflexion und interne Entwicklungszeit.

- **Google Drive:** kanonische interne Fach-/Wissensdaten und Historie.
- **GitHub:** Quellcode, Tests, technische Dokumentation und dieses Manifest.
- **Website Publisher:** Oberfläche/Admin-Ansicht und Verweise; keine führende interne Wissens-, Fehler-, Reflexions- oder Zeitdatenbank.

## Kanonische Drive-Dokumente

- Wissensregister: https://docs.google.com/document/d/1dgKbYO6t4Wy2gy0Jx7B7FP5rCahM609kNsS4lUS0uSc/edit
- Fehlerdatenbank: https://docs.google.com/document/d/11lbXzcG-MI1RJnO9HOIwd_scspEiaCRO_3VtNPtrPhA/edit
- Selbstreflexion: https://docs.google.com/document/d/1m71cuu1V1q4pHDeZI5SwZqF42dPUbBNLT7FdoHHAlm4/edit
- Interne Entwicklungszeit: https://docs.google.com/document/d/1ybK8NfmwpcbYIM-QI7561SeWXLbxckhoMgraF5TdID0/edit

## Migration 2026-10-04

- 67 bestehende WerkZ-Reflexionen aus Website Publisher nach Drive migriert.
- Fehlerdatenbank aus dem aktuellen Schrotties/WerkZ-Entwicklungsverlauf aufgebaut und um die dokumentierten Fehler/Korrekturen ergänzt.
- 7 bestehende interne Zeiteinträge migriert.
- 36 Stunden intensive Entwicklung für den Zeitraum seit dem letzten dokumentierten Eintrag bis 04.10.2026 ergänzt.
- Website-Publisher-Entities `werkzreflection`, `werkztimeerror` und `werkzworklog` werden nach erfolgreicher Drive-Verifikation entfernt.

## Sync-Regel

Fachliche interne Änderungen zuerst in Drive. GitHub erhält den technischen Verweis/Stand. Website Publisher zeigt nur den Link/Status. Keine neue interne Wissensdatenbank im Publisher.
