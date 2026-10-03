# DeutschZ – ToxicZ / Toxics Event-Spezifikation

Stand: 03.10.2026  
Status: verbindliches SOLL für Entwicklung und WerkZ Event-Test

## Startvoraussetzung

Der Spieler benötigt:

- `ToxicZ_Secret_Document` aus KotHZ/KOTH
- `Toxicz_Doc_Decoder` aus AIConvoyZ

Beide werden kombiniert und verbraucht. Ergebnis:
`ToxicZ_Signal_Marker`

Erst die Aktivierung des Signalmarkers startet die persönliche ToxicZ-Eventinstanz.

## Hauptziel

Endziel ist Rify/Riffy, die verseuchte Zone am Schiff. Der Spieler wird nicht direkt dorthin geschickt, sondern über mehrere dynamische Missionsabschnitte geführt.

## Dynamische Zwischenstationen

Mindestens zwei geeignete Stationen ausgehend von der aktuellen Spielerposition, z. B.:

- Krankenhäuser
- medizinische Einrichtungen
- Feuerwachen
- passende ABC-/medizinische Orte

Die Stationen werden pro Lauf dynamisch gewählt. Nicht immer dieselben Orte. Danach führt die Route nach Rify.

## ABC-Ausrüstung

Auf dem Weg wird ein vollständiger spezieller DeutschZ-/ToxicZ-ABC-Anzug zusammengesucht:

- Oberteil/Jacke
- Hose
- Handschuhe
- Schuhe/Stiefel
- Kapuze/Kopfschutz
- Atemschutzmaske
- ungefähr 3 Filter

Die Gegenstände werden zufällig auf die gewählten Zwischenstationen verteilt. Die Verteilung darf sich zwischen Eventläufen ändern.

## ABC-Texturfehler

Der spezielle ABC-Anzug wird derzeit teilweise weiß dargestellt. Zu prüfen:

- tatsächliche Klassen aus Source
- Materialpfade
- Texture-Pfade
- `hiddenSelectionsTextures`
- `hiddenSelectionsMaterials`
- Backslash-/Pfadangaben

Keine erfundenen Klassennamen verwenden; vorhandene DeutschZ-Assets übernehmen und korrigieren.

## Mehrspieler

Mehrere Spieler können unabhängig dieselbe Quest starten.

- erste Routen möglichst voneinander getrennt
- später unauffällige Konvergenz Richtung Rify
- gemeinsame oder benachbarte spätere Ziele möglich
- kein Hinweis wie „anderer Spieler macht dieselbe Mission“
- natürliche PvP-Begegnungen möglich, aber nicht künstlich angekündigt

## Rify-Einstieg

Der Spieler betritt Rify zunächst normal. Die Storyphase startet nicht direkt am Eingang.

Trigger erst, wenn der Spieler tief genug/mittig in der Zone bzw. Richtung Schiff gelangt ist.

## Stimmen / Dead-Channel-Führung

Innerhalb Rify startet akustische Storyführung:

- Richtungsangaben
- Hinweise
- Anweisungen
- Situationsinformationen
- Führung zu gesicherter Stellung/Festung

Vorhandene Radio-/Voice-/Storysysteme aus Source bevorzugen und erweitern.

## Zombie-Horde

Nach ausreichendem Fortschritt:

- Horde hinter dem Spieler bzw. im Rückweg
- keine offensichtlichen Spawns direkt vor dem Spieler
- Rückweg wird gefährlich/praktisch abgeschnitten
- Spieler wird in den vorgesehenen Storypfad gedrängt

## Storybereich

Vorhandene Rify-Systeme, Plankarten, Dokumente, Funkmeldungen, Objekte und Trigger zuerst übernehmen. Fehlende Verbindungen ergänzen; keine unnötige Neuerfindung.

Wichtige Storyinformationen in Rify:

- Transport Sieben scheiterte bei maritimer Isolation von Q-17
- Morozovs tatsächliches Todesdatum
- Befehle wurden nach seinem Tod weiter mit seiner Kennung signiert

## Finale Flare

Endziel am Bug des Rify-Schiffes:

- vorgesehene Signalflare aktivieren/entzünden
- Flare ist der Abschluss-Trigger von ToxicZ
- vorhandene Flare-Klasse aus aktuellem ToxicZ-Source endgültig bestätigen
- belegter Altbestand: `GasZonen_Leuchtfackel` / `DZBBC_GasZoneFlare`

## Nach Rify

Wichtig: Die finale Flare startet nach aktuellem Storykanon NICHT direkt Operation DeutschZ.

Sie schließt ToxicZ ab und öffnet die nächste Ermittlungsphase:

ToxicZ → ATM RaidZ (optional) → PropertyZ → CourierZ → RAVEN → BattlegroundZ → Operation DeutschZ.

## Implementierungsreihenfolge

1. vorhandene ToxicZ-/Marker-/Plankarten-/Story-/Rify-/ABC-Systeme prüfen
2. Itemkombination und persönliche Eventinstanz
3. dynamische Route mit mindestens zwei passenden Stationen
4. vollständiges ABC-Set + ca. 3 Filter zufällig verteilen
5. ABC-Klassen/Texturen/Materialpfade reparieren
6. parallele Spieler: getrennte Starts, spätere verdeckte Konvergenz
7. Rify-Fortschritt und tiefer Triggerbereich
8. Stimmen-/Voice-System
9. Zombie-Horde hinter dem Spieler
10. vorhandene Rify-Story ohne Sackgassen verbinden
11. finale Signalflare am Bug
12. ToxicZ-Abschluss persistieren und Nach-Rify-Ermittlungsphase öffnen

## Bestätigter aktueller Source-Fehler

`deutschz_toxicz/config.cpp` definiert:
`DZToxicZ_DocumentDecoder : ElectronicRepairKit`

Dadurch kann der Decoder als Elektronikreparaturset dargestellt werden. Soll ist ein konsistenter GPSReceiver-/CardReader-/Decoder-Vertrag.
