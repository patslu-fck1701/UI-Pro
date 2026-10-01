'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {FileTimeRepository,FilePrivateEvidenceStorage}=require('./durable');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(root){
  const result=[];
  const walk=(dir,prefix='')=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const relative=path.posix.join(prefix,item.name),absolute=path.join(dir,item.name);
    if(item.isDirectory())walk(absolute,relative);
    else if(item.isFile()&&relative!=='backup-manifest.json')result.push({path:relative,sha256:'sha256:'+hash(absolute),bytes:fs.statSync(absolute).size});
  }};walk(root);return result.sort((a,b)=>a.path.localeCompare(b.path));
}
function validate(root){
  const time=new FileTimeRepository(path.join(root,'time.json')),evidence=new FilePrivateEvidenceStorage(path.join(root,'evidence'));
  if(!time.integrity()||!evidence.integrity())throw new Error('Time/evidence integrity failed');
  for(const item of Object.values(evidence.state.objects)){
    if(!time.get(item.organisationId,item.timeRecordId))throw new Error('Orphaned or cross-tenant evidence: '+item.id);
  }
  return {records:Object.keys(time.state.records).length,evidence:Object.keys(evidence.state.objects).length};
}
function backupTimeData({sourceRoot,targetRoot}){
  const source=path.resolve(sourceRoot),target=path.resolve(targetRoot);
  if(target===source||target.startsWith(source+path.sep)||source.startsWith(target+path.sep))throw new Error('Backup target must be separate');
  if(fs.existsSync(target))throw new Error('Backup target already exists');
  const count=validate(source);
  fs.cpSync(source,target,{recursive:true,errorOnExist:true,force:false});
  const manifest={schemaVersion:1,createdAt:new Date().toISOString(),files:files(target),count};
  fs.writeFileSync(path.join(target,'backup-manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  return manifest;
}
function verifyTimeBackup(backupRoot){
  const root=path.resolve(backupRoot),manifest=JSON.parse(fs.readFileSync(path.join(root,'backup-manifest.json'),'utf8'));
  if(manifest.schemaVersion!==1)throw new Error('Unsupported backup schema');
  const actual=files(root);
  if(JSON.stringify(actual)!==JSON.stringify(manifest.files))throw new Error('Backup digest/contents mismatch');
  const count=validate(root);
  if(JSON.stringify(count)!==JSON.stringify(manifest.count))throw new Error('Backup count mismatch');
  return manifest;
}
function restoreTimeData({backupRoot,targetRoot}){
  const backup=path.resolve(backupRoot),target=path.resolve(targetRoot);
  if(backup===target||backup.startsWith(target+path.sep)||target.startsWith(backup+path.sep))throw new Error('Restore target must be separate');
  verifyTimeBackup(backup);
  if(!fs.existsSync(target))throw new Error('Existing dedicated Time data root required');
  const parent=path.dirname(target),name=path.basename(target);
  const stage=path.join(parent,'.'+name+'.restore-'+crypto.randomUUID());
  const prior=path.join(parent,'.'+name+'.prior-'+crypto.randomUUID());
  try{
    fs.cpSync(backup,stage,{recursive:true});
    fs.rmSync(path.join(stage,'backup-manifest.json'));
    validate(stage);
    fs.renameSync(target,prior);
    try{fs.renameSync(stage,target)}catch(error){fs.renameSync(prior,target);throw error}
    return {restored:true,priorRoot:prior};
  }catch(error){
    if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});
    throw error;
  }
}
module.exports={backupTimeData,verifyTimeBackup,restoreTimeData};
