# Hotelstart: irreführende Freigabemeldung

Ursache: Die Oberfläche initialisierte workspace=business. Beim Einlesen des angemeldeten
Hotelkontos starteten Chat- und Dokumenten-Effekte für diesen deaktivierten Arbeitsbereich,
bevor die bestehende Einstiegswahl auf hotel wechselte. Die korrekten403-Antworten wurden
als allgemeiner Fehler angezeigt, obwohl Hotel aktiv war. Keine fehlende Hotelberechtigung.

Vorher reproduziert: Browsertest sieht bei zwei Seitenstarts insgesamt vier403-Anfragen
an /api/chats?workspace=business und /api/documents?workspace=business.

Korrektur: Automatische Datenlade-Effekte prüfen vor dem Request die aktuelle
Modulfreigabe des Arbeitsbereichs. Nicht freigegebene Dokumentbereiche werden geleert.
Serverseitige Guards, Konten, Passworthashes und Betriebsdaten bleiben unverändert.

Nachher: TypeScript/Vite-Build bestanden. Echter Edge-Programmstart inklusive Reload,
Zimmeranlage und Persistenz ohne403-Startrequests oder Freigabefehler bestanden.
Zusätzlicher Entitlement-Browserregressionstest (Sperren/Testfreigabe/Reload,
390/768/1440Breiten) ebenfalls bestanden. Kein umfassender neuer Backend-/CI-Nachweis.
