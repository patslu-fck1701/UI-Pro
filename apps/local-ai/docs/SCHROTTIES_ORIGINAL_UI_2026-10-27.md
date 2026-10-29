# Schrotties Original-UI: lokale Funktionsabnahme

27.10.2026, auf dem vorhandenen Windows-Rechner. Keine öffentliche Bereitstellung.

## Umfang

`tools/schrotties-original-sandbox.js` lädt ausschließlich gehashte Originalquellen
aus dem vorhandenen Mirror. Die Originaldateien bleiben unverändert. Ein eigener,
ausdrücklich synthetisch markierter Dateispeicher und Loopback-Port werden verwendet;
bereits befüllte fremde Verzeichnisse werden abgelehnt. Zwei Mandanten und ein
Lesekonto erhalten echte befristete lokale Sitzungen mit eigenen Cookie-Namen.
Host, Origin, Login-Challenge und Rollen werden geprüft. Externe Provider,
echte Nachrichten, Restore und Veröffentlichung sind in dieser Prüfhülle gesperrt.
Statische Preise/Fake-/Draft-Provider sind Testabhängigkeiten, keine echten Anbindungen.

## Gefundener Bedienungsfehler und Änderung

Im In-App-Browser scheiterte der Original-Auftragsabschluss mit
`Error: prompt() is not supported`. Die lokale HTML-Auslieferung ersetzt allein
die alten Abschlussabfragen durch ein natives HTML-dialog-Formular mit Gewicht,
tatsächlich erfolgter Zahlung, Beleg und Ladungsübernahme. Abbrechen verändert
keinen Auftrag. Der ursprüngliche Service/Abschlussweg bleibt erhalten.
Andere historische prompt-/confirm-Abläufe sind damit nicht pauschal repariert.

## Tatsächlich geprüft

- Node-Sicherheitssuite: 5/5 bestanden. Echter fremder Host mit node:http geprüft;
  fetch hatte den Host-Override ignoriert und war deshalb kein gültiger Test.
- Browser mit isoliertem temporärem Speicher: Anmeldung, 1.000kg zu 260 EUR/t,
  10km einfache Strecke, geplante Kundenzahlung 150 EUR, Auftrag erstellen,
  Abschluss abbrechen und bestätigen, Reload/Persistenz, zweiter Mandant leer.
- Der Originalstatus heißt `erledigt`; keine Umbenennung im Originaldatenmodell.
- Eine geplante Zahlung erzeugt keinen tatsächlichen Kassenbucheintrag.
- Breiten 390/768/1440 ohne horizontalen Überlauf; keine Seitenfehler und keine
  externen Netzwerkrequests im Browserlauf. Keine physische iOS-/Android-Abnahme.
- Gesamtes `npm run verify`: 265 bestanden, 1 bestehender Skip, 0 Fehler;
  Syntax, Typen, Lint, SBOM, Herkunft und Secretprüfung bestanden.

Wiederholung: `node apps/local-ai/tests/browser_schrotties_original.mjs`.
Optionaler Screenshotpfad über `WERKZ_BROWSER_EVIDENCE`. Testdaten werden nur aus
dem pro Lauf erzeugten, geprüften temporären Verzeichnis entfernt.

## Grenzen / Fortsetzung

Keine produktive Authentifizierung, keine vollständige Originalparität, keine
Live-Preis-/Google-/Render-Anbindung. Prüfhost nur manuell für synthetische Abnahme:
`node tools/schrotties-original-sandbox.js --data-dir <eigener-synthetischer-Ordner> --port 8134`.
Nächster Schritt: weitere benötigte Originalfunktionen gezielt abnehmen und diese
kleine UX-Reparatur erst nach Quellabgleich in die zuständige Demoquelle übertragen.
Nicht den historischen Originalserver mit öffentlichem Bind/Live-Providern starten.
