# WerkZ Hotel – lokaler Programmstart

Aktueller Betreiberauftrag: persönliche Programmnutzung mit eigener Anmeldung statt
Vorführprofilen. Hotel samt KI zuerst, Handwerk danach, Schrotties zurückgestellt.

## Tatsächliche Umstellung

Ein neuer Startmodus des vorhandenen Programms, keine zweite App oder KI-Engine:
Package hotel / Mode production. Eigene persistente Daten unter data/hotel-production,
eigener Sessioncookie werkz_hotel_program. Vorhandenes hotel-demo-demo und dessen
synthetische Gäste/Mitarbeiter bleiben erhalten und werden nicht migriert.

Der Programmstart erzeugt keine Demo-Zimmer, Gäste, Reservierungen, Mitarbeiter oder
Vorführkonten. Zimmerkategorien und Zimmer lassen sich jetzt mit Adminrechten anlegen;
Duplikate und fremde Kategorien werden serverseitig abgewiesen. Keine Demo-Start- oder
Resetfunktion im Programm, beide Endpunkte403. Telefon-Simulation wird nicht angeboten.
Hotel-Einstieg, Hauptstarter und Autostartprüfung erwarten den neuen Hotel-Programmstand.
Alte Handwerk-/Schrotties-Starts bleiben kompatibel.

Das Betreiberkonto wird ausschließlich über die vorhandene lokale Setup-/Login-API
angelegt. Das Enrollment-Werkzeug erhält ein Passwort über stdin, nie als Argument,
Datei oder Ausgabe. Die Anwendung speichert nur einen gesalzenen scrypt-Hash. Konkrete
Zugangsdaten gehören nicht in dieses Dokument, GitHub, AiZ oder Drive. Eine lokale
Anmeldung verknüpft keine Google-, GitHub-, Windows- oder DeutschZ-Identität.

## Nachweise

- Python-Gesamtsuite55bestanden/1Skip/0Fehler.
- TypeScript/Vite-Build bestanden.
- Headless-Edge: leeres Hotel, Anmeldung, eigene Zimmerkategorie und Zimmer anlegen,
  Persistenz nach Reload, keine Demo-/Simulationsbedienung bestanden.
- Produktionsmodus-Szenario:0Zimmer/0Gäste/0Reservierungen vor eigener Einrichtung,
  keine Demo-Seeds, Demo-Endpunkte403, doppelte Nummer/Kategorie409, fremde Kategorie404,
  Hotel-KI-Chat und berechtigter Hotelkontext mit eigenen Testdaten bestanden.

## Grenzen

Lokaler Installations-Readback am29.10.2026: Hotel8001 meldet hotel/production/ready,
Autostart-Health READY_LOCAL. Persönliches Betreiberkonto über sicheren interaktiven
Passworteingang angelegt und Anmeldung per API tatsächlich geprüft. Nachher genau ein
Adminbenutzer, null Gäste, null Zimmer, null Reservierungen; gespeichertes Passwort
entspricht dem gesalzenen scrypt-Hashformat. Keine Zugangswerte in diesem Nachweis.
Desktop-Einstieg WERKZ/01 - WerkZ Hotel.lnk; alter Hotelstarter korrigiert.
Vorherige Programme lokal rückfallgesichert, Testdaten unverändert erhalten.

production ist der technische Startmodus ohne Seeds, keine pauschale Freigabe für
externen Kundenbetrieb oder bestätigte Produktvollständigkeit. Gemeinsame Mehrbetriebs-
Shell, unabhängige verschlüsselte Sicherung/Restore, produktive KundenZ-Autorisierung,
Provider, laufende KI-Widerrufe und Geräteabnahmen bleiben separate Gates.
Die öffentliche Website und externe Konten bleiben unverändert.
