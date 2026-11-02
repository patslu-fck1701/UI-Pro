# HOTEL P0 – Praxistest und Abnahmeprotokoll

Stand: 02.11.2026. Dieses Dokument bereitet den Test vor. Es ist keine
Einladung, keine Produktivfreigabe und keine Freigabe für Render-, Datenbank-
oder Secret-Änderungen.

## Freigabegate vor der Einladung

Der Owner trägt vor der Einladung alle Werte ein und bestätigt sie einzeln:

- Release-Commit: `OFFEN`
- Test-URL: `OFFEN`
- isolierter synthetischer Mandant: `NICHT NACHGEWIESEN`
- befristete Testrolle ohne Betreiberrechte: `NICHT NACHGEWIESEN`
- PostgreSQL-Ziel und Schema: `NICHT FREIGEGEBEN`
- Backup-ID, Erstellzeit und verschlüsselter Aufbewahrungsort: `OFFEN`
- erfolgreicher Restore in ein getrenntes Testziel: `NICHT NACHGEWIESEN`
- Rollback-Commit und vorherige Render-Deploy-ID: `OFFEN`
- Desktop-, Tablet- und Smartphone-Browser: `OFFEN`
- Owner-Freigabe zur Einladung: `NEIN`

Echte Gäste-, Mitarbeiter-, Kontakt-, Zahlungs- oder Zugangsdaten sind im
Testmandanten verboten. Die Testerin erhält weder Render-, Lovable-,
Supabase-, GitHub- noch Betreiberzugriff.

## Testdaten

Nur klar als synthetisch markierte Datensätze verwenden, zum Beispiel:

- Hotel: `WerkZ Testhotel Goethe`
- Gäste: `Testgast Ada`, `Testgast Bruno`, `Testgast Carla`
- Zimmer: `T-101`, `T-102`, `T-201`
- Mitarbeiterkonten: `test-rezeption`, `test-housekeeping`, `test-hausdame`

Passwörter und Einladungslinks werden außerhalb von Git und diesem Protokoll
übergeben. Nach dem Test werden Rolle und aktive Sitzungen widerrufen.

## Testablauf

Jeder Schritt erhält `BESTANDEN`, `FEHLER` oder `BLOCKIERT`, Zeit, Browser,
Testerrolle und eine datensparsame Belegreferenz. Screenshots dürfen keine
Secrets oder personenbezogenen Daten enthalten.

| ID | Arbeitsablauf | Erwartung | Status | Beleg |
| --- | --- | --- | --- | --- |
| H-01 | Anmeldung und Logout | Testrolle sieht ausschließlich den Hotel-Arbeitsplatz; Logout beendet die Sitzung | OFFEN | |
| H-02 | Tagesübersicht | Anreisen, Abreisen, Reinigung und Sperrungen sind fachlich verständlich | OFFEN | |
| H-03 | Reservierung anlegen | Synthetischer Gast und freies Zimmer werden dauerhaft gespeichert | OFFEN | |
| H-04 | Reload und neuer Browser | H-03 bleibt nach Reload und erneuter Anmeldung erhalten | OFFEN | |
| H-05 | Doppelbuchung | Überschneidende Buchung wird atomar abgewiesen | OFFEN | |
| H-06 | Umbuchung | Zimmerwechsel aktualisiert Belegung ohne verlorene oder doppelte Buchung | OFFEN | |
| H-07 | Stornierung | Status und Zimmerverfügbarkeit werden nachvollziehbar aktualisiert | OFFEN | |
| H-08 | Check-in | Reservierung wechselt kontrolliert zu eingecheckt | OFFEN | |
| H-09 | Check-out | Aufenthalt wird beendet und Folgestatus des Zimmers ist korrekt | OFFEN | |
| H-10 | Housekeeping | Reinigung kann aktualisiert werden; Gast-/Rechnungsdaten bleiben verborgen | OFFEN | |
| H-11 | Hausdame/Technik | Zuweisung, Prüfung, Sperrung und Freigabe funktionieren rollenabhängig | OFFEN | |
| H-12 | Gastanfrage | Anfrage wird gespeichert, zugewiesen und abgeschlossen | OFFEN | |
| H-13 | Fremdmandant | Direkter API-/URL-Zugriff liefert keine geschützten Daten | OFFEN | |
| H-14 | Rollenentzug | Entzug beendet weitere geschützte Zugriffe, auch in einer laufenden Sitzung | OFFEN | |
| H-15 | Mehrbenutzerkonflikt | Gleichzeitige widersprüchliche Änderung erzeugt keinen stillen Datenverlust | OFFEN | |
| H-16 | Session-Ablauf | Abgelaufene Sitzung verlangt neue Anmeldung und verwirft keine bestätigten Daten | OFFEN | |
| H-17 | KI-Ausfall | Hotel-Kernarbeit bleibt ohne GINI/Provider nutzbar | OFFEN | |
| H-18 | Desktop 1440 px | Kernabläufe ohne horizontalen Überlauf | OFFEN | |
| H-19 | Tablet 768 px | Kernabläufe bedienbar, Fokus und Dialoge sichtbar | OFFEN | |
| H-20 | Smartphone 390 px | Kernabläufe bedienbar, keine verdeckten Primäraktionen | OFFEN | |
| H-21 | Prozessneustart | H-03 bleibt nach nachgewiesenem Backend-Neustart erhalten | OFFEN | |
| H-22 | Restore-Probe | Freigegebenes Backup wird in getrenntem Ziel wiederhergestellt und geprüft | OFFEN | |

## Abschluss

HOTEL P0 darf nur als freigegeben markiert werden, wenn alle kritischen Fälle
bestanden sind, kein P0/P1-Fehler offen ist, Commit und Deploy eindeutig sind,
Persistenz nach Neustart sowie Restore nachgewiesen wurden und der Owner die
Abnahme ausdrücklich erteilt hat.

