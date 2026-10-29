# Kundenbereitstellung – offene Freigaben

Stand: 26.10.2026. Aktuelle Anwendung ist als lokale synthetische Demo geprüft. Kein produktiver Hotel-, Handwerks- oder Schrotties-Kundenbetrieb freigegeben.

Vor Kundeninstallation: genaue gekaufte Module/Rollen, Paket und Betriebsmodell festlegen; sichere Kontoeinrichtung und TLS für Fernzugriff; dauerhaften Daten-/Dateispeicher, Backup und unabhängige Schlüsselwiederherstellung abnehmen; Lösch-/Aufbewahrungsregeln umsetzen; Vertrags-/Datenschutzunterlagen und Dienstleister prüfen; tatsächliche Kundengeräte, Mehrgeräte-Synchronisierung, Sitzungsablauf und verlorenes Gerät testen. Keine unverbindlichen Rechnungsentwürfe automatisch versenden oder als steuerlich freigegebene Rechnungen ausgeben.

Jede Branche und jeder Modus besitzt einen eigenen Datenraum. `-Mode production` legt keine Demonstrationsdaten an und ist allein keine Betriebsfreigabe. Lokale Betreiberkonten und Windows-DPAPI-Sicherungen dürfen nicht in Kundenpakete kopiert werden. Ein Archiv enthält Quellcode und Oberfläche, keine Laufzeiten, Modellgewichte, Konten oder Kundendaten.

Das private kanonische WerkZ-Repository bleibt technische Quelle. Diese lokale FastAPI-Anwendung ist ein eigenes Demo-Paket; die bestehende Node-/Render-Handwerksdemo bleibt eine getrennte Laufzeit. Zusammenführung erfolgt über einen geprüften Integrationszweig. Getestete lokale Funktionen werden nicht automatisch zu öffentlichen Produktversprechen.

Für KI: vorhandenes Qwen wiederverwenden. Datenbankzugriff läuft über berechtigte Core-Leseschnittstellen. Modellantworten sind prüfpflichtig. RAG und optionale Cloud-Modelle nach Issue #72 bleiben eine nach P0 geplante Stufe; keine Trainings- oder Cloud-Datenübertragung behaupten.
