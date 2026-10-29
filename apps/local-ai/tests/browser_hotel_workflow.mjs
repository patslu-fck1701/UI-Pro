import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base='http://127.0.0.1:8130';
const server=spawn(path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port','8130','--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_PACKAGE:'hotel-demo',WERKZ_AI_MODE:'demo',WERKZ_AI_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'werkz-hotel-e2e-'))},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/setup')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 const role=async value=>{await page.getByLabel('Vorführprofil',{exact:true}).selectOption(value);await page.waitForFunction(value=>document.querySelector('.sidebar-bottom')?.textContent.includes('hotel_'+value),value);await page.getByLabel('Vorführprofil',{exact:true}).waitFor();};
 const room=()=>page.locator('[data-room="101"]'),task=()=>page.locator('[data-task-room="101"]');
 const operation=async(action)=>{const response=page.waitForResponse(r=>r.url().endsWith('/api/hotel/commands')&&r.request().method()==='POST');await action();const result=await response;assert(result.ok(),await result.text());};
 await page.goto(base);await page.getByRole('button',{name:/Hoteldemo mit fertigen Profilen starten/}).click();await page.getByLabel('Vorführprofil',{exact:true}).waitFor();
 await role('reception');await page.getByRole('button',{name:'Rezeption',exact:true}).click();await room().click();await operation(()=>page.getByRole('button',{name:'Check-out',exact:true}).click());await room().getByText('Reinigung offen',{exact:true}).waitFor();
 await role('housekeeping_lead');await page.getByRole('button',{name:'Housekeeping & Hausdame',exact:true}).click();await room().click();
 const employee=await page.evaluate(async()=>{const s=await (await fetch('/api/hotel/snapshot')).json();return s.employees.find(e=>e.qualification==='cleaning').id;});
 await task().getByLabel('Reinigungskraft',{exact:true}).selectOption(employee);await operation(()=>task().locator('form').filter({has:page.getByRole('heading',{name:'Aufgabe zuweisen',exact:true})}).getByRole('button',{name:'Speichern',exact:true}).click());
 await role('housekeeping');await task().waitFor();await operation(()=>task().getByRole('button',{name:'Reinigung beginnen',exact:true}).click());
 for(const name of ['Bad geprüft','Bett / Wäsche geprüft','Ausstattung ergänzt'])await task().getByLabel(name,{exact:true}).check();
 await operation(()=>task().getByRole('button',{name:'Checkliste speichern',exact:true}).click());
 await task().locator('summary').filter({hasText:'Defekt melden'}).click();await task().getByLabel('Beschreibung',{exact:true}).first().fill('SYNTHETISCH · Dusche Browserprüfung');await task().getByLabel('Sperrrelevanter Defekt',{exact:true}).check();
 await operation(()=>task().locator('form').filter({has:page.getByRole('heading',{name:'Defekt melden',exact:true})}).getByRole('button',{name:'Speichern',exact:true}).click());await room().getByText('Gesperrt',{exact:true}).waitFor();
 await operation(()=>task().getByRole('button',{name:'Reinigung abschließen',exact:true}).click());
 await role('maintenance');await page.getByRole('button',{name:'Haustechnik',exact:true}).click();await room().click();
 const ticket=page.locator('.hotel-task').filter({has:page.getByRole('heading',{name:'SYNTHETISCH · Dusche Browserprüfung · Zimmer 101',exact:true})});
 await ticket.getByLabel('Reparaturbericht',{exact:true}).fill('SYNTHETISCH · Repariert und geprüft.');await ticket.getByLabel('Reparatur geprüft und tatsächlich ausgeführt',{exact:true}).check();await operation(()=>ticket.getByRole('button',{name:'Reparatur abschließen',exact:true}).click());await room().getByText('Gesperrt',{exact:true}).waitFor();
 await role('housekeeping_lead');await page.getByRole('button',{name:'Housekeeping & Hausdame',exact:true}).click();await room().click();await operation(()=>task().getByRole('button',{name:'Kontrolle bestanden & freigeben',exact:true}).click());await room().getByText('Freigegeben',{exact:true}).waitFor();
 await role('reception');await room().getByText('Freigegeben',{exact:true}).waitFor();await role('management');assert.equal(await page.locator('.hotel-metrics article').filter({hasText:'Belegt'}).locator('strong').innerText(),'3');
 await page.getByRole('button',{name:'Meinen Hotel-Assistenten fragen',exact:true}).click();await page.getByLabel('Deine Nachricht',{exact:true}).fill('Welchen Status hat Zimmer 101? Antworte kurz mit Zimmernummer und aktuellem Status.');await page.getByRole('button',{name:'Senden ↗',exact:true}).click();
 await page.waitForFunction(()=>{const answer=document.querySelector('.message.assistant');return answer&&answer.textContent.includes('101')&&answer.textContent.toLowerCase().includes('frei')&&!answer.textContent.includes('antwortet');},{},{timeout:120000});
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(root,'.runtime/hotel-complete-workflow.png'),fullPage:true});
 console.log('PASS Hotel browser E2E: checkout, assignment, checklist, defect, block, repair, inspection, release, reception, management count and real Qwen answer after workflow.');
}finally{await browser?.close();server.kill();}
