'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {createWhatsAppWebhook,PATH}=require('../src/integrations/providers/whatsapp-webhook');
function response(){return {status:null,headers:null,body:'',writeHead(status,headers){this.status=status;this.headers=headers},setHeader(){},end(value=''){this.body=String(value)}}}
function req(method,body='',headers={}){const value=Readable.from([Buffer.from(body)]);value.method=method;value.headers=headers;return value}
function url(q=''){return new URL('https://test.example'+PATH+q)}
test('missing credentials fails closed',async()=>{const res=response();assert.equal(await createWhatsAppWebhook({verifyToken:'',appSecret:''})(req('GET'),res,url('?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123')),true);assert.equal(res.status,503)});
test('challenge requires exact token and mode',async()=>{const handler=createWhatsAppWebhook({verifyToken:'one-token',appSecret:'secret'}),ok=response();await handler(req('GET'),ok,url('?hub.mode=subscribe&hub.verify_token=one-token&hub.challenge=12345'));assert.equal(ok.status,200);assert.equal(ok.body,'12345');for(const q of ['?hub.mode=bad&hub.verify_token=one-token&hub.challenge=12345','?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345']){const bad=response();await handler(req('GET'),bad,url(q));assert.equal(bad.status,403)}});
test('POST rejects invalid signature and accepts signed event',async()=>{let seen=0;const handler=createWhatsAppWebhook({verifyToken:'token',appSecret:'secret',onEvent:async()=>{seen++}}),body=JSON.stringify({object:'whatsapp_business_account',entry:[]});const bad=response();await handler(req('POST',body,{'x-hub-signature-256':'sha256=bad'}),bad,url());assert.equal(bad.status,403);assert.equal(seen,0);const signature='sha256='+crypto.createHmac('sha256','secret').update(body).digest('hex'),ok=response();await handler(req('POST',body,{'x-hub-signature-256':signature}),ok,url());assert.equal(ok.status,200);assert.equal(seen,1)});
test('invalid signed JSON fails',async()=>{const body='{',sig='sha256='+crypto.createHmac('sha256','secret').update(body).digest('hex'),res=response();await createWhatsAppWebhook({verifyToken:'token',appSecret:'secret'})(req('POST',body,{'x-hub-signature-256':sig}),res,url());assert.equal(res.status,400)});
