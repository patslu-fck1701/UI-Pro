'use strict';
/** Cryptographic compatibility gates for WERKZ-BRIDGE-1.
 * Synthetic keys and requests only. Never contacts Lovable, Render or a model.
 * Intentionally tests the real Windows worker signer, not a reimplementation.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {identityFromKey, signedRequest, validJob} = require('../scripts/outbound-ai.js');

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
