# Schrotties: Originalbestand und Demo-Neufassung

Stand: 27.10.2026. **PARTIAL, keine Funktionsparität oder Wiederinbetriebnahme behauptet.**
Die bestehende Python-Demo auf Loopback8002 und der historische Node-Pilot sind
verschiedene Implementierungen. Geschäftsdatensätze wurden weder gelesen noch migriert.

## Unveränderte Quelle

Der historische Mirror `D:/WerkZ/mirror/schrotties-live` enthält17 Dateien. Die unveränderte
lokale Quellkopie `.runtime/schrotties-original-source-20261026.zip` wurde erneut gegen
alle17 Dateien verglichen: **17/17 bytegleich**, Archiv-SHA256
`65bacfcd26fcc44d3fb75f445c3ab64d505fe973ba9cc8455b50035ed0b4e687`.

`docs/operations/SCHROTTIES_LIVE_STATE.json` ordnet den Mirror dem früheren öffentlichen
UI-Pro-Commit `50d914513ef075050dc4746fda7a9a40c728257d` zu. Die dortige LIVE-Angabe
stammt vom06.10.2026 und ist **historisch**; sie reaktiviert keinen suspendierten Dienst.
Keine neue öffentliche Schrotties-URL oder aktuelle Render-Bereitschaft daraus ableiten.

## Neue gezielte Prüfung des Original-Frontends

Aus dem unveränderten Mirror ausgeführt:

```powershell
node --test --test-reporter=spec test/pilot-local-runtime.test.js test/simple-pilot-ui.test.js
```

Ergebnis: **71 bestanden, 0 Fehler, 0 Skips**, Node-Testprozess Exit0.
Davon23 ausführende Runtimefälle im Node-VM mit DOM-/Storage-/Netzwerk-Stubs und48
Quell-/UI-Invarianten. Kein Browser-/Mikrofon-/Telefonie-/Geräte-End-to-End-Nachweis.
Es wurden keine neuen Tests geschrieben und keine Ergebnisse durch Mockänderungen
grün gemacht. Bereits früher bestandene Servicefälle wurden nicht erneut ausgeführt.

Die Runtimefälle belegen unter simuliertem Netzausfall insbesondere sofortiges lokales
Speichern, verzögerte Sessionantworten, tenantgebundene Ablage, Stimmerkennungs-
Abschluss/Fallback, Adresserhaltung, Auftragsabschluss/-löschung, Tourreihenfolge und
deduplizierte Rechnerübernahme. Maps-Ziele sind generierte URLs/Mocknavigation;
kein echter Google-Maps-Aufruf oder geographischer Nachweis.

## Abgleich zu vorhandenen Python-Bausteinen

| Originalpfad / Funktion | Python-Demo-Baustein | Abgleich / verbleibende Arbeit |
| --- | --- | --- |
| Kunden-/Rückruf-/Auftragsliste: listCustomers, listCalls, recordCall | work_app Kunden/Aufträge | Grundpfad vorhanden; spezielle Call-/Notizfelder und Ereignisverknüpfung nicht äquivalent nachgewiesen |
| parseOperationalNote, addNote, originaler Offline-Sprachauftrag | gemeinsamer Sprach-/Chatpfad | Keine portierte vollständige Originalparser-/Offline-Sprachkette; Original separat erhalten |
| pickupEstimate, Rechner → normaler Call mit Idempotenz | Angebote und WorkCommands | Handwerksangebot ist kein Schrott-Ankaufsrechner; eigener originalgetreuer Übernahmepfad fehlt |
| saveRouteOrder, routePlan, verbundene Maps-Tour | Zuweisung/Fahrerauftrag/Fahrzeug | Disposition vorhanden; Original-Tourreihenfolge und Maps-Route nicht gleichwertig nachgewiesen |
| vehicleLoadSummary, clearVehicleLoad | Lagerbewegung und Auftragsmaterial/Nutzlastprüfung | Auftragsmaterial ist keine vollständige fahrzeugweite Ladungs-/Verkaufsbuchführung |
| recordSettlement, dealerInsights, gelernter Händlerpreis | synthetische Lagerpreise mit Quellenlabel | Keine portierte Händlerabrechnung/Preishistorie; Musterwerte nicht als Marktpreise ausgeben |
| operatingProfile, monthlyEconomics, addCashEntry | allgemeine Business-/Zeitmodule | Betriebsbasis, Bargeldfluss und unvollständige Kosten müssen gesondert abgeglichen werden |
| addDocument, classifyDocument, prepareExport | geschützte Dokumente/Analyse/Entwürfe | Kein Nachweis gleicher Belegkategorien/Monatsarchivlogik; keine automatische Steuerzuordnung |
| BackupState/Restore plus Dokumentbytes | DPAPI-Sicherung/Restore je Demo | Neues Format besteht lokal; kein getesteter Import alter Pilotdaten |
| Gmail/iCloud, Markt-/Preisadapter, OutboundMailPort | Adapterregistry/Entwurf | Externe Verbindungen nicht hergestellt; vorhandene Schnittstellen wiederverwenden, keine Secrets kopieren |

Diese Tabelle ist eine Quellinventur, keine Behauptung fehlender Funktionen in anderen
WerkZ-Branches. Referenzen für die Neufassung: `backend/work_app.py`,
`backend/time_service.py`, `backend/adapters.py`, `tests/work_scenarios.py`.

## Warum der Mirror nicht unverändert gestartet wurde

Der Mirror ist ein Belegarchiv, keine vollständige Standalone-Installation:
`tools/time-test-server.js` importiert unter anderem fehlende `src/index.js`,
`src/pilot/twilio-voice.js` und `src/pilot/storage-readiness.js`. Das zugehörige
package.json verweist zusätzlich auf nicht gespiegelte Quell-/Prüfdateien.
Der historische Server bindet ausdrücklich `0.0.0.0`; createPilotRuntime konstruiert
einen LiveScrapPriceProvider. Ein Start dieses Originals würde daher weder den
gewünschten Loopback- noch den rein synthetischen Offline-Nachweis erfüllen.

Kein npm-Install im Mirror, kein Start dieses Servers, keine neuen Listener,
kein Scraping, keine Reaktivierung suspendierter Dienste, keine Änderung der17 Quellen.
Die bestehenden drei Demos bleiben unter8000/8001/8002 erhalten und antworteten in
diesem Lauf jeweils `/api/health` mit200/appok/engineready.

## Nächster begrenzter P0-Schritt

1. Vollständige Abhängigkeitsbasis an einem **exakten kanonischen Commit** ermitteln;
   fehlende Dateien nicht unbesehen aus anderen Branches mischen.
2. Original-Service/HTTP-Handler in isolierter Testumgebung mit ausschließlich
   synthetischen Mandanten, statischen Preisen und Draft-Kommunikationsadaptern
   zusammensetzen. Keine bestehende Geschäfts-DB öffnen.
3. Vor einem Original-UI-Start Loopback, Host-/Origin-/Sessiongrenzen und externe
   Netzwerkverweigerung testen; zwei fremde Mandanten negativ prüfen.
4. Erst danach Browserabnahme für Original-Rechner → Auftrag → Tour → Abschluss
   und Notiz/Beleg → manuelle Monatsprüfung. Die alte bekannte Service-Testabweichung
   bei unklassifiziertem Supermarktbeleg (`pruefen` statt alter Erwartung `privat`)
   bleibt offen dokumentiert; nicht stillschweigend durch Änderung der Erwartung lösen.
5. Eine Migration erst mit explizitem Formatmapping und isoliertem Restore nachweisen.

Keine menschlichen Arbeitsstunden aus Agentenlaufzeit gebucht. Öffentliche
AltlinkkorrekturPR86 bleibt unabhängig davon ausdrücklich freigabepflichtig.
