# Lokales Qwen und privates Control Center: ausgehende Bridge

Stand 27.10.2026. Vorhandene Anwendungen wiederverwendet. Keine Veröffentlichung.

## Tatsächlich funktionierender Pfad

Bestehende private Lovable-Vorschau → kurzlebiger Betreiberauftrag in ihrer bestehenden
Datenbank → ausgehender Windows-Worker → vorhandenes llama.cpp/Qwen → signierte
Ergebnisübermittlung → Antwort auf der bestehenden Seite `/assistant`.

Der Besitzer hat den konkreten Laptop nach Anzeige des öffentlichen Fingerabdrucks
ausdrücklich freigegeben. Freigabe erfolgte über die tatsächlich angemeldete
Operator-Oberfläche, nicht durch eine fingierte SQL-Identität oder Selbstgenehmigung.
Gerätefingerabdruck: `189986443fe9d14bb7eb7a0873138a107c56af1f925fa1f41bbfa08fd0712884`.
Das ist ein öffentlicher Schlüsselbezeichner, kein Zugangstoken.

Belegjob `dfdff215-bece-486b-8cce-a3c93ec480dc`: erstellt 16:08:40.783304 UTC,
abgeholt 16:09:14.030994 UTC, abgeschlossen 16:09:23.799748 UTC.
Persistierter Status succeeded, Antwort `WERKZ Verbindung bereit.`, Modell
`Qwen3-4B-Q4_K_M.gguf`, Fehler null. Antwort in der Operator-UI gesehen und
aus genau diesem Datensatz zurückgelesen. Dies belegt eine tatsächliche Modellantwort,
keinen RAG- oder Hotel-Datenzugriff. Separater lokaler Minimaltest: 2,47 Sekunden.

## Protokoll und Schutz

Ein Protokoll WERKZ-BRIDGE-1, Ed25519-Signaturen über Methode/Pfad/Zeit/Nonce/Bodyhash.
Nur der feste geprüfte HTTPS-Vorschauhost
`https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app`
und `/api/public/local-ai/{pair,claim,complete}`. Die zuerst vorgesehenen
id-preview-/api/local-ai-Adressen werden von der Plattform vorgeschaltet gesperrt;
deshalb ein abgeglichener finaler Contract, kein unsicherer Fallback.

Privater Geräteschlüssel ausschließlich Windows-DPAPI unter `.runtime/outbound-ai/`.
Keine eingehenden Modellports, kein neuer Modellserver, keine Schlüssel in Git/Drive.
Gerätefreigabe und Widerruf operatorgebunden; Jobs nur eigene reine Eingaben.
90s Jobdauer, 35s Lease, 20s lokales Inferenzlimit; abgelaufene Ergebnisse werden
nicht nachträglich angenommen. Keine Modelltools, Shellbefehle, SQL oder Dateipfade
aus Remotejobs. Ausgaben enthalten nur Modellbasename, keine lokalen Benutzerpfade.

Neue Tabellen local_ai_devices/jobs/nonces in der bestehenden Operator-DB, RLS aktiv.
Nachprüfung fand geerbte Default-Grants, die ursprüngliche Aussage »keine anon grants«
war nicht erfüllt. Korrigiert: ALL für anon/authenticated auf genau diesen Tabellen
entzogen, authenticated SELECT nur für devices/jobs. Readback: alle3 RLS aktiv,
anon SELECT/INSERT false; authenticated INSERT false; keine Nonce-Leserechte.
Alle Bridge-RPCs für anon gesperrt; authenticated darf nur approve/revoke/submit.
Keine Änderung bestehender Branchen-/Kunden-/Auth-Tabellen.

## Installation / Betrieb

Skripte: `scripts/outbound-ai.js`, `scripts/bridge-analyze.py`, vorhandene
`backend/engine.py`, `backend/context_budget.py`, `backend/windows_protection.py`.
`node scripts/outbound-ai.js status|pair|once|run`.
Kein Remotejob kann einen anderen Befehl oder eine andere URL auswählen.

Nach bestätigtem Pairing lokales `.runtime/outbound-ai/enabled.json` mit enabled=true
und geprüftem absolutem Node-Pfad gesetzt. Vorhandene Startorchestrierung startet
den Worker versteckt; pro Installation Lock, ohne fremde Prozesse zu beenden.
Bei Netzfehlern Backoff 15–60s, keine erneute Ausführung bereits verarbeiteter Jobs;
pending/revoked beendet den Worker. Status enthält nur Zustand/Zeit/Auftrags-ID.
Frischer Windows-Login mit diesem Zusatz weiterhin nicht beobachtet.

## Tests / Grenzen

- 6 Node-Vertragstests: Signaturbindung, Pfad-/Origin-Allowlist, Ablauf, Pending/Revoke,
  Deduplizierung, Fehlerredaktion, Redirect-/HTML-/Größenabwehr. Testmodelle dort
  ausdrücklich Doubles; echter Modellnachweis ist der getrennte Job oben.
- 8 Python-Vertragstests zu Eingabe, Zeitgrenze, Modellpfadredaktion, Fehlermodell.
- Windows-Startup-Tests 2 bestanden/1 Lifecycle-Skip im Quellworktree.
- Gesamtverify nach Workeränderungen bestanden (271 pass/1skip/0fail).
- Lovable f38da606 Bridge; f42fce19 konsistente Status-UI, gemeldete121Tests/5optionale
  Cloud-Skips, Typecheck/Build und Browser390/768/1440 ohne Überlauf.
- ACL-Korrektur in Preview separat versionieren und nochmal lesen (in Arbeit).

Nur private Entwicklungs-Vorschau. Kein öffentlicher Rollout, keine pauschale
Produktions-/Geräte-/RAG-/Geschäftsdatenfreigabe; keine automatischen Nachrichten.
Nächste P0-Arbeit: Hotel-Dashboard und direkte Gästeingabe aus dem Auftrag 27.10.,
danach rollenbezogene Hotel-KI-Werkzeuge und bestätigte versionierte Dateiarbeiten.
