# Öffentliche Handwerksvorführung

Stand: 26.10.2026

## Einstieg und Umfang

`/demo/` bietet fünf vorbereitete Rollen ohne Kennworteingabe: Chef, Büro, Disposition, Monteur und Buchhaltung. Der Handwerk-Host leitet seinen bisherigen Start und `/pilot/handwerk/` dorthin. Persönliche Zugänge bleiben unter `/handwerk/login` erreichbar; `/berater/` bleibt eingestellt.

Jede Browsersitzung erhält eine zufällige, eigene Demoorganisation mit einem Beispielkunden, einem offenen zugewiesenen Wartungsauftrag und einem abgeschlossenen Auftrag mit 90 synthetischen Arbeitsminuten, Materialbericht, Einsatzbericht und offener Freigabe. Rollenwechsel erhalten denselben Datenstand. Zurücksetzen erzeugt einen frischen Betrieb und entwertet die bisherige Demo.

Vorführablauf: Chef → Monteur (Zeit starten/stoppen, berichten, fertigmelden) → Chef (Abrechnung vorbereiten und freigeben) → Buchhaltung (Checkliste und JSON-Unterlage herunterladen).

## Grenzen

Die öffentliche Vorführung verwendet die bestehenden rollenprüfenden Handwerk-Services mit einem eigenen Speicheradapter. Sie nutzt weder die persistente Betriebsdatenbank noch deren Sitzungen, Provider-Tokens oder externe Dienste. Externe Integrationen, Benutzer-/Rollenverwaltung, Kennwortänderungen und Versand sind serverseitig gesperrt. Eine öffentliche Freigabe bestätigt ausschließlich einen synthetischen Vorgang innerhalb der Demo; persönliche Zugänge behalten ihre Kennwortprüfung.

Fotos/Belegdateien, externe Telefonie, E-Mail, WhatsApp-Steuerung und Rechnungsversand gehören nicht zum vorführbaren Umfang dieser Rollenansicht. Es wird keine fertige Rechnung erzeugt. Der lokale Kundenberater verlinkt die Demo ohne Gesprächs-, Kunden- oder Preisdaten und kennzeichnet nicht vorführbare Bausteine.

## Betrieb

Demos liegen nur im Arbeitsspeicher, enden nach zwei Stunden und werden bei einem Prozessneustart verworfen. Maximal 40 gleichzeitige Beispielbetriebe; neue Starts erhalten bei Auslastung HTTP 503. Pro Betrieb gilt eine Speichergrenze von 1 MB, Requests sind auf 16 KiB begrenzt. Änderungen werden je Betrieb serialisiert und vor Übernahme auf Organisationszugehörigkeit geprüft. Cookies sind HTTP-only und SameSite=Strict; öffentlich zusätzlich Secure. Schreibzugriffe benötigen dieselbe Origin.

Keine neuen Render-Variablen oder Datenbankmigrationen erforderlich. Auto-Deploy bleibt ausgeschaltet. Rückweg: vorherigen Deploy von Commit `f8c849d` wiederherstellen; die Demo schreibt keine Daten, die zurückmigriert werden müssten.

## Prüfung

- `npm run verify` einschließlich Isolation, Rollenrechten, CSRF-Abwehr, Freigabe, 90-Minuten-Unterlage, Reset und gesperrten Integrationen.
- Browserprüfung aus dem privaten WerkZ: `node tools/handwerk-demo-ui-smoke.js <Pfad-zum-UI-Pro-Spiegel>`; alternativ mit der öffentlichen HTTPS-Basisadresse für die Prüfung nach Auslieferung.
- Vorführbarkeit ist kein Produktionsnachweis für echte Kundendaten.
