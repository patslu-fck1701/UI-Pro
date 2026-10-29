# Sicherheits- und Betriebsgrenzen

Anwendung und Modellserver binden an Loopback. Nicht ohne zusätzliche Absicherung öffentlich bereitstellen. Das lokale Programm ist keine Freigabe für echte Kundendaten oder einen Mehrbenutzerbetrieb über das Internet.

Passwörter/PINs werden gesalzen mit scrypt gespeichert. Sitzungen sind zeitlich begrenzt, serverseitig widerrufbar und werden über HttpOnly/SameSite-Strict-Cookies übertragen. Ändernde Browserzugriffe benötigen einen passenden Origin. Modulzugriff, Rolle, Benutzer- und Mandantenzuordnung werden in der API kontrolliert. Modell-API-Schlüssel liegen ausschließlich unter .runtime und werden nicht ins Installationsarchiv aufgenommen. Bestehende externe Tokens wurden nicht geändert.

Für diesen rein lokalen, unverschlüsselten HTTP-Ursprung setzt das Sitzungscookie kein Secure-Attribut. Eine Veröffentlichung erfordert TLS, passende Cookies, strengere Zugangsvorgaben, Betriebskonzept und gesonderte Prüfung. Eine vierstellige lokale PIN ist zulässig, bietet aber begrenzten Schutz bei Zugriff auf den Rechner. Windows-Kontoschutz und Datenträgerverschlüsselung bleiben eigenständige Aufgaben.

Dateien: maximal 10 MB Upload, tabellarisch 10000 Zeilen/100 Spalten, PDF bis 50 Seiten; strukturierte Analyse ist kein fachliches Vollgutachten. XML wird mit defusedxml verarbeitet. Inhalte aus Dateien und Modellantworten sind unzuverlässige Eingaben und lösen keine Systembefehle oder externen Aktionen aus. Markdown erlaubt kein Roh-HTML.

Betreiber-Sicherungen über backup.ps1 sind als .wzb mit Windows-DPAPI verschlüsselt und an denselben Windows-Benutzer gebunden. Vollständige CLI-Sicherungen umfassen Datenbank und Uploads und entfernen aktive Anmeldesitzungen, Gästeportal-Sitzungen und Demo-Wechselberechtigungen. Die Wiederherstellung prüft Paket und Betriebsmodus. Einzelheiten und Grenzen: docs/LOCAL_BACKUP_AND_RESTORE.md. Der API-Download sichert nur die Datenbank. Die Wiederherstellung prüft Archivpfade und SQLite-Integrität, entfernt Sitzungen und erhält den vorherigen Bestand als lokale Sicherung. Aufbewahrung, verschlüsselte externe Kopien und Wiederherstellungsprüfung müssen für einen produktiven Betrieb zusätzlich organisiert werden.

Nicht umgesetzt: ein speziell auf explizit sexuelle oder pornografische Generierung ausgerichteter Modus oder eine Umgehung von Schutzmechanismen.
