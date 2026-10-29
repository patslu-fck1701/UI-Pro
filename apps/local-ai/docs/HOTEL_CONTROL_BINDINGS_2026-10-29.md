# Hotel-KI, Konten und begrenzte AiZ-Anbindung

## Umsetzung in der vorhandenen Anwendung

WerkZ-Backend und private Betreiberansicht bleiben der Ausführungsort. Die Pakete
Master Control, KundenZ, AiZ und WerkZ liefern Regeln und Zuständigkeiten; im aktuellen
Toolkatalog sind keine eigenen MCP-Aktionen dieser vier Plugins verfügbar. Es wurde
keine automatische Plugin-zu-Plugin-Kommunikation behauptet oder ein neues Dashboard
erstellt. DeutschZ bleibt ohne Live-Adapter und ohne Datenübernahme getrennt.

- KundenZ-Vertragsseite: bestehende current_user-Anmeldung, ModuleConfig, Rollen-
  Guards und Audit weiterverwendet. Admin kann die vorhandenen Hotel-Fachrollen
  zuweisen. Keine freie Admin-/Mandanten-/Fremdmodulrolle aus Clientdaten.
- WerkZ-KI: Sitzung, Rolle/Mandant, Chat-, Modul- und Dokumentzugriff vor Modellstart
  und vor jedem ausgegebenen Antwortteil erneut geprüft. Bei Widerruf kein nächster
  Token und Generator explizit geschlossen. Bereits rechtmäßig ausgegebene Teilantwort
  bleibt als interrupted gespeichert; keine neuen Daten nach Entzug.
- AiZ: KnowledgeSearchPort ruft ausschließlich die vorhandene lokale knowledge.py
  read-only auf. Konfiguration mit exakt geprüftem Git-Head und Skript-SHA256 in der
  lokalen Datei config/aiz-binding.json; Beispiel ohne aktive Bindung versioniert.
  Keine vom HTTP-Client vorgebbaren Pfade, Projekte, Interpreter oder Befehle.
- Treffer nur aus werkz/shared, maximal5. Vor Ausgabe Rehydration der ausgewählten
  versionierten approved/portable-Quellen und Abgleich aller Antwortfelder. Geänderter
  Code, Revision, Quelle oder manipulierte/veraltete Indextexte werden abgewiesen.
  Keine Reindexierung, Wissensfreigabe, Lernkartenerstellung oder automatische Übergabe
  in den Qwen-Kontext durch diese Suchfunktion.
- Master-Control-Vertragsseite: GET /api/operator/domains liefert reale lokale
  Readbacks mit Prüfzeit. KundenZ-/Master-Control-Vollintegration PARTIAL, kein
  unabhängiger Watchdog und kein verifizierter Plugin-MCP-Kanal. Keine grünen
  Globalzustände aus installierten Plugins abgeleitet.

## Tatsächlich ausgeführte Nachweise

- Gesamte Python-Suite61bestanden/1Skip/0Fehler, TypeScript/Vite bestanden.
- Modellsynthetisch bei realer HTTP/SQLite-Sitzung: Modulwiderruf, Logout, Ablauf,
  Rollenwechsel, Mandantenwechsel und Dokumentwiderruf stoppen den nächsten Token;
  Generator geschlossen und busy frei. Widerruf beim Promptbudget verhindert bereits
  Modellaufruf und Nachrichtenspeicherung. Bestehende Streamtests weiter bestanden.
- Hotelrollen: Rezeption und Housekeeping erzeugbar und anmeldbar; keine Admin-
  Zuweisung/Fremdmodulrolle/fremder Tenant; Housekeeping erhält keine Gäste/Rechnungen.
- Operator-HTTP: anonym401, Hotel-Fachrollen403; project=deutschz als unbekanntes
  Suchfeld422. Keine fremden Projektquellen abgefragt.
- AiZ-Integrationstest mit tatsächlicher AiZ-CLI in synthetischem Git/FTS5-Checkout:
  WerkZ/shared-Zitate, DeutschZ-Abschirmung, Widerruf, Indexmanipulation, Codepin und
  Querylimits bestanden. Test verlangt unabhängiges AiZ-Checkout, andernorts Skip.
- Reales D:/AiZ geprüft: Head0f45b1528dc7891d5ea3cc161495effb82cba7b6,
  lokale CLI erreichbar, vorhandener Index0freigegebene Regeln, Suche Hotel0Treffer.
  Das ist eine echte leere Suchantwort, kein erfundener Wissensinhalt.
- Edge-Programmablauf: Betreiberansicht, Anzeige der Anbindungen und Anlegen einer
  Rezeption per Formular bestanden; bestehender Zimmer-/Reload-Test ohne403 ebenfalls.
  Entitlement-Browserablauf390/768/1440weiter bestanden.

## Offene Grenzen

Keine produktive externe Identitätsföderation/MFA oder Provideranbindung, kein
unabhängiges Master-Control-Monitoring. Laufende objektbezogene ACL-Änderungen ohne
Rollen-/Modulwechsel brauchen weiterhin ein gemeinsames Rechte-Epoch-System.
Offline-Cache-Widerrufe und gemeinsame Mehrbetriebsnavigation noch nicht vollständig
abgenommen. Kein neues freigegebenes Wissen erzeugt. Keine Veränderung der Website.
