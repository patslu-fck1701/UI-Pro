'use strict';
/** Cryptographic compatibility gates for WERKZ-BRIDGE-1.
 * Synthetic keys and requests only. Never contacts Lovable, Render or a model.
 * Intentionally tests the real Windows worker signer, not a reimplementation.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {OutboundAI, identityFromKey, signedRequest, validJob} = require('../scripts/outbound-ai.js');

function device() {
  const pair = crypto.generateKeyPairSync('ed25519');
  return identityFromKey(pair.privateKey);
}

function signaturePayload(request, path) {
  const h = request.headers;
  return [
    'WERKZ-BRIDGE-1', 'POST', path,
    h['x-werkz-timestamp'], h['x-werkz-nonce'],
    crypto.createHash('sha256').update(request.body, 'utf8').digest('hex'),
  ].join('\n');
}

function verifyRequest(request, path, publicKey) {
  return crypto.verify(null, Buffer.from(signaturePayload(request, path)),
    publicKey, Buffer.from(request.headers['x-werkz-signature'], 'base64'));
}

const CLAIM = '/api/public/local-ai/claim';
const COMPLETE = '/api/public/local-ai/complete';

test('worker identity matches SHA256 of SPKI public key, without exposing private key', () => {
  const identity = device();
  const spki = Buffer.from(identity.public_key, 'base64');
  assert.match(identity.device_id, /^[a-f0-9]{64}$/);
  assert.equal(identity.device_id, crypto.createHash('sha256').update(spki).digest('hex'));
  assert.equal(Object.keys(JSON.parse(JSON.stringify({
    device_id: identity.device_id, public_key: identity.public_key,
  }))).length, 2);
});

test('claim signature authenticates the exact UTF-8 request body and route', () => {
  const identity = device();
  const when = Date.parse('2026-10-31T15:00:00.000Z');
  const req = signedRequest(identity, CLAIM, {device_id: identity.device_id}, when);
  const pub = crypto.createPublicKey(identity.privateKey);
  assert.equal(req.method, 'POST');
  assert.equal(req.redirect, 'manual');
  assert.equal(req.headers['content-type'], 'application/json');
  assert.equal(req.headers['x-werkz-device'], identity.device_id);
  assert.equal(req.headers['x-werkz-timestamp'], String(when / 1000));
  assert.match(req.headers['x-werkz-nonce'], /^[0-9a-f]{32}$/);
  assert.equal(verifyRequest(req, CLAIM, pub), true);
  assert.equal(verifyRequest(req, COMPLETE, pub), false);
  assert.equal(verifyRequest({...req, body:req.body+' '}, CLAIM, pub), false);
  assert.equal(verifyRequest({
    ...req,
    headers: {...req.headers, 'x-werkz-timestamp': '1'},
  }, CLAIM, pub), false);
  assert.equal(verifyRequest(req, CLAIM, crypto.createPublicKey(device().privateKey)), false);
});

test('every signed request has unique 128-bit nonce and bounded JSON body', () => {
  const identity = device();
  const now = Date.now();
  const seen = new Set();
  for (let i = 0; i < 32; i++) {
    const req = signedRequest(identity, CLAIM, {device_id:identity.device_id}, now);
    assert.equal(Buffer.byteLength(req.body), Buffer.byteLength(JSON.stringify({
      device_id:identity.device_id,
    })));
    assert(!seen.has(req.headers['x-werkz-nonce']));
    seen.add(req.headers['x-werkz-nonce']);
  }
  assert.equal(seen.size, 32);
  assert.throws(() => signedRequest(identity, '/api/public/local-ai/ask', {}),
    /ROUTE_DENIED/);
  assert.throws(() => signedRequest(identity, CLAIM, {payload:'x'.repeat(17000)}),
    /REQUEST_TOO_LARGE/);
});

test('worker rejects expired, future, malformed and oversized synthetic leased jobs', () => {
  const now = Date.now();
  const job = {
    request_id:crypto.randomUUID(), lease_id:crypto.randomUUID(),
    prompt:'Synthetic question only', expires_at:new Date(now+30000).toISOString(),
  };
  assert.equal(validJob(job,now), true);
  assert.equal(validJob({...job, expires_at:new Date(now-1).toISOString()},now), false);
  assert.equal(validJob({...job, expires_at:new Date(now+121000).toISOString()},now), false);
  assert.equal(validJob({...job, lease_id:'not-a-uuid'},now), false);
  assert.equal(validJob({...job, prompt:'x'.repeat(4001)},now), false);
  assert.equal(validJob({...job, prompt:' '},now), false);
});

test('signed claim → local answer → leased complete runs exactly once', async () => {
  const identity = device();
  const publicKey = crypto.createPublicKey(identity.privateKey);
  const now = Date.parse('2026-10-31T15:00:00.000Z');
  const job = {
    request_id: crypto.randomUUID(),
    lease_id: crypto.randomUUID(),
    prompt: 'Synthetic request only',
    expires_at: new Date(now + 30000).toISOString(),
  };
  let inferCount = 0;
  let claims = 0;
  let completions = 0;
  const nonces = new Set();
  const transport = async (url, request) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app');
    assert.equal(verifyRequest(request, parsed.pathname, publicKey), true);
    assert.equal(request.redirect, 'manual');
    const nonce = request.headers['x-werkz-nonce'];
    assert(!nonces.has(nonce), 'Fresh nonce is required on every request');
    nonces.add(nonce);
    const body = JSON.parse(request.body);
    assert.equal(body.device_id, identity.device_id);
    let payload;
    if (parsed.pathname === CLAIM) {
      claims++;
      payload = {state:'ready', job};
    } else if (parsed.pathname === COMPLETE) {
      completions++;
      assert.equal(body.request_id, job.request_id);
      assert.equal(body.lease_id, job.lease_id);
      assert.equal(body.state, 'succeeded');
      assert.equal(body.answer, 'SYNTHETIC ANSWER');
      assert.equal(body.model, 'Synthetic-Qwen.gguf');
      payload = {ok:true};
    } else {
      throw new Error('UNEXPECTED_ROUTE');
    }
    return new Response(JSON.stringify(payload), {
      status:200,
      headers:{'content-type':'application/json'},
    });
  };
  const worker = new OutboundAI({
    identity, transport, clock:()=>now,
    analyze:async (input) => {
      inferCount++;
      assert.equal(input.prompt, 'Synthetic request only');
      return {answer:'SYNTHETIC ANSWER', model:'Synthetic-Qwen.gguf'};
    },
  });
  assert.deepEqual(await worker.once(), {state:'succeeded', request_id:job.request_id});
  assert.equal(inferCount, 1);
  assert.equal(completions, 1);
  assert.equal(claims, 1);
  await assert.rejects(worker.once(), /DUPLICATE_JOB/);
  assert.equal(inferCount, 1, 'The same leased job must not run twice');
  assert.equal(completions, 1, 'The same leased job must not complete twice');
});

test('failed local inference still completes with redacted fixed error code', async () => {
  const identity = device();
  const now = Date.parse('2026-10-31T15:00:00.000Z');
  const job = {
    request_id: crypto.randomUUID(),
    lease_id: crypto.randomUUID(),
    prompt:'SYNTHETIC',
    expires_at:new Date(now+30000).toISOString(),
  };
  let completion = null;
  const transport = async (url, req) => {
    const path = new URL(url).pathname;
    let body;
    if (path === CLAIM) body = {state:'ready',job};
    else if (path === COMPLETE) {
      completion = JSON.parse(req.body);
      body = {ok:true};
    } else throw new Error('UNEXPECTED_ROUTE');
    return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  };
  const worker = new OutboundAI({
    identity,clock:()=>now,transport,
    analyze:async () => {throw new Error('PRIVATE_OPERATOR_PATH_CANNOT_LEAK');},
  });
  const result = await worker.once();
  assert.equal(result.state,'failed');
  assert.equal(completion.error_code,'MODEL_UNAVAILABLE');
  assert.equal(completion.answer,undefined);
  assert(!JSON.stringify(completion).includes('PRIVATE_OPERATOR_PATH_CANNOT_LEAK'));
});

test('pending/revoked worker state never invokes local inference or complete', async () => {
  for (const state of ['pending', 'revoked']) {
    const identity = device();
    let inferCount = 0;
    let requestCount = 0;
    const transport = async (url, req) => {
      requestCount++;
      assert.equal(new URL(url).pathname, CLAIM);
      assert.equal(req.method,'POST');
      return new Response(JSON.stringify({state, job:null}), {
        status:200, headers:{'content-type':'application/json'},
      });
    };
    const worker = new OutboundAI({
      identity,transport,analyze:async () => {
        inferCount++;
        throw new Error('UNEXPECTED_INFERENCE');
      },
    });
    assert.deepEqual(await worker.once(),{state});
    assert.equal(inferCount,0);
    assert.equal(requestCount,1);
  }
});

test('expired or malformed leased job never reaches local inference', async () => {
  const invalid = [
    {request_id:crypto.randomUUID(), lease_id:crypto.randomUUID(),
     prompt:'Synthetic',expires_at:new Date(Date.now()-5000).toISOString()},
    {request_id:crypto.randomUUID(),lease_id:crypto.randomUUID(),
     prompt:'Synthetic',expires_at:new Date(Date.now()+200000).toISOString()},
    {request_id:crypto.randomUUID(),lease_id:'wrong',
     prompt:'Synthetic',expires_at:new Date(Date.now()+30000).toISOString()},
  ];
  for (const job of invalid) {
    const worker = new OutboundAI({
      identity:device(), transport:async () =>
        new Response(JSON.stringify({state:'ready',job}), {
          status:200,headers:{'content-type':'application/json'},
        }),
      analyze:async () => {throw new Error('INFERENCE_MUST_NOT_RUN');},
    });
    await assert.rejects(worker.once(), /INVALID_JOB/);
  }
});

test('non-JSON and oversized transport replies fail closed before inference', async () => {
  const identity=device();
  let analyzed=0;
  for (const response of [
    new Response('<html>blocked</html>',{status:200,headers:{'content-type':'text/html'}}),
    new Response(JSON.stringify({state:'ready',job:null}), {
      status:200,headers:{'content-type':'application/json'},
    }),
  ]) {
    const worker=new OutboundAI({
      identity,
      transport:async () => response.clone(),
      analyze:async () => {analyzed++;return {answer:'should not execute',model:'test'};},
    });
    if(response.headers.get('content-type')==='text/html')
      await assert.rejects(worker.once(), /INVALID_BRIDGE_RESPONSE/);
    else assert.deepEqual(await worker.once(),{state:'idle'});
  }
  assert.equal(analyzed,0);
});
