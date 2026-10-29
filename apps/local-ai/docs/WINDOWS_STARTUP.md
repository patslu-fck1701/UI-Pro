# Windows-Anmeldestart und lokale Diagnose

Der vorhandene Startweg bleibt maßgeblich: `start.ps1`, `scripts/start-model.ps1`
und die vorhandenen CMD-Dateien. `scripts/startup.ps1` ergänzt deren Orchestrierung;
es installiert keine Software und ersetzt keine Datenbank.

## Bedienung

Im installierten App-Verzeichnis mit Windows PowerShell 5.1 oder PowerShell 7:

```powershell
./scripts/startup.ps1 -Action Health
./scripts/startup.ps1 -Action Start
./scripts/startup.ps1 -Action Repair
./scripts/startup.ps1 -Action Repair -Apply
./scripts/startup.ps1 -Action Register
./scripts/startup.ps1 -Action Unregister
```

`Repair` zeigt standardmäßig nur den festen Startplan. `-Apply` ruft ausschließlich
den vorhandenen lokalen Start auf: kein Prozesskill, keine Installation/Migration,
keine beliebige Shell-Anweisung. Ein falscher Zielport oder fehlende Installation
wird blockiert. Manuell freigegebener Modellwechsel bleibt ein separater Betreiberbefehl.

`Register` verwaltet genau `WerkZ-Local-AI-Startup`, startet bei Anmeldung des aktuellen
Benutzers, interaktiv mit normalen Rechten, ohne Passwortspeicherung und ohne globale
ExecutionPolicy-Änderung. `-OpenBrowser` ist optional; standardmäßig bleibt der Browser
geschlossen. Andere geplante Aufgaben bleiben erhalten. Die Aufgabe verwendet den
tatsächlichen Installationspfad; nach Umzug erneut registrieren. Ein abweichendes
bestehendes Ziel wird nicht überschrieben. `Unregister` entfernt nur diesen eigenen
Trigger; Anwendungen und Daten laufen beziehungsweise bleiben erhalten.

## Grenzen und Zustände

- Standardstart: Handwerk 8000 und genau eine gemeinsame Qwen-Engine 8080 auf Loopback.
  Hotel 8001/Schrotties 8002 bleiben über vorhandene Starter bei Bedarf aufrufbar.
- Mutex für Startorchestrierung, App- und Modellstart; Aufgabenplanung IgnoreNew.
- Modellport wird vor Wiederverwendung auf vorhandene ausführbare Datei und
  Loopback-/Portparameter geprüft. Fremde Prozesse werden nicht beendet.
- `launch-local.py` startet ausschließlich die bestehenden Backend-/Modellprozesse
  mit geschlossenen geerbten Handles. Das verhindert, dass ein Hintergrunddienst den
  Ausgabekanal eines längst beendeten PowerShell-Aufrufs offen hält.
- Phase BOOTSTRAPPING → READY_LOCAL → CHECKING_CONNECTIONS → DEGRADED, solange
  direkte lokale Anbieteradapter fehlen. Ein Codex-Plugin beweist keinen lokalen Adapter.
- Health prüft vorhandene Dateien, lesbares Modell, Engineprogramm, Loopback-Listener,
  begrenzte lokale HTTP-Healthchecks sowie RAM-/Platzmetadaten. Kein Vollscan von Dateien,
  kein automatischer RAG-/Cloudimport und keine regelmäßige Modell-Testgenerierung.
- `.runtime/startup-status.json` wird ersetzt, nicht unbegrenzt angehängt. Hintergrund-
  Sync-Logs werden pro Start überschrieben. Bestehende Service-Logs bleiben privat lokal.
- `/api/local-status` ist authentifiziert und gibt nur freigegebene Statusfelder zurück,
  niemals Raw-Logs, Pfade, Ressourcenwerte oder Credentials. Bericht älter als zehn
  Minuten wird als veraltet markiert; aktueller Modellhealth bleibt separat sichtbar.
- Der Hintergrundcheck überträgt momentan keine Daten: GitHub, Drive, Lovable, Render,
  WebsitePublisher und WhatsApp sind ausdrücklich NOT_CONFIGURED_IN_LOCAL_RUNTIME.
  Echtes ETag-/Delta-Sync folgt erst mit geprüftem Adapter/Scope; kein READY_FULL-Versprechen.

## Nachweis am Betreiberrechner, 26.10.2026

- Windows PowerShell 5.1: Health/Start/Registrierung/Task-Ausführung geprüft.
- PowerShell 7: Health/Repair-Dry-run/Start geprüft; Syntaxparser für neue Skripte bestanden.
- Zweimal Register: ein Eintrag, Limited, IgnoreNew. Direkter Aufgabenplaner-Lauf:
  LastTaskResult 0, identische vorhandene Listener-PIDs.
- Zwei gleichzeitige Starts nach kontrolliertem Stop des eigenen Backends: beide
  Exitcode 0, eine Backendinstanz, vorhandenes Qwen wiederverwendet; zusammen 10,51 s.
- Kontrollierter eigener Qwen-Neustart: bereit nach 4,09 s; genau ein Modellprozess.
  Gemessener Arbeitsspeicher danach 3161 MB (Momentaufnahme, kein Peak-/Dauerlastnachweis).
- Lokaler Healthcheck 1,48–1,90 s in den beobachteten Läufen; keine allgemeine Bootzeitzusage.
- Python-Suite im installierten App-Verzeichnis: 31 bestanden; isolierter Backendtest
  beweist, dass der PowerShell-Ausgabekanal nach Start schließt. Build und Browser-Recovery
  bestanden. Drei Branchen-Browserläufe auf vorhandenen Instanzen bestanden.

Noch offen: echter neuer Windows-Login, Reboot, Sleep/Resume, anderer Benutzer,
Geräteverlust, vollständiger Offline-/Reconnect-Test, echte Adapter-Deltas und zentrale
Lovable-Anzeige. Kein Neustart/Abmelden des Rechners für einen vermeintlich grünen Nachweis.
SQLite-Integrität und Backup/Restore bleiben separate Datenprüfungen; der schnelle
Starthealth ist kein Ersatz für diese Prüfungen. Remote-/Kundenreparatur ist nicht freigegeben.
