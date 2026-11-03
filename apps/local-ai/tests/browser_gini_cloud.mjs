import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:8143',data=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-cloud-browser-'));
const server=spawn(process.env.WERKZ_TEST_PYTHON||path.join(root,'.venv/Scripts/python.exe'),
 ['-m','uvicorn','tests.cloud_browser_host:app','--host','127.0.0.1','--port','8143','--no-access-log'],
 {cwd:root,env:{...process.env,WERKZ_SYNTHETIC_BROWSER:'1',WERKZ_AUTH_MODE:'oidc',WERKZ_AI_DATA:data,
 WERKZ_AI_PACKAGE:'hotel',WERKZ_AI_MODE:'production',WERKZ_ONLINE_TEST:'0',WERKZ_GINI_CLOUD_ENABLED:'0'},stdio:['ignore','pipe','pipe']});
let logs='',browser;server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/setup')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(ready,logs);
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 // Pre-provisioned synthetic OIDC sessions: no real identity-provider claim.
 await context.addCookies([{name:'werkz_hotel_program',value:'TEST_CUSTOMER_01',url:base,httpOnly:true,sameSite:'Strict'}]);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.getByRole('button',{name:'GINI und Dateien',exact:true}).click();
 assert.equal(await page.getByRole('navigation',{name:'Werkzeuge'}).count(),0);
 assert.equal(await page.getByText('Qwen3 verbunden',{exact:true}).count(),0);
 await page.locator('summary').filter({hasText:'GINI Cloud · Chat und sichere Textdateien'}).click();
 await page.getByText('Cloud-Sprachausgabe nicht verfügbar.',{exact:false}).waitFor();
 await page.getByLabel('Nachricht an GINI').fill('SYNTHETIC question');
 await page.getByRole('button',{name:'GINI fragen',exact:true}).click();
 await page.getByText('SYNTHETIC browser answer',{exact:true}).waitFor();
 await page.getByLabel('Synthetische Textdatei',{exact:true}).setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('SYNTHETIC original')});
 await page.getByRole('heading',{name:'synthetic.txt · Version 1',exact:true}).waitFor();
 await page.getByLabel('Bearbeitungsauftrag',{exact:true}).fill('SYNTHETIC edit request');
 await page.getByRole('button',{name:'Entwurf erstellen',exact:true}).click();
 await page.getByText('Änderungsvorschlag – noch nicht gespeichert',{exact:true}).waitFor();
 const save=page.getByRole('button',{name:'Bestätigten Entwurf speichern',exact:true});assert.equal(await save.isDisabled(),true);
 await page.getByLabel('Ich bestätige genau diesen Entwurf.',{exact:true}).check();await save.click();
 await page.getByRole('heading',{name:'synthetic.txt · Version 2',exact:true}).waitFor();
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Wiederherstellen',exact:true}).click();
 await page.getByRole('heading',{name:'synthetic.txt · Version 3',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'GINI und Dateien',exact:true}).click();await page.locator('summary').filter({hasText:'GINI Cloud · Chat und sichere Textdateien'}).click();
 await page.getByRole('button',{name:'synthetic.txt · v3',exact:true}).click();
 await page.getByRole('heading',{name:'synthetic.txt · Version 3',exact:true}).waitFor();
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
   offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1)
    .slice(0,8).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,80),right:el.getBoundingClientRect().right}))}));
  assert.ok(geometry.scroll<=geometry.width,'horizontal overflow '+width+' '+JSON.stringify(geometry));
 }
 const other=await browser.newContext();await other.addCookies([{name:'werkz_hotel_program',value:'TEST_CUSTOMER_02',url:base,httpOnly:true,sameSite:'Strict'}]);
 assert.deepEqual(await (await other.request.get(base+'/api/gini/v1/documents')).json(),[]);
 const docs=await (await context.request.get(base+'/api/gini/v1/documents')).json();
 assert.equal((await other.request.get(base+'/api/gini/v1/documents/'+docs[0].document_id)).status(),404);
 const otherPage=await other.newPage();await otherPage.goto(base);
 await otherPage.getByRole('button',{name:'GINI und Dateien',exact:true}).click();
 assert.equal(await otherPage.getByRole('button',{name:'Testkunden',exact:true}).count(),0);
 assert.equal(await otherPage.getByRole('button',{name:'Kosten und Kontingente',exact:true}).count(),0);
 assert.equal((await other.request.get(base+'/api/auth/owner/quotas')).status(),403);
 for(const old of ['/berater/','/hub/','/demo/','/pilot/'])assert.equal((await other.request.get(base+old)).status(),410);
 const owner=await browser.newContext();await owner.addCookies([{name:'werkz_hotel_program',value:'owner',url:base,httpOnly:true,sameSite:'Strict'}]);
 const ownerPage=await owner.newPage();await ownerPage.goto(base);await ownerPage.getByRole('button',{name:'Testkunden',exact:true}).click();
 await ownerPage.locator('summary').filter({hasText:'Owner · Testkunden verwalten'}).click();
 await ownerPage.getByRole('button',{name:'Einmaligen Einladungscode erstellen',exact:true}).waitFor();
 await ownerPage.getByRole('button',{name:'Kosten und Kontingente',exact:true}).click();
 for(const title of ['OpenAI API','ElevenLabs V10','Codex','Claude und Claude Code'])await ownerPage.getByRole('heading',{name:title,exact:true}).waitFor();
 await ownerPage.getByRole('button',{name:'600 Ausgabetokens simulieren',exact:true}).click();
 await ownerPage.getByText('SCHÄTZUNG: 0.000400 USD Listenpreisäquivalent. Kein Geld freigegeben oder ausgegeben.',{exact:true}).waitFor();
 const codex=ownerPage.locator('article.panel').filter({has:ownerPage.getByRole('heading',{name:'Codex',exact:true})});
 await codex.getByText('Datierten Stand manuell erfassen',{exact:true}).click();
 await codex.getByLabel('Kennzahl',{exact:true}).selectOption('week');
 await codex.getByLabel('Verfügbar',{exact:true}).fill('33');
 await codex.getByRole('button',{name:'Manuellen Stand speichern',exact:true}).click();
 await codex.getByText('33.0 % verbleibend',{exact:true}).waitFor();
 for(const width of [390,768,1440]){await ownerPage.setViewportSize({width,height:1000});await ownerPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Owner dashboard overflow '+width);}
 await page.getByRole('button',{name:'Abmelden',exact:true}).click();await page.getByRole('heading',{name:'WerkZ Digital',exact:true}).waitFor();
 assert.equal((await context.request.get(base+'/api/gini/v1/documents')).status(),401);
 assert.deepEqual(errors,[]);
 console.log('PASS synthetic browser: seeded OIDC sessions, cloud chat, upload/diff/approval/versions/restore/reload, two tenants, logout, 390/768/1440; provider and audio NOT live');
}finally{await browser?.close();server.kill();}
