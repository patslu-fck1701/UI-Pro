"""Cross-language Ed25519 protocol proof for existing Windows outbound worker.

Runs real Node signer and Python cryptography verifier with random synthetic
keys only. No API call, database, Render access or real device credential.
"""
import base64
import hashlib
import json
from pathlib import Path
import subprocess

import pytest
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization

ROOT = Path(__file__).resolve().parents[1]
BRIDGE_VERSION = "WERKZ-BRIDGE-1"


@pytest.mark.parametrize("path,payload", [
    ("/api/public/local-ai/pair", "pair"),
    ("/api/public/local-ai/claim", "claim"),
    ("/api/public/local-ai/complete", "complete"),
])
def test_actual_node_worker_signature_verifies_in_python(path, payload):
    # Node returns only disposable public key + signed synthetic body.
    javascript = r"""
const crypto=require('node:crypto');
const {identityFromKey,signedRequest}=require('./scripts/outbound-ai.js');
const key=crypto.generateKeyPairSync('ed25519').privateKey;
const identity=identityFromKey(key);
const pathname=process.argv[1];
const action=process.argv[2];
const data=action==='pair'
  ? {device_id:identity.device_id,public_key:identity.public_key,label:'WERKZ local Qwen'}
  : action==='claim'
  ? {device_id:identity.device_id}
  : {device_id:identity.device_id,request_id:crypto.randomUUID(),
     lease_id:crypto.randomUUID(),state:'succeeded',
     answer:'SYNTHETIC REPLY',model:'test.gguf'};
const signed=signedRequest(identity,pathname,data,Date.parse('2026-10-31T15:00:00.000Z'));
process.stdout.write(JSON.stringify({
  public_key:identity.public_key,device_id:identity.device_id,
  path:pathname,body:signed.body,headers:signed.headers,
}));
"""
    result = subprocess.run(
        ["node", "-e", javascript, path, payload],
        cwd=ROOT, capture_output=True, text=True, timeout=15, check=True,
    )
    data = json.loads(result.stdout)
    body = data["body"]
    headers = data["headers"]
    spki = base64.b64decode(data["public_key"], validate=True)
    assert hashlib.sha256(spki).hexdigest() == data["device_id"]
    assert headers["x-werkz-device"] == data["device_id"]
    assert len(bytes.fromhex(headers["x-werkz-nonce"])) == 16
    assert headers["x-werkz-timestamp"] == "1793458800"
    signature = base64.b64decode(headers["x-werkz-signature"], validate=True)
    assert len(signature) == 64
    signed_text = "\n".join([
        BRIDGE_VERSION, "POST", path,
        headers["x-werkz-timestamp"],
        headers["x-werkz-nonce"],
        hashlib.sha256(body.encode("utf-8")).hexdigest(),
    ]).encode("utf-8")
    public_key = serialization.load_der_public_key(spki)
    public_key.verify(signature, signed_text)

    # Path and bytes are covered, not just a parsed JSON object.
    with pytest.raises(InvalidSignature):
        public_key.verify(signature, signed_text + b" ")
    changed_path = signed_text.replace(path.encode(), b"/api/public/local-ai/other")
    with pytest.raises(InvalidSignature):
        public_key.verify(signature, changed_path)
    changed_body = body + " "
    changed_message = "\n".join([
        BRIDGE_VERSION, "POST", path,
        headers["x-werkz-timestamp"], headers["x-werkz-nonce"],
        hashlib.sha256(changed_body.encode()).hexdigest(),
    ]).encode()
    with pytest.raises(InvalidSignature):
        public_key.verify(signature, changed_message)


def test_node_worker_refuses_unsigned_ask_route():
    code = """
const crypto=require('node:crypto');
const {identityFromKey,signedRequest}=require('./scripts/outbound-ai.js');
const id=identityFromKey(crypto.generateKeyPairSync('ed25519').privateKey);
try{signedRequest(id,'/api/public/local-ai/ask',{});process.exit(1);}
catch(error){if(error.message!=='ROUTE_DENIED')process.exit(2);}
"""
    result = subprocess.run(["node", "-e", code], cwd=ROOT,
                            capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr
