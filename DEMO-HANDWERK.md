# WerkZ Handwerk – geschützte Demo

Dieser Zweig enthält eine Demo auf Basis der bereits vorhandenen UI-Pro-Runtime. Das vollständige WerkZ-Paket bleibt im privaten Repository patslu-fck1701/WerkZ. Es werden keine Betriebsdaten oder Zugangsdaten mitgeliefert.

Einstieg: /pilot/handwerk/. Nur synthetische Daten verwenden. Kunden, Rückrufe, Belegablage, Monatsvorbereitung und Arbeitszeiten sind demonstrierbar. Belegauswertung ist simuliert; kein automatischer Mailversand. Keine automatischen Marktpreisabrufe. Ohne persistenten Datenträger gehen Demo-Eingaben bei Austausch der Instanz verloren. Keine Produktionsfreigabe und kein Nachweis vollständiger PostgreSQL-Persistenz.

Render: Node, Frankfurt, Starter, Build npm ci --omit=dev --ignore-scripts, Start node tools/time-test-server.js, AutoDeploy aus, Healthcheck /healthz. Zugang und Sitzungsschlüssel ausschließlich über private Umgebungsvariablen setzen; Testprofile und automatische Testzugänge deaktiviert lassen. WERKZ_ENABLE_TIME_WORKSPACE=1.
