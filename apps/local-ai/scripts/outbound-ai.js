'use strict';
// Outbound-only operator bridge. Never opens a listening socket or executes remote commands.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const ORIGIN='https://project--9081192e-6239-40a6-8f20-02296cff5c91-dev.lovable.app';
const ROUTES=new Set(['/api/public/local-ai/pair','/api/public/local-ai/claim','/api/public/local-ai/complete']);
function identityFromKey(privateKey){
  const publicBytes=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'});
  return {privateKey,public_key:publicBytes.toString('base64'),device_id:crypto.createHash('sha256').update(publicBytes).digest('hex')};
}
function loadIdentity(root){
  const folder=path.join(root,'.runtime','outbound-ai'),file=path.join(folder,'identity.dpapi');
  fs.mkdirSync(folder,{recursive:true});
  const python=path.join(root,'.venv','Scripts','python.exe');
  function protect(bytes,action){
    const result=spawnSync(python,['-c',`import sys;from backend.windows_protection import ${action};sys.stdout.buffer.write(${action}(sys.stdin.buffer.read()))`],{cwd:root,input:bytes,windowsHide:true,timeout:10000,maxBuffer:16384});
    if(result.error||result.status!==0)throw new Error('DEVICE_KEY_UNAVAILABLE');
    return result.stdout;
  }
  let privateKey;
  if(fs.existsSync(file))privateKey=crypto.createPrivateKey(protect(fs.readFileSync(file),'unprotect'));
  else{
    privateKey=crypto.generateKeyPairSync('ed25519').privateKey;
    fs.writeFileSync(file,protect(privateKey.export({type:'pkcs8',format:'pem'}),'protect'),{flag:'wx'});
  }
  const identity=identityFromKey(privateKey);
  fs.writeFileSync(path.join(folder,'device-public.json'),JSON.stringify({device_id:identity.device_id,public_key:identity.public_key}));
  return identity;
}
function signedRequest(identity,route,input,now=Date.now()){
  if(!ROUTES.has(route))throw new Error('ROUTE_DENIED');
  const body=JSON.stringify(input);
  if(Buffer.byteLength(body)>16384)throw new Error('REQUEST_TOO_LARGE');
  const timestamp=String(Math.floor(now/1000)),nonce=crypto.randomBytes(16).toString('hex');
  const digest=crypto.createHash('sha256').update(body).digest('hex');
  const signed=['WERKZ-BRIDGE-1','POST',route,timestamp,nonce,digest].join('\n');
  return {method:'POST',redirect:'manual',body,headers:{'content-type':'application/json','x-werkz-device':identity.device_id,'x-werkz-timestamp':timestamp,'x-werkz-nonce':nonce,'x-werkz-signature':crypto.sign(null,Buffer.from(signed),identity.privateKey).toString('base64')}};
}
function validJob(job,now=Date.now()){
  if(!job||typeof job!=='object'||Array.isArray(job))return false;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!uuid.test(job.request_id)||!uuid.test(job.lease_id)||typeof job.prompt!=='string'||!job.prompt.trim()||job.prompt.length>4000)return false;
  const expires=Date.parse(job.expires_at);
  return Number.isFinite(expires)&&expires>now&&expires<=now+120000;
}
class OutboundAI {
  constructor({identity,transport=fetch,analyze,origin=ORIGIN,clock=Date.now}){
    if(origin!==ORIGIN)throw new Error('ORIGIN_DENIED');
    this.identity=identity;this.transport=transport;this.analyze=analyze;this.clock=clock;this.seen=new Set();
  }
  async post(route,input){
    const response=await this.transport(ORIGIN+route,{...signedRequest(this.identity,route,input,this.clock()),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(response.status===429?'RATE_LIMITED':'BRIDGE_UNAVAILABLE');
    if(!String(response.headers.get('content-type')).includes('application/json'))throw new Error('INVALID_BRIDGE_RESPONSE');
    const reader=response.body.getReader();let chunks=[],bytes=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>32768)throw new Error('INVALID_BRIDGE_RESPONSE');chunks.push(value);}}
    finally{await reader.cancel();}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('INVALID_BRIDGE_RESPONSE');}
  }
  pair(){return this.post('/api/public/local-ai/pair',{device_id:this.identity.device_id,public_key:this.identity.public_key,label:'WERKZ local Qwen'});}
  async once(){
    const claimed=await this.post('/api/public/local-ai/claim',{device_id:this.identity.device_id});
    if(!['pending','revoked','ready'].includes(claimed.state))throw new Error('INVALID_BRIDGE_RESPONSE');
    if(claimed.state!=='ready')return {state:claimed.state};
    if(!claimed.job)return {state:'idle'};
    const job=claimed.job;
    if(!validJob(job,this.clock()))throw new Error('INVALID_JOB');
    if(this.seen.has(job.request_id))throw new Error('DUPLICATE_JOB');
    this.seen.add(job.request_id);if(this.seen.size>1000)this.seen.delete(this.seen.values().next().value);
    let result;
    try{
      const answer=await this.analyze(job);
      if(!answer||typeof answer.answer!=='string'||!answer.answer.trim()||answer.answer.length>8000||typeof answer.model!=='string'||!answer.model||answer.model.length>200)throw new Error('MODEL_UNAVAILABLE');
      result={state:'succeeded',answer:answer.answer,model:answer.model};
    }catch(error){result={state:'failed',error_code:error.message==='MODEL_TIMEOUT'?'MODEL_TIMEOUT':'MODEL_UNAVAILABLE'};}
    if(Date.parse(job.expires_at)<=this.clock())return {state:'expired'};
    await this.post('/api/public/local-ai/complete',{device_id:this.identity.device_id,request_id:job.request_id,lease_id:job.lease_id,...result});
    return {state:result.state,request_id:job.request_id};
  }
}
function analyzer(root){return async job=>{
  const python=path.join(root,'.venv','Scripts','python.exe');
  const result=spawnSync(python,[path.join(root,'scripts','bridge-analyze.py')],{cwd:root,input:JSON.stringify(job),encoding:'utf8',windowsHide:true,timeout:25000,maxBuffer:32768});
  if(result.error?.code==='ETIMEDOUT')throw new Error('MODEL_TIMEOUT');
  if(result.error||result.status!==0)throw new Error('MODEL_UNAVAILABLE');
  let output;try{output=JSON.parse(result.stdout);}catch{throw new Error('MODEL_UNAVAILABLE');}
  if(output.error_code)throw new Error(output.error_code);return output;
};}
async function main(){
  const action=process.argv[2],root=path.resolve(__dirname,'..');
  if(!['status','pair','once','run'].includes(action))throw new Error('USE_STATUS_PAIR_ONCE_OR_RUN');
  const identity=loadIdentity(root),client=new OutboundAI({identity,analyze:analyzer(root)});
  if(action==='status'){console.log(JSON.stringify({device_id:identity.device_id,origin:ORIGIN,state:'NOT_VERIFIED'}));return;}
  if(action==='pair'){const result=await client.pair();console.log(JSON.stringify({state:result.state,device_id:identity.device_id}));return;}
  if(action==='once'){console.log(JSON.stringify(await client.once()));return;}
  // Exclusive per-installation worker. Do not kill any preexisting process to acquire it.
  const lock=path.join(root,'.runtime','outbound-ai','worker.lock');
  if(fs.existsSync(lock)){
    const previous=Number(fs.readFileSync(lock,'utf8'));
    if(!Number.isInteger(previous)||previous<1)throw new Error('DEVICE_KEY_UNAVAILABLE');
    let alive=true;try{process.kill(previous,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
    if(alive)return;
    fs.unlinkSync(lock);
  }
  const fd=fs.openSync(lock,'wx');fs.writeSync(fd,String(process.pid));
  try{
    let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
    let failures=0;
    const statusFile=path.join(root,'.runtime','outbound-ai','worker-status.json');
    while(!stopping){
      let result;
      try{result=await client.once();failures=0;}catch{failures++;result={state:'offline'};}
      fs.writeFileSync(statusFile,JSON.stringify({...result,checked_at:new Date().toISOString()}));
      if(['pending','revoked'].includes(result.state))break;
      await new Promise(resolve=>setTimeout(resolve,failures?Math.min(60000,15000*failures):result.state==='idle'?15000:3000));
    }
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(require.main===module)main().catch(error=>{console.error(JSON.stringify({state:'BLOCKED',code:['DEVICE_KEY_UNAVAILABLE','RATE_LIMITED','ORIGIN_DENIED','INVALID_JOB','DUPLICATE_JOB','INVALID_BRIDGE_RESPONSE'].includes(error.message)?error.message:'BRIDGE_UNAVAILABLE'}));process.exitCode=1;});
module.exports={OutboundAI,identityFromKey,signedRequest,validJob};
