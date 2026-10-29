import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Inference responses are explicitly simulated to test UI recovery without model dependency.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.WERKZ_TEST_RUNNING==='1'?'http://127.0.0.1:8001':'http://127.0.0.1:8132';
const server=process.env.WERKZ_TEST_RUNNING==='1'?null:spawn(path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port','8132','--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_PACKAGE:'hotel-demo',WERKZ_AI_MODE:'demo',WERKZ_AI_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'werkz-chat-recovery-'))},stdio:'ignore'});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/setup')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.getByRole('button',{name:/Hoteldemo mit fertigen Profilen starten/}).click();
 await page.getByRole('button',{name:'Chat',exact:true}).click();
 let attempt=0;
 await page.route('**/api/chats/*/stream',async route=>{
  attempt++;
  if(attempt===1)return route.fulfill({status:413,contentType:'application/json',body:JSON.stringify({detail:'SYNTHETISCH: Eingabe zu lang.'})});
  if(attempt===2)return route.fulfill({status:200,contentType:'text/event-stream',body:'data: '+JSON.stringify({type:'token',content:'Teilantwort'})+'\n\n'});
  await route.fulfill({status:200,contentType:'text/event-stream',body:[{type:'start',context:{reduced:true}},{type:'token',content:'Synthetisch wieder bereit.'},{type:'done',status:'complete'}].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')});
 });
 const input=page.getByLabel('Deine Nachricht',{exact:true}),send=()=>page.getByRole('button',{name:'Senden ↗',exact:true});
 await input.fill('SYNTHETISCH: erste Frage');await send().click();
 await page.getByRole('alert').filter({hasText:'Eingabe zu lang'}).waitFor();
 assert.equal(await input.inputValue(),'SYNTHETISCH: erste Frage');
 assert.equal(await page.locator('.message').count(),0);await send().waitFor();
 await input.fill('SYNTHETISCH: Verbindungsabbruch');await send().click();
 await page.getByRole('alert').filter({hasText:'Antwortverbindung unterbrochen'}).waitFor();
 await page.locator('.message.assistant').filter({hasText:'angehalten'}).waitFor();
 await input.fill('SYNTHETISCH: Folgefrage');await send().click();
 await page.locator('.message.assistant').filter({hasText:'Synthetisch wieder bereit.'}).waitFor();
 await send().waitFor();await page.getByRole('status').filter({hasText:'Kontextauszug'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Antwort stoppen',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: HTTP rejection restores input; broken stream clears busy state; next question works; reduced-context notice visible (SIMULATED inference).');
}finally{await browser.close();server?.kill();}
