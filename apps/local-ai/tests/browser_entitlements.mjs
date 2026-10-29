import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:8134';
const data=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-entitlement-ui-'));
const server=spawn(process.env.WERKZ_TEST_PYTHON||path.join(root,'.venv/Scripts/python.exe'),['-m','uvicorn','backend.app:app','--host','127.0.0.1','--port','8134','--no-access-log'],{cwd:root,env:{...process.env,WERKZ_AI_DATA:data,WERKZ_AI_PACKAGE:'hotel-demo',WERKZ_AI_MODE:'demo'},stdio:'ignore'});
let browser;
try{
  let ready=false;for(let n=0;n<50;n++){try{if((await fetch(base+'/api/setup')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const payload={username:'synthetic_browser',password:'synthetic-test-only'};
  assert.equal((await context.request.post(base+'/api/setup',{headers:{origin:base},data:payload})).status(),201);
  assert.equal((await context.request.post(base+'/api/login',{headers:{origin:base},data:payload})).status(),200);
  await page.goto(base);await page.getByRole('button',{name:'Module & Benutzer',exact:true}).click();
  const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Modulfreigaben · Hotel zuerst'})});
  try{await form.waitFor({state:'visible',timeout:8000});}catch(error){throw Error('Module UI missing: '+(await page.locator('body').innerText()).slice(-1800)+' pageErrors='+errors.join(';'),{cause:error});}
  await form.getByLabel('Freigabe',{exact:true}).selectOption('suspended');
  await form.getByRole('button',{name:'Freigabe speichern',exact:true}).click();
  await form.getByRole('status').filter({hasText:'Freigabe gespeichert.'}).waitFor();
  assert.equal((await (await context.request.get(base+'/api/modules')).json()).modules.hotel_ai,false);
  await form.getByLabel('Freigabe',{exact:true}).selectOption('trial');
  await form.getByLabel('Gültig bis (lokale Zeit, optional)',{exact:true}).fill('2099-01-01T12:00');
  await form.getByRole('button',{name:'Freigabe speichern',exact:true}).click();
  await form.getByRole('status').filter({hasText:'Freigabe gespeichert.'}).waitFor();
  assert.equal((await (await context.request.get(base+'/api/modules')).json()).modules.hotel_ai,true);
  await page.reload();await page.getByRole('button',{name:'Module & Benutzer',exact:true}).click();
  const configuration=await (await context.request.get(base+'/api/admin/modules')).json();
  assert.equal(configuration.entitlements.hotel_ai.status,'trial');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  assert.deepEqual(errors,[]);
  console.log('Hotel entitlement browser: persist, revoke, grant, responsive 390/768/1440 PASS');
}finally{await browser?.close();server.kill();}
