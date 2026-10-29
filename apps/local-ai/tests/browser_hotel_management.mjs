import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.env.WERKZ_TEST_APP_ROOT||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-hotel-browser-')),port=8126,base='http://127.0.0.1:'+port;
const server=spawn(path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port',String(port),'--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_DATA:directory,WERKZ_AI_PACKAGE:'hotel-demo',WERKZ_AI_MODE:'demo'},stdio:'ignore'});
let browser;
try{
  let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/api/setup')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}assert.equal(ready,true);
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByRole('button',{name:'Hoteldemo mit fertigen Profilen starten',exact:true}).click();
  await page.getByRole('heading',{name:'Dein Hotel. Alles im Blick.',level:2,exact:true}).waitFor();
  const initial=await (await context.request.get(base+'/api/hotel/snapshot')).json();assert.equal(initial.metrics.rooms,42);
  await page.getByRole('button',{name:/Zimmer gesamt/}).waitFor();assert.match(await page.getByRole('button',{name:/Zimmer gesamt/}).innerText(),/42/);
  await page.getByRole('button',{name:'Neuer Gast',exact:true}).click();
  const form=page.locator('#hotel-new-reservation');await form.getByLabel('Neuer Gast – vollständiger Name',{exact:true}).fill('SYNTHETISCH · Browsergast Klar');
  await form.getByLabel('Kontakt des neuen Gastes (optional)',{exact:true}).fill('0000-TEST');
  const arrival=new Date(Date.now()+40*86400000).toISOString().slice(0,10),departure=new Date(Date.now()+42*86400000).toISOString().slice(0,10);
  await form.getByLabel('Anreise',{exact:true}).fill(arrival);await form.getByLabel('Abreise',{exact:true}).fill(departure);
  const roomSelect=form.locator('label').filter({hasText:/^Zimmer/}).locator('select');const option=roomSelect.locator('option').nth(1);
  try{await option.waitFor({state:'attached',timeout:12000});}catch(error){const response=await context.request.get(base+'/api/hotel/availability?'+new URLSearchParams({arrival,departure,persons:'1'}));throw Error('Zimmeroption fehlt: HTTP '+response.status()+' '+(await response.text()).slice(0,500)+' UI '+(await form.innerText()).slice(0,500),{cause:error});}
  const id=await option.getAttribute('value');
  await roomSelect.selectOption(id);await form.locator('label').filter({hasText:/^Reservierungsart/}).locator('select').selectOption('confirmed');
  await form.getByRole('button',{name:'Reservierung prüfen & speichern',exact:true}).click();await page.getByText('Reservierung dauerhaft gespeichert.',{exact:true}).waitFor();
  let saved=await (await context.request.get(base+'/api/hotel/snapshot')).json();const guest=saved.guests.find(g=>g.name==='SYNTHETISCH · Browsergast Klar');assert.ok(guest);const reservation=saved.reservations.find(r=>r.guest_id===guest.id);assert.ok(reservation);const number=saved.rooms.find(r=>r.id===reservation.room_id).number;
  await page.reload();await page.getByRole('heading',{name:'Dein Hotel. Alles im Blick.',level:2,exact:true}).waitFor();saved=await (await context.request.get(base+'/api/hotel/snapshot')).json();assert.ok(saved.reservations.find(r=>r.id===reservation.id));
  await page.getByRole('button',{name:/Reinigung offen/}).first().click();const dirty=await page.locator('.hotel-overview [data-room]').count();assert.equal(dirty,saved.metrics.cleaning_needed);
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow '+width);}
  await page.getByRole('button',{name:'Hotelübersicht',exact:true}).click();await page.getByRole('button',{name:'WerkZ AI',exact:true}).click();
  await page.getByLabel('Deine Nachricht',{exact:true}).fill('Welche bestätigte Reservierung gibt es für Zimmer '+number+' vom '+arrival+' bis '+departure+'? Antworte nur mit dem gespeicherten Gastnamen.');
  await page.getByRole('button',{name:'Senden ↗',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.message.assistant')?.textContent?.includes('Browsergast Klar'),{},{timeout:180000});
  await page.getByRole('button',{name:'Senden ↗',exact:true}).waitFor({timeout:180000});assert.deepEqual(errors,[]);
  if(process.env.WERKZ_BROWSER_EVIDENCE){fs.mkdirSync(process.env.WERKZ_BROWSER_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.WERKZ_BROWSER_EVIDENCE,'hotel-real-qwen-guest.png'),fullPage:true});await page.getByRole('button',{name:'Hotelbetrieb',exact:true}).click();await page.getByRole('button',{name:/Zimmer gesamt/}).click();await page.screenshot({path:path.join(process.env.WERKZ_BROWSER_EVIDENCE,'hotel-management-dashboard.png'),fullPage:true});}
  await page.getByRole('button',{name:'Hotelbetrieb',exact:true}).click();await page.getByRole('button',{name:'Rezeption',exact:true}).click();
  const booking=page.locator('article.business-row').filter({has:page.getByRole('heading',{name:new RegExp('Browsergast Klar')})});
  await booking.locator('summary').click();await booking.locator('input[name="persons"]').fill('1');
  const saveResponse=page.waitForResponse(r=>r.url().endsWith('/reservations/'+reservation.id)&&r.request().method()==='PATCH');
  await booking.getByRole('button',{name:'Änderungen prüfen & speichern',exact:true}).click();assert.equal((await saveResponse).status(),200);
  await page.waitForFunction(()=>{const row=[...document.querySelectorAll('article.business-row')].find(r=>r.querySelector('h3')?.textContent.includes('Browsergast Klar'));return row?.querySelector('details')?.open===false;});
  await booking.locator('summary').click();page.once('dialog',d=>d.accept());
  const cancelResponse=page.waitForResponse(r=>r.url().endsWith('/reservations/'+reservation.id+'/cancel'));
  await booking.getByRole('button',{name:'Reservierung stornieren',exact:true}).click();assert.equal((await cancelResponse).status(),200);
  await page.reload();await page.getByRole('button',{name:'Rezeption',exact:true}).click();
  const finalSnapshot=await (await context.request.get(base+'/api/hotel/snapshot')).json();assert.equal(finalSnapshot.reservations.find(r=>r.id===reservation.id).state,'cancelled');
  assert.deepEqual(errors,[]);
  console.log('PASS hotel UI + real Qwen: database metrics/filter, inline guest, available room, persisted reservation, actual model guest readback, browser edit/cancel/reload and responsive layouts.');
}finally{if(browser)await browser.close();server.kill();}
