# WerkZ Digital – Zielarchitektur und aktueller Nachweisstand

Stand: 02.11.2026. Diese Übersicht trennt Zielbild, vorhandenen Quellstand und
noch nicht nachgewiesene Online-Infrastruktur. Sie autorisiert keinen Deploy,
keine Migration, keine Datenbanköffnung und keine Provideranfrage.

## Zielbild

Eine gemeinsame responsive WerkZ-Anwendung stellt nach zentraler Anmeldung
rollen- und mandantenabhängige Arbeitsplätze bereit. Browser und UI sind keine
Sicherheitsgrenze. Jede geschützte Operation wird serverseitig gegen aktuelle
Sitzung, Mandant, Rolle und Modulberechtigung geprüft; Datenbankzugriffe müssen
dieselben Grenzen erzwingen.

```text
Browser / WerkZ Designsystem
  -> WerkZ API und KundenZ-Vertrag
       -> Hotel-Fachdienst -> eigenes freigegebenes Hotel-Schema
       -> Handwerk-Fachdienst -> fachlich getrennte Daten
       -> Schrotties-Fachdienst -> gesicherter Pilot/Migrationspfad
       -> GINI-Adapter -> ausschließlich Claudes dokumentierter Vertrag
```

GINI ist optional für die Facharbeit. Das Frontend spricht keinen fest
eingebauten Modellanbieter direkt an. Ein Ausfall der KI darf Reservierung,
Check-in, Check-out, Housekeeping und Technik nicht blockieren. Feedback ist
ein prüfbarer Hinweis und niemals automatisch Trainingsmaterial.

## Aktueller Quellstand

- Ausgangsrepository: `patslu-fck1701/UI-Pro`
- Ausgangsbranch: `codex/hotel-ai-providers-persistence-gates-20261031`
- geprüfter Ausgangscommit: `6ac95bef945cc385d5de560c34ea4ef84541e116`
- Arbeitsbranch: `codex/werkz-digital-hotel-p0-20261102`
- Hotel enthält vorhandene FastAPI-/SQLAlchemy-Fachlogik, React-Oberfläche,
  Rollen-/Tenant-Tests, explizite PostgreSQL-Migration und Readiness-Gate.
- Das vorhandene Lovable-Projekt ist ein separates Control Center. Seine
  Veröffentlichung oder Sichtbarkeit ist kein Nachweis einer Hotel-Abnahme.

## Hosting- und Datenbankzuordnung

| Ressource | Beabsichtigte Rolle | Aktuell live nachgewiesen | Änderung freigegeben |
| --- | --- | --- | --- |
| `werkz-hotel-test` | isolierter HOTEL-P0-Testdienst | NEIN | NEIN |
| `werkz-handwerk-demo` | bestehender Handwerk-Dienst | NEIN | NEIN |
| `werkz-pilot-db` | historische Pilotdaten; Nutzer und Inhalt dringend prüfen | NEIN | NEIN |
| Hotel-PostgreSQL-Schema | dauerhafte synthetische Testdaten | nur CI-Schema, nicht Render | NEIN |
| Lovable `9081192e-...` | möglicher gemeinsamer UI-Ausgangspunkt | Projektmetadaten gelesen | NEIN |

Für `werkz-pilot-db` gilt bis zur autorisierten Prüfung: nicht öffentlich
erreichbar machen, nicht verlängern, nicht löschen, keine Zuordnung raten. Vor
einer Sicherung müssen tatsächliche Dienstbindung, Datenrelevanz, internes
Backupziel, Prüfsumme und getrennte Restore-Probe dokumentiert werden.

## Release- und Rollbackvertrag

1. Exakten Commit, Quellbranch, Image/Build und vorherige Deploy-ID festhalten.
2. Backup und Restore-Probe in getrenntem Ziel nachweisen.
3. Migration nur über den expliziten Operator-Befehl ausführen.
4. `/api/ready` muss Datenbank und Revision prüfen; HTTP-Erreichbarkeit allein
   ist kein Persistenz- oder Funktionsnachweis.
5. Nach Deploy Anmeldung, Mandantengrenzen, Kernworkflow, Reload und echten
   Prozessneustart prüfen.
6. Bei Abbruch vorheriges Deployment wiederherstellen; Datenänderungen nur über
   den zuvor geprüften Wiederherstellungspfad zurückführen.

## Offene Freigabegates

- Render-Workspace und Ressourcen müssen vom Owner ausdrücklich ausgewählt
  werden.
- Datenbankdienstbindung, Ablaufdatum, Dateninhalt, Backup und Restore sind
  noch nicht live geprüft.
- Externe Hotel-Testrolle und Einladung sind nicht angelegt.
- Kein produktiver Deploy, Merge, neuer Dienst, Secret oder kostenpflichtiger
  Provider ist freigegeben.
- GINI bleibt bis zu Claudes dokumentiertem API-/Capabilities-Vertrag als
  Integration blockiert; es wird kein Ersatzbackend gebaut.

