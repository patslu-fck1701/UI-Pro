'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GmailReadProvider,classifyGmailMessage}=require('../src/integrations/providers/gmail');

test('gmail provider stays read only and filters relevant mail',async()=>{
  const calls=[];
  const http=async req=>{
    calls.push(req);
    const u=new URL(req.url);
    if(u.pathname.endsWith('/messages'))return {status:200,body:{messages:[{id:'m1'},{id:'m2'}]}};
    if(u.pathname.endsWith('/m1'))return {status:200,body:{id:'m1',snippet:'Bitte um Rückruf wegen Metallabholung',labelIds:['INBOX'],payload:{headers:[{name:'From',value:'kunde@example.de'},{name:'Subject',value:'Schrott abholen'},{name:'Date',value:'Sat, 3 Oct 2026 08:00:00 +0200'}]}}};
    if(u.pathname.endsWith('/m2'))return {status:200,body:{id:'m2',snippet:'Unser Oktober Newsletter',labelIds:['INBOX'],payload:{headers:[{name:'From',value:'news@example.de'},{name:'Subject',value:'Newsletter'}]}}};
    throw new Error('unexpected '+req.url);
  };
  const provider=new GmailReadProvider({resolveAccess:()=> 'token',http,account:{organisationId:'org-a'},maxResults:10});
  const rows=await provider.listRelevant({organisationId:'org-a'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'m1');
  assert.equal(rows[0].category,'Kundenanfrage');
  assert.equal(rows[0].readOnly,true);
  assert.equal(calls.every(x=>x.method==='GET'),true);
  assert.equal(calls.every(x=>x.headers.authorization==='Bearer token'),true);
  assert.deepEqual(GmailReadProvider.oauthScopes,['https://www.googleapis.com/auth/gmail.readonly']);
});

test('gmail provider isolates organisation and classifies tax mail',async()=>{
  const provider=new GmailReadProvider({resolveAccess:()=> 'token',http:async()=>({status:200,body:{messages:[]}}),account:{organisationId:'org-a'}});
  await assert.rejects(()=>provider.listRelevant({organisationId:'org-b'}),e=>e.code==='FORBIDDEN');
  const c=classifyGmailMessage({snippet:'Bitte Belege senden',payload:{headers:[{name:'Subject',value:'Steuerberater Unterlagen'},{name:'From',value:'kanzlei@example.de'}]}});
  assert.equal(c.relevant,true);
  assert.equal(c.category,'Steuerberater');
});
