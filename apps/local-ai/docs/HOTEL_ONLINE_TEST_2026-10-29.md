# Hotel: autorisierte externe Testinstanz

Nutzerauftrag vom 29.10.2026: Hotel muss über das Internet auf Smartphone und fremden Rechnern testbar sein. Eigener Branch `codex/hotel-online-test-20261029`, Basis `2f83707d41437ab09d0adf386ed6f14b3d702fb2`. Keine lokale persönliche Datenbank wird übertragen.

## Umfang

- Bestehende Hotel-App und vorhandene Besucherprofile werden wiederverwendet. Jeder Browser erhält einen eigenen synthetischen Tenant und zeitlich begrenzte Rollen-Sitzungen. Rollenwechsel bleiben innerhalb dieses Tenants.
- Öffentlicher Modus ausschließlich mit explizitem Render-Host, passender HTTPS-Origin, Secure/HttpOnly/SameSite-Cookies, HSTS, gesperrter Betreibereinrichtung und begrenzten Teststarts.
- Neue kostenlose Render-Webinstanz in Frankfurt, Auto-Deploy aus. Keine Änderung am bestehenden Handwerkdienst oder DNS.
- Free-Dateisystem ist temporär. Änderungen können bei Neustart/Deployment verloren gehen; Oberfläche weist darauf hin. Keine echten Gast-, Mitarbeiter- oder Kundendaten eingeben.
- KI-Verbindung ist in dieser Cloud-Testinstanz noch nicht hergestellt. Health und Loginseite kennzeichnen dies ausdrücklich. Der lokale Qwen-Port wird nicht geöffnet.

## Tatsächlich geprüft

- `tests/online_hotel_smoke.py`: Health, Setup-Sperre, Authentifizierung, Host-/Origin-Abweisung, sichere Cookies, zwei getrennte Besucher/Hotelrollen und Modulgrenzen bestanden.
- TypeScript/Vite-Build bestanden; bekannte JS-Bundlewarnung (887.33 kB) bleibt offen. npm-Abhängigkeitsprüfung meldete 0 bekannte Schwachstellen.
- Online-Deploy, URL, öffentlicher Readback und Browserablauf werden nach tatsächlicher Ausführung ergänzt.

## Rückfall und Grenzen

Bestehende lokale Hotelinstallation und Handwerkdienst unverändert. Neue Testinstanz kann separat suspendiert werden; kein Datenrollback versprochen. Keine Produktionsfreigabe oder reale Mobilgeräteabnahme allein durch HTTP-Health.
