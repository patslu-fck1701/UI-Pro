# WerkZ Zeiterfassung — Entwicklungsaufwand und Arbeitsweise

**Baseline:** KB-v1.29  
**Datum:** 2026-09-29  
**Aufwand bis zum dokumentierten Stand:** ca. **5 Stunden**

## Warum diese Angabe wichtig ist

Der aktuelle Stand der Gabriel-/WerkZ-Zeiterfassung entstand nicht durch einen einmaligen automatischen Auftrag nach dem Muster „Aufgabe eingeben, zurücklehnen, fertig“.

Die Arbeit war ein iterativer Entwicklungsprozess mit ChatGPT-Unterstützung:

`Idee -> umsetzen -> auf dem echten Handy testen -> Fehler beobachten -> korrigieren -> erneut testen -> verfeinern -> wiederholen`

Bis zum aktuell dokumentierten Stand wurden ungefähr fünf Stunden in diesen Zyklus investiert.

## Art der Arbeit

Die Entwicklungsleistung bestand unter anderem aus:

- Ablauf und mobile Bedienlogik definieren;
- Login-/Zugangsfluss aufbauen und später umstellen;
- Arbeitgeber-/Auftraggeberauswahl entwickeln;
- laufenden Arbeitszeit-Counter implementieren;
- separaten Baustellen-/Einsatzabschluss aufbauen;
- GPS und Reverse-Geocoding praktisch testen;
- Spracheingabe und Fallbacks testen;
- Foto-/Dokumentationsfluss vorbereiten;
- Rückkehr zur laufenden Schicht absichern;
- Feierabend-/Weiterleitungslogik mehrfach analysieren und korrigieren;
- Tagesübersicht robust machen;
- Fehler wie leere Auswertung und 414 Request-URI Too Large nachvollziehen;
- Fehlerursachen in wiederverwendbare Guardrails übersetzen;
- den funktionierenden Pilot in ein generisches WerkZ-Modul überführen;
- GitHub, WebsitePublisher und Google Drive auf denselben Wissensstand bringen;
- Backup-, Recovery-, Test- und Fehlerjournal-Regeln ergänzen.

## Einordnung

Die Angabe „5 Stunden“ ist **kein allgemeines Leistungsversprechen** und kein Beweis dafür, dass vergleichbare Kundenprojekte immer in fünf Stunden entstehen.

Sie ist Entwicklungs- und Prozessevidenz für diesen konkreten Stand: Mit ChatGPT als Arbeitswerkzeug wurde die Idee aktiv entworfen, umgesetzt, kontrolliert, korrigiert und verfeinert. Die menschliche Steuerung, Bewertung und wiederholte Kontrolle waren ein wesentlicher Bestandteil.

## Abgrenzung zu One-shot-/Agentenarbeit

Dieser Stand ist ausdrücklich **nicht** durch einen einzigen Codex-/Agentenauftrag entstanden, der danach autonom fertig ausgeliefert wurde.

Das belastbare Muster für WerkZ lautet:

`Idee -> erster funktionaler Stand -> reale Nutzung -> Beobachtung -> Fehler/Korrektur -> Nachtest -> Verfeinerung -> dokumentierte Lernregel`

Genau dieser Iterationszyklus ist für WerkZ künftig selbst Teil der Entwicklungs- und Qualitätsmethodik.
