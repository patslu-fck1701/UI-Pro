import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{for(const [index,pkg] of ['handwerk-demo','hotel-demo','schrotties-demo'].entries()){
 const running=process.env.WERKZ_TEST_RUNNING==='1',port=(running?8000:8120)+index,base='http://127.0.0.1:'+port,data=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-industry-ui-'));
 const server=running?null:spawn(path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port',String(port),'--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_DATA:data,WERKZ_AI_PACKAGE:pkg,WERKZ_AI_MODE:'demo'},stdio:'ignore'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/api/setup')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  const health=await (await fetch(base+'/api/health')).json();assert.equal(health.package,pkg);assert.equal(health.mode,'demo');
  await page.goto(base);await page.getByRole('button',{name:/mit fertigen Profilen starten/}).click();
  try{await page.getByLabel('Vorführprofil',{exact:true}).waitFor({timeout:10000});}catch(error){await page.screenshot({path:path.join(root,'.runtime/'+pkg+'-entry-failure.png'),fullPage:true});console.log(pkg,await page.locator('main').innerText(),errors);throw error;}
  const manifest=await page.evaluate(async()=>{const r=await fetch('/manifest.webmanifest');return r.json();});assert(manifest.name);
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),pkg+' overflow '+width);}
  await page.screenshot({path:path.join(root,'.runtime/'+pkg+'-desktop.png'),fullPage:true});
  const role=pkg==='hotel-demo'?'housekeeping':pkg==='handwerk-demo'?'technician':'driver';
  await page.getByLabel('Vorführprofil',{exact:true}).selectOption(role);await page.waitForFunction(role=>document.querySelector('.sidebar-bottom')?.textContent.includes('_'+role),role);
  await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:'Angebote',exact:true}).count(),0);
  if(pkg==='hotel-demo')await page.getByRole('heading',{name:'Meine Reinigungen',exact:true}).waitFor();
  else {
   const order=page.locator('[data-order]').first();await order.waitFor();
   await order.getByRole('button',{name:pkg==='schrotties-demo'?'Abholung beginnen':'Auftrag starten',exact:true}).click();
   await order.getByText('In Arbeit',{exact:true}).waitFor();
   await order.getByRole('button',{name:'Auftrag öffnen',exact:true}).click();
   await order.getByLabel('Arbeitsbericht',{exact:true}).waitFor();
  }
  await page.setViewportSize({width:390,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(root,'.runtime/'+pkg+'-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS '+pkg+': synthetic profile entry, role switch, restricted field view, manifest and responsive desktop/tablet/mobile browser layouts.');
 }finally{await context.close();server?.kill();}
}}finally{await browser.close();}
