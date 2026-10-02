'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {ReleaseManifestSigner,ReleaseVerifier}=require('../src');
const [command,...args]=process.argv.slice(2);
function readJson(file){return JSON.parse(fs.readFileSync(path.resolve(file),'utf8'))}
function sha(bytes){return 'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex')}
function buildPayload(payloadFile,artifactDir){
  const payload=readJson(payloadFile);
  payload.artifacts=(payload.artifacts||[]).map(item=>{
    const name=path.basename(item.name);
    if(name!==item.name)throw new Error('Artifact name must be a basename');
    return {...item,sha256:sha(fs.readFileSync(path.join(path.resolve(artifactDir),name)))};
  });
  return payload;
}
function writeManifest({payload,privateKey,keyId,outputFile}){
  const manifest=new ReleaseManifestSigner({privateKey,keyId}).sign(payload);
  fs.writeFileSync(path.resolve(outputFile),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  process.stdout.write('Signed release manifest written\n');
}
function privateKeyFromEnvironment(){
  const pem=process.env.WERKZ_RELEASE_PRIVATE_KEY_PEM;
  const encoded=process.env.WERKZ_RELEASE_PRIVATE_KEY_B64;
  if(pem&&encoded)throw new Error('Set only one private-key environment secret');
  if(!pem&&!encoded)throw new Error('WERKZ_RELEASE_PRIVATE_KEY_PEM or WERKZ_RELEASE_PRIVATE_KEY_B64 is required');
  const value=pem||Buffer.from(encoded,'base64').toString('utf8');
  return crypto.createPrivateKey(value);
}
try{
  if(command==='sign'&&args.length>=5){
    const [payloadFile,artifactDir,privateKeyFile,keyId,outputFile]=args;
    writeManifest({
      payload:buildPayload(payloadFile,artifactDir),
      privateKey:crypto.createPrivateKey(fs.readFileSync(path.resolve(privateKeyFile),'utf8')),
      keyId,
      outputFile
    });
  }else if(command==='sign-env'&&args.length===4){
    const [payloadFile,artifactDir,keyId,outputFile]=args;
    writeManifest({payload:buildPayload(payloadFile,artifactDir),privateKey:privateKeyFromEnvironment(),keyId,outputFile});
  }else if(command==='verify'&&args.length===3){
    const [manifestFile,publicKeyFile,artifactDir]=args,manifest=readJson(manifestFile);
    const publicKey=crypto.createPublicKey(fs.readFileSync(path.resolve(publicKeyFile),'utf8'));
    const artifacts={};
    for(const item of manifest.payload.artifacts){
      const name=path.basename(item.name);if(name!==item.name)throw new Error('Artifact name must be a basename');
      artifacts[name]=fs.readFileSync(path.join(path.resolve(artifactDir),name));
    }
    new ReleaseVerifier({publicKeys:{[manifest.keyId]:publicKey}}).verifyRelease(manifest,artifacts);
    process.stdout.write('Release manifest and artifact digests verified\n');
  }else{
    process.stderr.write(
      'Usage: sign <payload.json> <artifact-dir> <private-key.pem> <key-id> <new-manifest.json> | '+
      'sign-env <payload.json> <artifact-dir> <key-id> <new-manifest.json> | '+
      'verify <manifest.json> <public-key.pem> <artifact-dir>\n'
    );
    process.exitCode=2;
  }
}catch(error){process.stderr.write('Release security error: '+error.message+'\n');process.exitCode=1}
