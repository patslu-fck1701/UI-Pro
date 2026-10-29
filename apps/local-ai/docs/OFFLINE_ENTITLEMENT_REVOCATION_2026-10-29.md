# Hotel: Offline-Cache bei Modulwiderruf

Stand: 29.10.2026 · Branch `codex/aiz-qwen-context-20261029`

## Änderung

Beim nächsten erfolgreichen Online-Abgleich vergleicht der verschlüsselte Offline-Tresor
die bisherigen Modulfreigaben mit `/api/me`. Ändert sich eine Freigabe, werden bis auf
die Identitätsantwort alle gecachten API-Daten und lokalen Entwürfe verworfen. Noch
ausstehende Änderungen bleiben verschlüsselt, werden aber als Konflikt markiert und
nie automatisch erneut übertragen. Der Tresor wird gesperrt; die App lädt die neue
Identität, sodass widerrufene Module aus der Oberfläche verschwinden. Der sichtbare
Hotel-Arbeitsbereich wird nach dem Widerruf aus der angemeldeten Navigation entfernt.

Die lokale Oberfläche behandelt Änderungen der Modulfreigaben als neue
Berechtigungsepoche: laufende Qwen-Anfragen werden abgebrochen und vorhandene
Gesprächs-, Dokument- und AiZ-Kontextdaten aus dem UI-Speicher geleert. Der Status des
freigegebenen AiZ-Wissens wird mit der neuen Modulfreigabe erneut geladen.

Ein Gerät ohne Netz kann einen serverseitigen Widerruf nicht sofort erfahren. Bis zum
nächsten erfolgreichen Online-Abgleich bleiben Daten nur im bereits entsperrten,
verschlüsselten Browser-Tresor zugänglich. Die App führt nach dem Abgleich keine
stille Wiederherstellung alter Entwürfe durch.

## Geprüft

- TypeScript/Vite-Build bestanden.
- Browserprüfung im Headless Edge: verschlüsselte IndexedDB, echte Netzwerkunterbrechung,
  Offline-Neuladen und Entsperren, genau einmalige Synchronisierung sowie gleichzeitige
  Serveränderung mit sichtbarem Konflikt bestanden.
- Zusätzlicher Ablauf: Hotel-Freigabe wird bei bestehender Sitzung serverseitig gesperrt;
  der Browser erkennt die geänderte Freigabe, entfernt Hotel-Cache und Entwürfe, hält
  vorgemerkte Änderungen zur manuellen Prüfung an, entfernt den Hotel-Arbeitsbereich aus
  der Navigation und gibt den widerrufenen Hotel-Cache offline nicht mehr zurück.
- Bestehende Backend-Regressionen für Entitlement-Grenzen und Widerruf laufender KI-Streams:
  `tests/test_entitlements.py` und `tests/test_stream_revocation.py`, 4 bestanden.
- Ansichten bei 390, 768 und 1440 Pixeln ohne horizontalen Überlauf bestanden.

## Grenzen

Dies ist eine lokale Programm-/Preview-Änderung und kein externer Produktions- oder
KundenZ-Freigabenachweis. Der installierte Hotel-Programmstand wird erst nach Review,
Commit/Abgleich und gezielter Installationsabnahme aktualisiert. Google-, Render-,
Lovable- und WebsitePublisher-Daten werden hierdurch nicht verändert.
