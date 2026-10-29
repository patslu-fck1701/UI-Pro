# Schrotties-Original: isolierter HTTP-Abnahmepfad

Stand27.10.2026. **Original-Service und HTTP-Handler geprüft; Original-UI noch nicht
wieder in Betrieb, keine öffentliche Bereitstellung oder Datenmigration.**

## Exakte Quellstände statt Versionsmischung

Der früher dokumentierte UI-Pro-Commit `50d914513ef075050dc4746fda7a9a40c728257d`
wurde gezielt über den bestehenden UI-Pro-Clone gelesen, ohne dessen Arbeitsbranch
zu verändern. Alle benötigten Git-Objekte sind nun lokal verfügbar. Für den getesteten
Pilot-Service besteht die vollständige Modulabhängigkeit aus Node-Builtins und:

| Datei | Git-Blob im tatsächlich gelesenen50d9145 |
| --- | --- |
| src/pilot/index.js | e6a3efadb3d414fa610b5d4e9177fda9260374bd |
| src/pilot/outbound-mail.js | 2993fb8d14d90605b16bd69fcb130a2a1e97fb30 |

Beide unveränderten Dateien liegen lokal unter
`C:/Users/patsl/Projects/WERKZ-AI/.runtime/schrotties-source-50d9145/`.
Es wurden keine Providerpakete installiert und kein Outbound-Provider instanziiert.
Dies ist die minimale Service-Modulclosure, keine vollständige Serverinstallation.
Die vorher vermissten Dateien `src/index.js`, `src/pilot/twilio-voice.js`,
`src/pilot/storage-readiness.js` und package-lock.json existieren ebenfalls im
festgelegten Git-Tree; sie wurden nicht aus einem anderen Branch ergänzt.

**Neuer Abgleichbefund:** Das17-Dateien-Archiv ist weiterhin unverändert. Sein
`src/pilot/index.js` hat aber Blob`3802f3ff11bd0dd804a6cbfb408c098fe8aa8d42` und ist
damit nicht identisch mit dem Modul am dokumentierten UI-Pro-Commit. UI-Datei,
ServiceWorker und time-test-server.js sind bytegleich. Die Modulunterschiede betreffen
unter anderem Outbound-Mail-Import/Idempotenz und Preisparser. Keine Variante ersetzt
die andere stillschweigend. Historische LIVE-/Äquivalenzaussagen wurden ausdrücklich
als historisch beziehungsweise für dieses Modul widerlegt annotiert.

## Tatsächlicher HTTP-Test

`test/schrotties-original-http.test.js` verwendet die **unveränderten** Originalexports
WerkZSimplePilotService und createPilotHttpHandler. Es startet nur für den Test einen
Server auf127.0.0.1 mit dynamischem Port und beendet ihn danach. Neue synthetische
Dateispeicher, zwei Mandanten und ein eingeschränkter Reader werden pro Lauf erstellt.
Zufällige Sitzungscookies werden nur im Prozess erzeugt, nicht ausgegeben oder gespeichert.

Alle Adapter sind statisch/Fake/Draft; LiveScrapPriceProvider und createPilotRuntime
werden nicht verwendet. Die Fetch-Grenze erlaubt nur den exakten lokalen Testorigin.
Externe Fetches werden vor dem Netzwerk abgewiesen; der öffentliche Intake ist in der
Testhülle gesperrt. Diese Testhülle ist **keine** neue Produktions-Auth-/SSRF-Grenze.

Sechs fachliche Subtests plus übergeordneter Node-Test je Quellversion:

1. Anonyme Sitzung401 und Reader-Schreibaktion403.
2. Original-Abholkalkulation mit synthetischem260€/t,1000kg,10km:260€Erlös,
   10€Fahrtkosten,90€erwartetes Ergebnis bei150€geplanter Kundenzahlung.
3. Rechner→Auftrag über HTTP dedupliziert; fremder Mandant sieht den Auftrag nicht
   und kann ihn nicht abschließen; geplante Auszahlung erzeugt keine Bargeldbuchung.
4. Dateirepository neu geladen: ein Auftrag erhalten. Fremde optionale Schätzreferenz
   wird entfernt; ein ausdrücklich neu angelegter Auftrag bleibt beim eigenen Mandanten.
   Das ist der vorhandene Originalvertrag, keine Behauptung einer POST-Verweigerung.
5. Originale Tourreihenfolge und Auftragsabschluss, fremde Tour-ID400,
   erledigter Auftrag verschwindet aus offener Tour, weiterhin keine Bargeldbuchung.
6. Kein externer Provideraufruf; expliziter negativer Fetch-Test vor Netzverkehr gesperrt.

**Ergebnis:** Archivmodul7/7 und echtes50d9145-Modul7/7bestanden. Beide Tests zählen
jeweils dieselben sechs Subfälle plus Parent; nicht als14unterschiedliche Fachfälle
oder als manuelle Rollen-/Geräte-End-to-End-Abnahme darstellen.

Die neue Testdatei ist in der regulären Node-Suite enthalten. Vollständiges
`npm run verify`: **260bestanden,1bestehender Skip,0Fehler**; Syntax/Lint/Typen,
OSS/SBOM, Provenienz und Secret-Audit bestanden. Der genaue Folge-CI-Head ist nach
Push separat zu lesen. Keine Veränderung von Originaldateien, Laufzeitdaten oder Modell.

Reproduktion gegen den eingefrorenen Mirror:

```powershell
node --test test/schrotties-original-http.test.js
```

Gegen die exakt exportierte50d9145-Serviceclosure:

```powershell
$env:WERKZ_SCHROTTIES_SOURCE_ROOT='C:/Users/patsl/Projects/WERKZ-AI/.runtime/schrotties-source-50d9145'
$env:WERKZ_SCHROTTIES_SOURCE_BLOB='e6a3efadb3d414fa610b5d4e9177fda9260374bd'
node --test test/schrotties-original-http.test.js
```

Die Testdatei prüft den gewählten Git-Blob vor Import und für50d9145 zusätzlich den
Outbound-Modulblob. Die externe Closure ist lokal; CI führt standardmäßig nur den
versionierten Mirrorfall aus. Eine grüne CI ist deshalb kein neuer CI-Test der externen
50d9145-Dateien. Diese wurden separat lokal ausgeführt.

## Verbleibender P0-Schritt

Den Original-UI-Abnahmeserver auf dieser explizit gewählten Quelle mit sicheren Host-/
Origin-/Sitzungsgrenzen und ausschließlich synthetischen Mandanten vorbereiten; zuerst
negative Netzwerk-/Fremdtenanttests, danach Browser-Rechner→Auftrag→Tour→Abschluss.
Keinen historischen0.0.0.0-Server und keine Live-Adapter starten. Mail/Belegexport,
Version-/Migrationsentscheidung, reale Geräte und öffentlicher Rollout bleiben eigene
Gates. Die schon länger bekannte Belegklassifikationsabweichung wurde nicht umbenannt.

Öffentliche AltlinkkorrekturPR86 bleibt bis neuer ausdrücklicher Freigabe unangewendet.
Keine menschliche Arbeitszeit gebucht und kein neuer Vertrag/Providerzugang eingerichtet.
