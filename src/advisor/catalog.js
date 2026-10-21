'use strict';
const {CommercialCatalog}=require('../commercial/catalog');
const definition=require('../../config/catalog/werkz-v0.2.json');
const CATEGORIES=Object.freeze([
  {key:'customers',label:'Kunden & Anfragen'}, {key:'time',label:'Zeit & Einsatz'},
  {key:'documents',label:'Belege & Büro'}, {key:'projects',label:'Aufträge & Material'},
  {key:'communication',label:'Kommunikation & Schnittstellen'}, {key:'team',label:'Team & Steuerung'}
]);
function feature(key,category,label,benefit,moduleId,route,matches,tier='solo'){
  return Object.freeze({key,category,label,benefit,moduleId,route,matches,minimumPackage:tier,status:route?'demo_verified':'manual_review_required'});
}
const customerRoute='/pilot/handwerk/#customers',inquiryRoute='/pilot/handwerk/#inquiries',documentRoute='/pilot/handwerk/#documents';
const FEATURES=Object.freeze([
  feature('customers','customers','Kundenkartei','Kunden und Betriebe zentral erfassen.','werkz.customers',customerRoute,/kunde|kontakt/i),
  feature('customerPhone','customers','Telefonnummern','Telefonnummern am Kundeneintrag speichern.','werkz.customers',customerRoute,/telefon|kontakt/i),
  feature('customerAddresses','customers','Einsatzadressen','Adressen zum Kunden und Einsatz festhalten.','werkz.customers',customerRoute,/adresse|einsatzort/i),
  feature('inquiries','customers','Anfragen erfassen','Neue Anliegen mit Telefon und Einsatzort aufnehmen.','werkz.simple',inquiryRoute,/anfrag|rückruf|rueckruf|zettel/i),
  feature('callbackQueue','customers','Rückrufliste','Offene Rückrufe an einem Ort sehen.','werkz.simple',inquiryRoute,/rückruf|rueckruf|telefon/i),
  feature('callbackDone','customers','Rückrufe abschließen','Erledigte Rückrufe nachvollziehbar abhaken.','werkz.simple',inquiryRoute,/rückruf|rueckruf/i),
  feature('inquiryNotes','customers','Anliegen & Notizen','Das Anliegen schriftlich zur Anfrage festhalten.','werkz.simple',inquiryRoute,/notiz|anliegen|zettel/i),
  feature('time','time','Arbeitszeiten','Arbeitszeit starten und stoppen.','werkz.time','/pilot/handwerk/#times',/zeit|stund/i),
  feature('timeAssignment','time','Zeit je Kunde oder Einsatz','Zeitbuchungen einem Kunden oder Einsatz zuordnen.','werkz.time','/pilot/handwerk/#times',/zeit|einsatz|baustell/i),
  feature('workCalendar','time','Einsatzkalender','Gewünschte Termine und Einsätze gemeinsam planen.',null,null,/termin|kalender/i,'team'),
  feature('teamAssignment','time','Mitarbeitereinsatzplanung','Teams und Mitarbeitende zu Einsätzen einteilen.','werkz.orders',null,/team|personal|planung/i,'team'),
  feature('documents','documents','Belegablage','Fotos und PDF-Belege geschützt hochladen.','werkz.documents',documentRoute,/beleg|foto|datei|dokument/i),
  feature('receiptCategory','documents','Belege kategorisieren','Werkzeug, Tanken, Privat und Sonstiges unterscheiden.','werkz.documents',documentRoute,/beleg|kategor|tanken/i),
  feature('documentReview','documents','Belege manuell prüfen','Zuordnung und Angaben vor der Übergabe selbst prüfen.','werkz.documents',documentRoute,/beleg|prüf|pruef/i),
  feature('documentDownload','documents','Belege herunterladen','Eigene abgelegte Belege wieder herunterladen.','werkz.documents',documentRoute,/beleg|datei/i),
  feature('export','documents','Monatsvorbereitung','Belege zur manuellen Monatsprüfung zusammenstellen.','werkz.billing-prep',documentRoute,/monat|steuer|abrechn/i),
  feature('exportDownload','documents','Monatsübersicht herunterladen','Die vorbereitete Monatsübersicht als JSON herunterladen.','werkz.billing-prep',documentRoute,/monat|export|steuer/i),
  feature('quotations','documents','Angebote erstellen','Individuelle Kundenangebote aus Positionen vorbereiten.',null,null,/angebot/i),
  feature('invoices','documents','Rechnungen erstellen','Rechnungsentwürfe für Leistungen und Material erstellen.',null,null,/rechnung/i),
  feature('erechnung','documents','E-Rechnung','Strukturierte elektronische Rechnungen verarbeiten.',null,null,/e-rechnung|xrechnung|zugferd/i),
  feature('accountingExport','documents','Buchhaltungsschnittstelle','Eine automatische Übergabe an die Buchhaltung prüfen.','werkz.billing-prep',null,/datev|buchhalt/i,'team'),
  feature('recognition','documents','Automatische Belegerkennung','OCR und automatische Zuordnung statt manueller Erfassung prüfen.','werkz.documents',null,/erkenn|ocr/i),
  feature('reminders','documents','Zahlungserinnerungen','Offene Rechnungen und Zahlungserinnerungen bearbeiten.',null,null,/mahn|zahlung/i),
  feature('orders','projects','Auftragsplanung','Aufträge vom Eingang bis zum Abschluss organisieren.','werkz.orders',null,/auftrag/i,'team'),
  feature('checklists','projects','Baustellenchecklisten','Wiederkehrende Prüfpunkte je Einsatz abarbeiten.',null,null,/checklist/i,'team'),
  feature('projectPhotos','projects','Baustellenfotodokumentation','Projektfotos getrennt von Belegen nach Einsatz organisieren.','werkz.documents',null,/baustellenfoto|fotodoku/i,'team'),
  feature('digitalAcceptance','projects','Digitale Abnahme','Abnahme und Unterschrift vor Ort dokumentieren.',null,null,/abnahme|unterschrift/i,'team'),
  feature('materials','projects','Materiallisten','Materialbedarf für einen Auftrag zusammenstellen.','werkz.materials',null,/material/i,'team'),
  feature('inventory','projects','Lagerbestände','Materialbestände und Entnahmen nachvollziehen.','werkz.materials',null,/lager|bestand/i,'team'),
  feature('supplierOrders','projects','Lieferantenbestellungen','Nachbestellungen und Lieferantenabläufe bündeln.',null,null,/lieferant|bestell/i,'team'),
  feature('voice','communication','Telefon-KI','Automatische Gesprächsannahme und Zusammenfassung prüfen.','werkz.channel.voice',null,/telefon-ki|telefonassistent/i),
  feature('gmail','communication','E-Mail-Sortierung','Relevante E-Mails erkennen und einem Ablauf zuordnen.','werkz.channel.gmail',null,/e-mail|email|postfach/i),
  feature('whatsapp','communication','WhatsApp-Nachrichten','Benachrichtigungen über einen freigegebenen Kanal prüfen.','werkz.channel.whatsapp',null,/whatsapp/i,'team'),
  feature('integrations','communication','Programmschnittstellen','Vorhandene Fachprogramme kontrolliert anbinden.',null,null,/schnittstell|verbinden|integration/i,'team'),
  feature('customerPortal','communication','Kundenportal','Kunden einen eigenen geschützten Einblick geben.',null,null,/portal/i,'team'),
  feature('roles','team','Individuelle Mitarbeiterzugänge','Persönliche Konten und passende Rechte einrichten.',null,null,/mitarbeiterzugang|rollen|berechtigung/i,'team'),
  feature('approvals','team','Freigabeabläufe','Entscheidungen vor der Ausführung bestätigen.','werkz.approvals',null,/freigab/i,'team'),
  feature('analytics','team','Kennzahlen & Auswertung','Betriebliche Kennzahlen und Übersichten auswerten.','werkz.analytics',null,/kennzahl|analyse|auswert/i,'business'),
  feature('simulation','team','Szenarien & Simulation','Alternative Abläufe und Auswirkungen untersuchen.','werkz.simulation',null,/simulat|szenari/i,'business'),
  feature('multiLocation','team','Mehrere Standorte','Abläufe verschiedener Standorte zusammenführen.',null,null,/standort|filial/i,'business'),
  feature('automations','team','Individuelle Automatisierung','Mehrere Schritte zu einem abgestimmten Ablauf verbinden.',null,null,/automat|workflow/i,'business'),
  feature('offline','team','Erweiterter Offline-Betrieb','Weitere Arbeitsbereiche ohne Verbindung prüfen.',null,null,/offline|funkloch/i,'team')
]);
const PLANNED=Object.freeze(Object.fromEntries(FEATURES.filter(x=>!x.route).map(x=>[x.key,x.label])));
const catalog=new CommercialCatalog(definition);
const PACKAGES=Object.freeze(['solo','team','business'].map((id,index)=>{
  const suffix=id.toUpperCase(),setup=catalog.item('WZ-SETUP-'+suffix),operation=catalog.item('WZ-OPS-'+suffix);
  return Object.freeze({id,rank:index,name:'WerkZ '+suffix[0]+suffix.slice(1).toLowerCase(),setupCents:setup.amountCents,monthlyCents:operation.amountCents,typicalSetupRangeCents:setup.typicalRangeCents,priceKind:'from',catalogVersion:definition.version});
}));
module.exports={CATEGORIES,FEATURES,PLANNED,PACKAGES,catalog};
