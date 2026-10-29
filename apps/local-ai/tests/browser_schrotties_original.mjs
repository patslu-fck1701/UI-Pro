import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {startSandbox}=require('../../../tools/schrotties-original-sandbox.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-original-browser-'));
const host=await startSandbox({dataDir:dir});
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
  const external=[],errors=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===host.origin)return route.continue();external.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>{errors.push('Unexpected native dialog: '+dialog.type());void dialog.dismiss();});
  await page.goto(host.origin+'/pilot/');await page.getByRole('button',{name:'SYNTHETISCH A · Betreiber',exact:true}).click();
  await page.locator('#pickupMaterial').selectOption('grade-3');
  for(const [id,value] of [['pickupWeight','1000'],['pickupKm','10'],['pickupPay','150']])await page.locator('#'+id).fill(value);
  await page.locator('#pickupCalc').click();await page.locator('#pickupResult').getByText('260,00 €',{exact:true}).waitFor();
  await page.locator('#pickupTakeoverBtn').click();await page.locator('#pickupOrderLocation').fill('SYNTHETISCH · Browserziel');await page.locator('#pickupOrderName').fill('SYNTHETISCH · Browserprüfung');
  await page.locator('#pickupOrderSave').click();await page.locator('#pickupOrderSave').getByText('AUFTRAG GESPEICHERT',{exact:true}).waitFor();
  await page.getByRole('button',{name:'✓ AUFTRAG ERLEDIGT',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Abholung abschließen'});await dialog.getByRole('button',{name:'Abbrechen',exact:true}).click();
  await page.getByRole('button',{name:'✓ AUFTRAG ERLEDIGT',exact:true}).click();
  await dialog.getByLabel('Gewicht in kg',{exact:true}).fill('1000');await dialog.getByLabel('Material in Fahrzeugladung übernehmen',{exact:true}).check();
  await dialog.getByRole('button',{name:'Abschluss bestätigen',exact:true}).click();
  await page.getByRole('button',{name:'✓ AUFTRAG ERLEDIGT',exact:true}).waitFor({state:'hidden'});
  await page.reload();await page.locator('#pickupMaterial option[value="grade-3"]').waitFor({state:'attached'});
  const response=await context.request.get(host.origin+'/pilot/api/calls');const calls=await response.json();assert.equal(calls.length,1);assert.equal(calls[0].status,'erledigt');
  const cash=await (await context.request.get(host.origin+'/pilot/api/cash')).json();assert.equal(cash.length,0,'Planned payout must not become an actual payment');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow at '+width);}
  if(process.env.WERKZ_BROWSER_EVIDENCE){fs.mkdirSync(process.env.WERKZ_BROWSER_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.WERKZ_BROWSER_EVIDENCE,'schrotties-original-completed.png'),fullPage:true});}
  await page.getByRole('link',{name:'Abmelden',exact:true}).click();await page.getByRole('button',{name:'SYNTHETISCH B · Betreiber',exact:true}).click();
  assert.equal((await (await context.request.get(host.origin+'/pilot/api/calls')).json()).length,0,'Second tenant has no first-tenant orders');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS original UI: login, calculator, order, cancel/confirm completion, persisted reload, no payment from draft, tenant switch, 390/768/1440, zero external requests.');
}finally{
  if(browser)await browser.close();await host.close();
  assert.ok(dir.startsWith(path.resolve(os.tmpdir())+path.sep+'werkz-original-browser-'));fs.rmSync(dir,{recursive:true,force:true});
}
