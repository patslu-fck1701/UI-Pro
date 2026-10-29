import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='http://127.0.0.1:8131';
const server=spawn(path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port','8131','--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_PACKAGE:'hotel-demo',WERKZ_AI_MODE:'demo',WERKZ_AI_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'werkz-guest-e2e-'))},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/setup')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,channel:'msedge'});const staffContext=await browser.newContext(),guestContext=await browser.newContext({viewport:{width:390,height:900}}),staff=await staffContext.newPage(),guest=await guestContext.newPage(),errors=[];
 for(const p of [staff,guest]){p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());}
 const role=async value=>{await staff.getByLabel('Vorführprofil',{exact:true}).selectOption(value);await staff.waitForFunction(value=>document.querySelector('.sidebar-bottom')?.textContent.includes('hotel_'+value),value);};
 await staff.goto(base);await staff.getByRole('button',{name:/Hoteldemo mit fertigen Profilen starten/}).click();await staff.getByLabel('Vorführprofil',{exact:true}).waitFor();await role('reception');await staff.getByRole('button',{name:'Rezeption',exact:true}).click();
 const stay=await staff.evaluate(async()=>{const s=await (await fetch('/api/hotel/snapshot')).json(),r=s.reservations.find(r=>r.state==='checked_in');return {...r,room:s.rooms.find(room=>room.id===r.room_id).number};});
 await staff.getByLabel(/Gast öffnen/).selectOption(stay.guest_id);await staff.getByRole('button',{name:'Gästeportal-Zugang ausgeben',exact:true}).click();await staff.locator('.portal-code').waitFor();const code=await staff.locator('.portal-code').innerText();
 await guest.goto(base+'/?guestPortal=1&room='+stay.room);await guest.getByLabel('Zugangscode',{exact:true}).fill(code);await guest.getByRole('button',{name:'Gästezugang öffnen',exact:true}).click();await guest.getByRole('heading',{name:'Service für deinen Aufenthalt',exact:true}).waitFor();
 const item=await guest.evaluate(async()=>{const s=await (await fetch('/api/guest/overview')).json();return s.menu.find(m=>m.category==='food');});
 await guest.locator('.guest-menu button').filter({has:guest.getByText(item.name,{exact:true})}).click();await guest.getByLabel('Menge',{exact:true}).fill('2');await guest.getByLabel('Sonderwunsch / gewünschte Uhrzeit',{exact:true}).fill('SYNTHETISCH ohne Ei');await guest.getByRole('checkbox').check();await guest.getByRole('button',{name:'Preis prüfen & Demoanfrage bestätigen',exact:true}).click();await guest.locator('.hotel-task').getByText('SYNTHETISCH ohne Ei',{exact:true}).waitFor();assert(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await role('kitchen');const order=staff.locator('.hotel-task').filter({hasText:'SYNTHETISCH ohne Ei'});await order.waitFor();
 const source=await staff.evaluate(async()=>await (await fetch('/api/hotel/guest-orders')).json());assert.equal(source.length,1);assert.equal(source[0].price_cents,2*item.price_cents);assert.equal(source[0].allergy,1);
 await role('reception');await staff.getByRole('button',{name:'Rezeption',exact:true}).click();await staff.locator('[data-room="'+stay.room+'"]').click();const checkout=staff.waitForResponse(r=>r.url().endsWith('/api/hotel/commands')&&r.request().method()==='POST');await staff.getByRole('button',{name:'Check-out',exact:true}).click();assert((await checkout).ok());
 await guest.getByRole('button',{name:'Status aktualisieren',exact:true}).click();await guest.getByRole('heading',{name:'Aufenthalt sicher zuordnen',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS guest browser: reception-issued temporary code, separate guest cookie context, mobile login, priced service request, preserved special/allergy fields, kitchen visibility and checkout revocation.');
}finally{await browser?.close();server.kill();}
