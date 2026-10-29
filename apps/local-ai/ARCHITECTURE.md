# Architektur

React/TypeScript/Vite und Tailwind bilden die Oberfläche. FastAPI liefert sie und die API vom selben lokalen Ursprung aus. SQLAlchemy und SQLite mit Fremdschlüsseln/WAL halten Benutzer, Sitzungen, Chats, Dateien und Module. llama.cpp stellt ausschließlich lokal eine kompatible Streaming-Schnittstelle bereit.

## Gemeinsamer Kern

backend/app.py verwaltet Anmeldung, Chat, Upload, Export und API-Grenzen. backend/security.py hasht Passwörter mit scrypt und Sitzungstoken mit SHA-256. backend/engine.py spricht den lokalen Modellserver an. backend/core.py vermittelt den Zugriff anderer Module auf Betriebsdaten und Rückrufe.

## Module

Module liegen unter backend/modules; Manifeste unter packages sowie config/packages. Core bleibt aktiv. Business besitzt eigene Tabellen und Dienste; Voice nutzt die Core-Schnittstelle zum Anlegen geprüfter Rückrufe. Creative und DeutschZ verwenden die gemeinsamen Datei- und Chatdienste. Automation speichert Vorschläge und Freigaben, führt aber keine externen Aktionen aus.

Module werden pro Mandant serverseitig geprüft, einschließlich bereits bestehender Chatverläufe. Ein ausgeblendeter Menüpunkt ist nicht die Zugriffssperre. Benutzer lesen ihre eigenen Chats/Dateien; Businessdaten sind innerhalb ihres Mandanten rollenabhängig geteilt. Paket und Betriebsmodus bilden getrennte Datenspeicher.

## Angebote und KI

Preise entstehen serverseitig aus Decimal-Mengen, ganzzahligen Centpreisen und gerundeter Steuer. PDF und Antwort übernehmen dieselbe gespeicherte Berechnung. Der Chat bekommt bei aktivierter Betriebsdatenoption einen aktuellen, begrenzten Datenbankschnappschuss als lesbaren Kontext. Er darf Daten nicht eigenständig ändern. Transkriptergebnisse werden erst nach ausdrücklichem Prüfen in Rückrufe übernommen.

Control Center, D:/WerkZ, öffentliche Handwerksdemo und DeutschZ-Server werden durch dieses neue lokale Projekt nicht verändert oder technisch zusammengelegt.

Technische Referenzen: https://fastapi.tiangolo.com/advanced/custom-response/ und https://tailwindcss.com/docs/installation/using-vite .


## Branchen und Offline-Schicht – 26.10.2026

Hotel nutzt eigene SQLAlchemy-Modelle mit Alembic-Migrationen. Handwerk und Schrotties nutzen branchen-/tenantgebundene WorkRecords; Zeitbuchungen, Korrekturen und Workflow-Idempotenz liegen in gemeinsamen Platform-Tabellen innerhalb des jeweiligen Paketdatenraums. Das Gästeportal hat eigene befristete Zugangssitzungen, die beim Checkout widerrufen werden. Ein Demo-Wechselgrant ist getrennt von der normalen Anmeldung. Betreiberkonten können nicht über die öffentliche Demo-Rollenauswahl gewechselt werden.

Die PWA speichert ausschließlich öffentliche Oberflächen im Service Worker. Private Daten, Formularentwürfe und Outbox liegen AES-GCM-verschlüsselt in einem konto-/originbezogenen IndexedDB-Tresor. Actor-/Tenant-Bindung und Revisionen werden serverseitig geprüft. Kontowechsel verwirft verspätete Antworten und Entsperrungen. Kritische Freigaben bleiben serverseitig. Die lokale KI erhält rollenberechtigte Daten, bei Zimmerfragen nur die konkret angefragten Zimmer und zugehörigen Vorgänge.
