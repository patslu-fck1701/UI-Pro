import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='http://127.0.0.1:8135';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-program-browser-'));
const server=spawn(process.env.WERKZ_TEST_PYTHON||path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port','8135','--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_DATA:data,WERKZ_AI_PACKAGE:'hotel',WERKZ_AI_MODE:'production'},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',value=>serverLog+=value);server.stderr.on('data',value=>serverLog+=value);
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/setup')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,serverLog);
 browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],denied=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',response=>{if(response.status()===403)denied.push(new URL(response.url()).pathname+new URL(response.url()).search);});
 await page.goto(base);assert.equal(await page.getByRole('button',{name:/mit fertigen Profilen starten/}).count(),0);
 const login={username:'synthetic_owner',password:'synthetic-only-test'};
 assert.equal((await context.request.post(base+'/api/setup',{headers:{origin:base},data:login})).status(),201);
 assert.equal((await context.request.post(base+'/api/login',{headers:{origin:base},data:login})).status(),200);
 await page.reload();await page.getByRole('button',{name:'Hotel-Einstellungen',exact:true}).click();
 const category=page.locator('form').filter({has:page.getByRole('heading',{name:'Zimmerkategorie anlegen',exact:true})});
 await category.getByLabel('Bezeichnung',{exact:true}).fill('SYNTHETISCH Browserkategorie');
 await category.getByLabel('Preis pro Nacht in Cent',{exact:true}).fill('9900');
 await category.getByRole('button',{name:'Speichern',exact:true}).click();
 const room=page.locator('form').filter({has:page.getByRole('heading',{name:'Zimmer anlegen',exact:true})});
 await room.getByLabel('Zimmernummer',{exact:true}).fill('SYN-101');
 await room.getByLabel('Zimmerkategorie',{exact:true}).selectOption({label:'SYNTHETISCH Browserkategorie'});
 await room.getByRole('button',{name:'Speichern',exact:true}).click();
 await page.reload();
 const snapshot=await (await context.request.get(base+'/api/hotel/snapshot')).json();
 assert.equal(snapshot.metrics.rooms,1);assert.equal(snapshot.guests.length,0);assert.equal(snapshot.fictional,false);
 assert.equal(await page.getByRole('button',{name:'Telefon-Simulation',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Nur diese Hoteldemo zurücksetzen',exact:true}).count(),0);
 await page.getByRole('button',{name:'Module & Benutzer',exact:true}).click();
 await page.getByRole('heading',{name:'Verbindungen & freigegebenes Wissen',exact:true}).waitFor();
 const users=page.locator('form').filter({has:page.getByRole('button',{name:'Benutzer im selben Mandanten anlegen',exact:true})});
 await users.getByLabel('Benutzername',{exact:true}).fill('synthetic_ui_reception');
 await users.getByLabel('Passwort / PIN',{exact:true}).fill('synthetic-only-test');
 await users.locator('select[name="role"]').selectOption('hotel_reception');
 await users.getByRole('button',{name:'Benutzer im selben Mandanten anlegen',exact:true}).click();
 await page.getByRole('combobox',{name:'Rolle für synthetic_ui_reception',exact:true}).waitFor();
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('combobox',{name:'Rolle für synthetic_ui_reception',exact:true}).selectOption('reader');
 await page.waitForFunction(()=>document.body.innerText.includes('core.user.role.changed:hotel_reception>reader'));
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Kein horizontaler Ueberlauf bei '+width);
 }
 await page.screenshot({path:path.join(data,'hotel-program-1440.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(denied,[],'Hotel startup must not request disabled workspaces');assert.equal(await page.getByText('Dieses Modul ist deaktiviert oder die Freigabe ist abgelaufen.',{exact:true}).count(),0);console.log('Hotel PROGRAM UI: owner session, no denied workspace requests, no demo controls, create category/room, persist PASS');
}finally{await browser?.close();server.kill();}
