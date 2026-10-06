'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function inside(root,target){
  const rel=path.relative(root,target);
  return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));
}

function writeProbe(dataDir){
  const token=crypto.randomBytes(10).toString('hex');
  const first=path.join(dataDir,'.werkz-storage-probe-'+process.pid+'-'+token);
  const second=first+'.ok';
  let fd=null;
  try{
    fs.mkdirSync(dataDir,{recursive:true});
    fd=fs.openSync(first,'wx',0o600);
    const body=Buffer.from('werkz-storage-probe:'+token,'utf8');
    fs.writeFileSync(fd,body);
    fs.fsyncSync(fd);
    fs.closeSync(fd);fd=null;
    fs.renameSync(first,second);
    const read=fs.readFileSync(second);
    if(!read.equals(body))throw new Error('storage probe readback mismatch');
    fs.rmSync(second,{force:true});
    return {passed:true,error:null};
  }catch(error){
    if(fd!==null)try{fs.closeSync(fd)}catch{}
    try{fs.rmSync(first,{force:true})}catch{}
    try{fs.rmSync(second,{force:true})}catch{}
    return {passed:false,error:String(error&&error.code||error&&error.message||'storage-probe-failed').slice(0,120)};
  }
}

function inspectPilotStorage({dataDir,persistentRoot='',requirePersistent=false}={}){
  const resolvedData=path.resolve(String(dataDir||''));
  const rawRoot=String(persistentRoot||'').trim();
  const root=rawRoot?path.resolve(rawRoot):null;
  const rootExists=Boolean(root&&fs.existsSync(root)&&fs.statSync(root).isDirectory());
  const pathWithinDeclaredRoot=Boolean(root&&rootExists&&inside(root,resolvedData));
  let probe={passed:false,error:'persistent-root-missing'};
  if(!root||rootExists)probe=writeProbe(resolvedData);
  const declaredPersistent=Boolean(root&&rootExists&&pathWithinDeclaredRoot);
  const ready=Boolean(probe.passed&&(!requirePersistent||declaredPersistent));
  let reason=null;
  if(requirePersistent&&!root)reason='persistent-root-not-configured';
  else if(root&&!rootExists)reason='persistent-root-missing';
  else if(root&&!pathWithinDeclaredRoot)reason='data-dir-outside-persistent-root';
  else if(!probe.passed)reason='storage-write-probe-failed';
  return {
    ready,
    requirePersistent:Boolean(requirePersistent),
    declaredPersistent,
    persistentRootConfigured:Boolean(root),
    persistentRootExists:rootExists,
    pathWithinDeclaredRoot,
    writeProbePassed:probe.passed,
    error:reason||probe.error||null,
    externalRestartProofRequired:true
  };
}

function assertPilotStorageReady(options={}){
  const result=inspectPilotStorage(options);
  if(!result.ready){
    const error=new Error('Pilot storage readiness failed: '+(result.error||'not-ready'));
    error.code='PILOT_STORAGE_NOT_READY';
    error.details=result;
    throw error;
  }
  return result;
}

module.exports={inside,inspectPilotStorage,assertPilotStorageReady};
