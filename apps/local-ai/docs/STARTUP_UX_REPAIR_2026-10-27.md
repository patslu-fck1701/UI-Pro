# Start und Bedienung – Reparaturstand 27.10.2026

Installiert in C:/Users/patsl/Projects/WERKZ-AI, Quelle auf codex/local-ai-demos-20261026.

## Geändert und geprüft

- Control Center öffnet beim Anmelden vor Modell-/Dienstprüfungen; nur ein Tab pro Explorer-Sitzung. Der lokale Prüfbericht wird weiter gespeichert, aber nicht zusätzlich aufgedrängt.
- Bereits bereite drei Anwendungen werden wiederverwendet. Netzwerklistenerprüfung erfolgt gesammelt statt viermal. Loopback-Prüfung bleibt erhalten.
- READY_LOCAL beschreibt ausschließlich die tatsächlich gesunde lokale Runtime. Externer Abgleich bleibt separat NOT_CONNECTED; kein aktiver Provideradapter wird behauptet.
- Vorbelegter Gesprächsinhalt entfernt, Bereich als Gesprächsauswertung beschriftet. Leere Eingabe kann nicht zur Auswertung abgeschickt werden. Kein Telefonanschluss wird behauptet.
- Installation vor Überschreiben mit altem Quellstand abgeglichen; Sicherung unter .runtime/boot-fix-20261027. Kein Datenbankreset, keine Zugangsdatenänderung.

## Belege

- Windows-PowerShell-Syntax und fehlende Installation: 2 bestanden, 1 Lifecycle-Test mangels .venv im Quellworktree übersprungen.
- Installierte Oberfläche: TypeScript und Vite-Build erfolgreich; Browserprüfung mit isolierten synthetischen Daten bestanden (Anmeldung, Kunden, Angebotsarithmetik, PDF, CSV, Module, echte Qwen-Antwort und Überlaufprüfung 390/768/1440).
- Wiederanlauf bei bereits laufenden Diensten: 1,84 s; Healthprüfung 1.260 ms. Einzelne HTTP-Healthantworten 51/22/36 ms für Handwerk/Hotel/Schrotties. Keine Kaltstart- oder Modellantwort-Latenzbehauptung.
- Sichtbarer Einstieg in lokales Handwerks-Vorführprofil geprüft; Navigation und lokaler KI-Bereitstatus erscheinen.

## Offen und abzugrenzen

- Neuer vollständiger Windows-Login mit dieser letzten Korrektur noch nicht beobachtet. Task zuvor erfolgreich (Result 0); installierter Start jetzt direkt erfolgreich ausgeführt.
- Private Lovable-Oberfläche unverändert de3ecfac; direkte dortige Qwen-Gatewayanbindung weiterhin offen. Keine neuen Cloudzugänge oder Kosten.
- Browser-Bundle weiterhin 865 kB unkomprimiert; Aufteilung nach Funktionsbereichen als nächster gezielter Performance-Schritt, keine Messung erfunden.
- Original-Schrotties-Sandboxdateien uncommittet erhalten. Ein Host-Spoof-Test muss mit echtem HTTP-Host statt von fetch ignoriertem Header korrigiert werden. Kein fertiger Sicherheitsnachweis für diese Sandbox.
- Öffentliche Altlinkreparatur PR86 weiterhin nicht freigegeben; keine Veröffentlichung, kein Merge/Deploy.
- GitHub-/Drive-Abgleich dieses Reparaturschritts noch ausstehend, bis erfolgreich extern geschrieben und zurückgelesen.