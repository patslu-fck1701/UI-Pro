'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {
  ResendOutboundMailProvider,
  WerkZSimplePilotService,
  MemoryPilotRepository,
  PilotDocumentStorage,
  FakeVoiceProvider,
  FakeMailProvider,
  FakeExtractor,
  StaticMarketProvider,
  StaticPortfolioProvider,
  StaticScrapPriceProvider
}=require('../src/pilot');

class Auth{
  resolveSession(token){
    if(token==='a')return {organisationId:'org-a',actorId:'owner-a',role:'owner',capabilities:['pilot.read','pilot.write']};
    throw Object.assign(new Error('bad session'),{code:'UNAUTHENTICATED'});
  }
}
class Ent{
  require(){return true}
  isActive(){return false}
}
function service({root,outbound}){
  const storage=new PilotDocumentStorage(root);
  return new WerkZSimplePilotService({
    auth:new Auth(),entitlements:new Ent(),repository:new MemoryPilotRepository(),storage,
    voice:new FakeVoiceProvider(),mail:new FakeMailProvider(),extractor:new FakeExtractor(),outbound,
    market:new StaticMarketProvider(),portfolio:new StaticPortfolioProvider(),
    scrapPrices:new StaticScrapPriceProvider({items:[]}),
    clock:()=>new Date('2026-10-06T12:00:00Z')
  });
}

test('Resend outbound provider sends tenant document bytes with checksum and idempotency',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-outbound-'));
  try{
    const storage=new PilotDocumentStorage(root);
    const bytes=Buffer.from('exact receipt bytes');
    const stored=storage.put({organisationId:'org-a',id:'doc-1',fileName:'beleg.pdf',mime:'application/pdf',bytes});
    let captured=null;
    const provider=new ResendOutboundMailProvider({
      apiKey:'test-key',
      from:'WerkZ <belege@example.test>',
      storage,
      fetchFn:async(url,options)=>{captured={url,options};return {ok:true,status:200,text:async()=>JSON.stringify({id:'mail-provider-1'})}}
    });
    const sent=await provider.send({
      organisationId:'org-a',to:'tax@example.test',subject:'Unterlagen 2026-10',text:'WerkZ Monatsübergabe',
      documents:[{id:'doc-1',storage:stored}],idempotencyKey:'werkz-export/org-a/export-1'
    });
    assert.equal(sent.accepted,true);
    assert.equal(sent.mode,'resend');
    assert.equal(sent.providerMessageId,'mail-provider-1');
    assert.equal(captured.url,'https://api.resend.com/emails');
    assert.equal(captured.options.headers.authorization,'Bearer test-key');
    assert.equal(captured.options.headers['idempotency-key'],'werkz-export/org-a/export-1');
    const body=JSON.parse(captured.options.body);
    assert.deepEqual(body.to,['tax@example.test']);
    assert.equal(body.attachments[0].filename,'beleg.pdf');
    assert.equal(body.attachments[0].content_type,'application/pdf');
    assert.equal(Buffer.from(body.attachments[0].content,'base64').toString(),'exact receipt bytes');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('Resend outbound provider rejects changed attachment bytes before network send',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-outbound-tamper-'));
  try{
    const storage=new PilotDocumentStorage(root);
    const stored=storage.put({organisationId:'org-a',id:'doc-1',fileName:'beleg.jpg',mime:'image/jpeg',bytes:Buffer.from('original')});
    fs.writeFileSync(path.join(root,stored.objectKey),'changed');
    let calls=0;
    const provider=new ResendOutboundMailProvider({apiKey:'test-key',from:'a@example.test',storage,fetchFn:async()=>{calls++;return {ok:true,text:async()=>JSON.stringify({id:'x'})}}});
    await assert.rejects(()=>provider.send({organisationId:'org-a',to:'tax@example.test',subject:'x',documents:[{id:'doc-1',storage:stored}]}),error=>error.code==='STATE_INVALID');
    assert.equal(calls,0);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('Resend outbound provider fails closed on provider rejection',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-outbound-reject-'));
  try{
    const storage=new PilotDocumentStorage(root);
    const provider=new ResendOutboundMailProvider({apiKey:'test-key',from:'a@example.test',storage,fetchFn:async()=>({ok:false,status:429,text:async()=>JSON.stringify({message:'rate limited'})})});
    await assert.rejects(()=>provider.send({organisationId:'org-a',to:'tax@example.test',subject:'x',documents:[]}),error=>error.code==='PROVIDER_UNAVAILABLE');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('confirmed export handoff is locally idempotent and never calls outbound twice',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'werkz-outbound-service-'));
  try{
    const outbound={calls:0,last:null,async send(input){this.calls++;this.last=input;return {mode:'resend',accepted:true,to:input.to,subject:input.subject,attachmentCount:input.documents.length,providerMessageId:'mail-1'}}};
    const s=service({root,outbound});
    await s.addDocument('a',{fileName:'beleg.jpg',mime:'image/jpeg',dataBase64:Buffer.from('receipt').toString('base64'),receiptCategory:'werkzeug'});
    const prepared=s.prepareExport('a','2026-10');
    const first=await s.sendExport('a',{exportId:prepared.id,confirm:true,to:'tax@example.test'});
    const replay=await s.sendExport('a',{exportId:prepared.id,confirm:true,to:'tax@example.test'});
    assert.equal(outbound.calls,1);
    assert.equal(outbound.last.idempotencyKey,'werkz-export/org-a/'+prepared.id);
    assert.equal(first.archive.providerMessageId,'mail-1');
    assert.equal(replay.replayed,true);
    assert.equal(replay.archive.id,first.archive.id);
    assert.equal(replay.delivery.replayed,true);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
