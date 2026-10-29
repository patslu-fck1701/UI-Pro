# Hotel zuerst: persistente Modulfreigaben

Status: lokal getestet, Produktionsfreigabe ausstehend. Priorität: Hotel samt KI,
danach Handwerk; Schrotties vorerst zurückgestellt.

## Implementierung

Bestehende Anmeldung, tenantgebundene ModuleConfig und Router-Guards wiederverwendet.
Keine zweite Identitätsdatenbank, kein zweiter Modellserver und keine separate App.
Die Python-Runtime interpretiert gespeicherte Freigaben nach dem vorhandenen
Core-Entitlement-Vertrag active/trial/suspended/expired und expiresAt. Ein Paritätstest
führt die echte Node-EntitlementService-Implementierung aus und vergleicht zwölf
Zustands-/Ablauffälle. Dies ist ein kompatibler Runtimeadapter, keine direkte Verbindung
zum Node-In-Memory-Store und kein produktives KundenZ-Policy-Backend.

PUT /api/admin/entitlements/{module} speichert ausschließlich im authentifizierten
Demo-Mandanten. Adminrolle, verfügbares Modul, vollständige erwartete Revision und
Zeitzone sind Pflicht. BEGIN IMMEDIATE serialisiert Prüfung, Änderung und Audit.
Konkurrierende Änderungen derselben Revision: genau eine erfolgreich, andere409.
Prod-Modus verweigert diese lokale Demo-Konfiguration. Fachrollen und Objekt-/Feldrechte
bleiben zusätzlich bestehen; ein aktiviertes Modul gibt keine höhere Rolle.

GET /api/modules zeigt die aktuell wirksamen Freigaben nach derselben Berechnung.
Hotel-Daten- und KI-Workspace-Guards lesen bei jedem neuen Zugriff die Persistenz neu.
Ungültige gespeicherte Werte, Ablauf und Sperre gewähren keinen Hotelzugriff.
Legacy-Bools bleiben kompatibel. Simulation/Preview sind ausdrücklich keine aktiven
Fachmodulrechte; alte Checkbox-Schreibvorgänge dürfen versionierte Freigaben nicht
überschreiben. Die Oberfläche bietet Hotel zuerst, Testfreigabe/Sperre und optionales
Ablaufdatum. Admin-Anfragen sind zusätzlich an Actor und Tenant gebunden.

## Tatsächlich geprüft

- Gesamte Python-Suite nach Backendänderung:54bestanden/1Skip/0Fehler.
- Danach zusätzlicher echter konkurrierender SQLite-Schreibtest: drei gezielte
  pytest-Testfunktionen bestanden (Core-Parität, ungültige Grants, HTTP-Szenario).
- HTTP mit synthetischem Admin, Leser und zweitem Mandanten: Anmeldungspflicht,
  persistierte Freigabe in neuer Session, Ablauf, Widerruf vor Hotel-Kontext und
  KI-Chat-Erstellung, stale Revision, Rollen-/Tenant-Spoof-Abwehr, unbekannte Felder,
  naive Zeitzone und Legacy-Überschreibschutz bestanden.
- TypeScript/Vite-Build bestanden. Bestehende Bundle-Größenwarnung bleibt.
- Headless Edge: Speichern/Sperren/Testfreigabe/Neuladen und390/768/1440Breiten
  ohne horizontalen Überlauf bestanden. Keine physischen Mobilgeräte geprüft.
- Browserprüfung führte zu expliziten Label-IDs sowie Erhalt der Adminansicht beim
  Sperren des aktuellen Fachmoduls; keine Schutzprüfung dafür entfernt.

## Bewusste Grenzen / Fortsetzung

Noch kein gemeinsamer produktiver Mehrbetriebs-Login oder KundenZ-Dienst. Bestehende
Paket-Datenbanken wurden nicht zusammengeführt. Kein Provider-/Cloud-/DeutschZ-Zugriff.
Widerruf während bereits laufender Modellantworten sowie Offline-Cache-Invalidierung
benötigen zusätzliche Abnahme; der Nachweis gilt für neu begonnene Requests.
Kein vollständiger Core-Produktions-, Mandanten-/Feldrechte- oder Geräte-Abnahmenachweis.
Nächster Hotel-Schritt: diese Freigabe in den gemeinsamen Modulwechsel einbinden und
laufende KI-Kontexte bei Widerruf abbrechen; danach Betreiber-Kundenberater/AiZ.
