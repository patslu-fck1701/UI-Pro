# AI Core – Stufenstatus zu Issue #72

Stand: 26.10.2026. Quelle: https://github.com/patslu-fck1701/WerkZ/issues/72, direkt gelesen; Priorität nach P0-Demos. Nachpflege: https://github.com/patslu-fck1701/WerkZ/issues/71.

**Stufe0 VERIFIED (Inventur), Stufe1 PLANNED:** Noch kein implementierter oder abgenommener RAG-Pfad.

Am26.10. erneut gelesen: llama.cpp0.7.0-dev, build11870, Commit74bca3950,
Qwen3-4B-Q4_K_M, Loopback8080, Kontext4096. Echte Betriebsfragen und Überlänge/Folgefrage
in drei Branchen bestanden (#75); Modell nach kontrolliertem Neustart bereit.
Minimalfrage/Antwort und Latenzen stehen in TEST_REPORT.md und den Regressionen.
SQLite3.53.1/FTS5 in einem flüchtigen In-Memory-Test bestätigt; kein persistenter Index angelegt.
Keine Embeddings, kein Training, keine Cloudanbindung.

Wiederverwendung: `backend/engine.py` ist der vorhandene lokale Providerpfad,
`backend/core.py` liefert autorisierte Branchenfakten; Dokumentenverarbeitung und
getrennte SQLite-Geschäftsdatenbanken bestehen. Im untersuchten Branch kein bestehender
FTS-/Vektorindex gefunden. Der Node-Core enthält bereits ConnectorPort, SecretStorePort,
IntegrationControlStore, Provider-/Webhook-/Queue-/Approval-Komponenten. Kein zweiter Stack.

Lovable Control Center am de3ecfac-Quellstand erneut geprüft: vorhandene private
Operatoroberfläche, kein Modellaufruf, AI_GATEWAY_URL weiterhin deaktiviert. Alle16
untersuchten Tabellen mit RLS/Operatorpolicy und0 anonyme Tabellengrants; im Sicherheitsabgleich nur Metadaten gelesen. Separate synthetische site_checks wurden für PR86 gespeichert; keine Geschäftsdatensätze gelesen.
Ein lokal laufender Qwen wird dadurch nicht von der Cloud aus erreichbar. Nächster
Verbindungsweg muss ohne öffentlichen Modellport, Rohdatenkopie oder neue Parallelplattform
auskommen. Die bestehende WerkZ Control Bridge0.1.0 ist ein Skills-/Koordinationsplugin.

Nächster Schritt nach P0-Checkpoint: Inventur vorhandener Provider-/Suchschnittstellen, dann minimaler FTS5-Pilot mit einem freigegebenen nicht sensitiven Dokument. Kein zweiter Modellserver und kein Training. Keine Cloud-Verbindung angelegt. Betriebsdaten bleiben in ihren führenden Datenbanken und werden rollen-/tenantgebunden gelesen.

Abnahme: Quellen-/Versionszitate, fehlende Quelle, fremder Tenant, gesperrte Rolle, Löschung, veraltete Version, Prompt-Injection, Tool-Allowlist, JSON-Validierung, Serverausfall, Wiederherstellung und gemessene Latenz. Mindestens 20 feste Fälle gemäß Issue vor einer vollständigen Stufenfreigabe.

Synchronisierung: lokaler Plan UPDATED; GitHub-Issue gelesen UNCHANGED; Drive/Mission Control NOT_SYNCHRONIZED; DB-Schema/Index UNCHANGED. Keine Eigenarbeitsstunden aus Agentenlaufzeit abgeleitet.
