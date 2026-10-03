# DeutschZ – AIConvoyZ Event-Spezifikation

Stand: 03.10.2026  
Status: verbindliches SOLL für Entwicklung und WerkZ Event-Test

## Ziel

AIConvoyZ ist ein dynamisches PvE-/PvPvE-Event. Der Konvoi soll keine passive Lootkarawane sein, sondern auf Spieler reagieren und – wenn Spieler ihn zunächst ignorieren – selbst ein inszeniertes Gefecht erzeugen.

## Routen

Es gibt zwei feste Strecken:

1. Balota → Rifi-Schiff / Rifi-Gaszone
2. Northwest Airfield → Pavlovo-Gaszone

Pro Eventlauf wird eine Route gewählt.

## Konvoi-Aufbau

- Fahrzeug 1: Humvee, 1 Fahrer
- Fahrzeug 2: Truck, 1 Fahrer + 1 Beifahrer
- Fahrzeug 3: Humvee, 1 Fahrer + 1 Beifahrer
- Startbesatzung insgesamt: 5 AI
- Fahrzeuge sollen als zusammengehöriger militärischer Konvoi mit sinnvollen Abständen fahren.

## Aktivierung

Der komplette Konvoi muss nicht dauerhaft aktiv sein.

- Vollständige Erzeugung/Aktivierung erst bei ungefähr 1000 m Spielerannäherung.
- Vorher möglichst keine unnötigen AI-Berechnungen.
- Der Spawn soll für Spieler möglichst unauffällig erfolgen.

## Loot

Fahrzeugloot auf KOTH-Eventniveau, deutlich über normalem Weltloot. Mögliche Kategorien:

- hochwertige Waffen
- Magazine und Munition
- seltene Attachments
- medizinisches Material
- Spezialausrüstung
- Event-Gegenstände
- seltene Verbrauchsgegenstände

## Spieler greift an

Angriff oder ernsthafter Fahrzeugschaden schaltet in Kampfmodus:

- Konvoi stoppt sinnvoll.
- AI verlässt Fahrzeuge.
- AI sucht Deckung.
- AI erkennt/verteidigt gegen Angreifer.
- Fahrzeuge und Eventbereich werden verteidigt.

## Verstärkungs-/Crash-Phase

Nach Angriff Meldung wie: „Feindliche Verstärkung ist unterwegs.“

Kein echter Verstärkungshelikopter erforderlich. Nach definierter Verzögerung:

1. Helikopter-/Annäherungssound
2. Crash-/Absturzsound
3. vordefiniertes Helikopterwrack spawnt

## Blackbox

Am Wrack liegt eine spezielle Blackbox.

- Hackdauer ca. 90–120 Sekunden.
- Interaktion durch dauerhaftes Halten, z. B. F oder linke Maustaste.
- Spieler bleibt währenddessen verwundbar.
- Abbruchbedingungen bei Loslassen/Bewegung klar definieren.
- Nach erfolgreichem Hack wird Lootzugriff möglich.

Belohnung:
`Toxicz_Doc_Decoder` / ToxicZ Dokumenten Decoder.

## ToxicZ-Kette

Quelle 1:
KOTH → `ToxicZ_Secret_Document`

Quelle 2:
AIConvoyZ → `Toxicz_Doc_Decoder`

Kombination:
`ToxicZ_Secret_Document + Toxicz_Doc_Decoder → ToxicZ_Signal_Marker`

Beide Zutaten werden bei der Kombination verbraucht.

Erst die Aktivierung des `ToxicZ_Signal_Marker` startet ToxicZ. Bloßer Besitz der beiden Ausgangsgegenstände darf ToxicZ nicht starten.

## Fraktionen

DeutschZ-Schreibweise:

- Russianz
- Americanz

Zusätzlicher gegnerischer Trupp: 2–3 AI.

Welche Fraktion den Konvoi stellt und welche als gegnerischer Trupp auftritt, kann pro Lauf wechseln oder konfiguriert werden.

## Wenn kein Spieler angreift

Der Event darf nicht einfach am Routenziel verschwinden.

Kurz vor Ende:

1. gegnerischer AI-Trupp erscheint
2. Russianz und Americanz kämpfen gegeneinander
3. dynamische, weit hörbare Gefechtssounds starten
4. das Gefecht soll Spieler neugierig machen und anziehen

## Entfernungssound

- weit entfernt: leiser, aber deutlich wahrnehmbar
- mittlere Entfernung: klar hörbares Gefecht
- nahe: sehr intensive Kampfkulisse

Lautstärke pro Spieler anhand Entfernung skalieren und bei mehreren Spielern auf Belastung testen.

## Spieler greift in AI-vs-AI ein

Solange kein Spieler eingreift, bekämpfen sich Russianz und Americanz.

Bei Spielerannäherung/Sichtkontakt/Angriff/Fahrzeugbeschuss:

- AI-vs-AI-Kampf beenden
- beide Fraktionen konzentrieren Aggro auf Spieler
- eintreffende Spieler werden gemeinsamer Gegner

## Vollablauf A – Spielerangriff

Route wählen → Spieler ~1000 m → Konvoi aktivieren → Humvee/Truck/Humvee fahren → Angriff → Konvoi stoppt → AI verteidigt → Verstärkungsmeldung → Helisound → Crashsound → Wrack → Blackbox 90–120 s hacken → ToxicZ Dokumenten Decoder → 2–3 gegnerische AI greifen ein → Event plünderbar → Cleanup/Slot frei.

## Vollablauf B – Spieler ignoriert Konvoi

Route wählen → Konvoi fährt fast bis Ziel → gegnerischer Trupp → Russianz vs. Americanz → dynamische mapweite Kampfgeräusche → Spieler nähert sich/greift ein → beide Fraktionen wechseln auf Spieler → Eventabschluss → Cleanup/Slot frei.

## Implementierungsreihenfolge

1. Konvoi-Grundsystem: Routen, 3 Fahrzeuge, AI-Sitze, Routenfahrt, Abstände, Cleanup
2. Spieleraktivierung: 1000-m-Erkennung, Last/Spawn testen
3. Kampfverhalten: Schaden/Angriff, Aussteigen, Deckung, Gegenwehr, Stoppen
4. Loot: KOTH-Qualität, Verteilung Truck/Humvees
5. Verstärkung/Crash: Meldung, Heli-/Crashsound, Wrack
6. Blackbox: Interaktion, 90–120 s, Abbruch, Decoder
7. Fraktionssystem: Russianz/Americanz, Beziehungen, 2–3 AI
8. AI-vs-AI: Endpunktphase und Gefecht
9. dynamische Gefechtssounds: Entfernung/Lautstärke/Mehrspielerlast
10. Spieler übernimmt Aggro: Nähe/Sicht/Angriff erkennen, beide Fraktionen auf Spieler
11. ToxicZ-Verknüpfung: Secret Document + Decoder → Signalmarker → Markeraktivierung startet ToxicZ
