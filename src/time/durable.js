'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {TimeRepositoryPort,EvidenceStoragePort,RevisionConflictError}=require('./production');
const clone=value=>structuredClone(value);

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}
function readJson(file,fallback){if(!fs.existsSync(file))return clone(fallback);return JSON.parse(fs.readFileSync(file,'utf8'));}
function atomicJson(file,value){
  ensureDir(path.dirname(file));
  const temp=file+'.tmp-'+process.pid+'-'+crypto.randomUUID();
  fs.writeFileSync(temp,JSON.stringify(value,null,2),{encoding:'utf8',mode:0o600});
  fs.renameSync(temp,file);
}
function notFound(message){const error=new Error(message);error.code='NOT_FOUND';return error;}

class FileTimeRepository extends TimeRepositoryPort {
  constructor(file){
    super();this.file=path.resolve(file);
    this.state=readJson(this.file,{schemaVersion:1,records:{},idempotency:{}});
    if(this.state.schemaVersion!==1)throw new Error('Unsupported durable Time schema');
  }
  key(org,id){return org+':'+id}
  persist(){atomicJson(this.file,this.state)}
  create(record,idempotencyKey){
    const ik=this.key(record.organisationId,idempotencyKey);
    if(this.state.idempotency[ik])return clone(this.state.idempotency[ik]);
    const value={...clone(record),revision:1,corrections:[]};
    this.state.records[this.key(value.organisationId,value.id)]=value;
    this.state.idempotency[ik]=value;this.persist();return clone(value);
  }
  get(org,id){const value=this.state.records[this.key(org,id)];return value?clone(value):null}
  list(org){return Object.values(this.state.records).filter(x=>x.organisationId===org).map(clone)}
  update(org,id,{expectedRevision,apply,idempotencyKey}){
    const ik=this.key(org,idempotencyKey);
    if(this.state.idempotency[ik])return clone(this.state.idempotency[ik]);
    const key=this.key(org,id),current=this.state.records[key];
    if(!current)throw notFound('Time record not found');
    if(current.revision!==expectedRevision)throw new RevisionConflictError(id,expectedRevision,current.revision);
    const next=apply(clone(current));next.revision=current.revision+1;
    this.state.records[key]=next;this.state.idempotency[ik]=next;this.persist();return clone(next);
  }
  backup(targetFile){fs.copyFileSync(this.file,path.resolve(targetFile));return path.resolve(targetFile)}
  integrity(){const reload=readJson(this.file,null);return Boolean(reload&&reload.schemaVersion===1&&reload.records&&reload.idempotency)}
}

class FilePrivateEvidenceStorage extends EvidenceStoragePort {
  constructor(root){
    super();this.root=path.resolve(root);this.objectsDir=path.join(this.root,'objects');this.indexFile=path.join(this.root,'index.json');
    ensureDir(this.objectsDir);this.state=readJson(this.indexFile,{schemaVersion:1,objects:{},idempotency:{}});
    if(this.state.schemaVersion!==1)throw new Error('Unsupported evidence schema');
  }
  key(org,id){return org+':'+id}
  persist(){atomicJson(this.indexFile,this.state)}
  putPrivate({organisationId,ownerId,timeRecordId,mime,bytes,hash,idempotencyKey}){
    const ik=this.key(organisationId,idempotencyKey);
    if(this.state.idempotency[ik])return clone(this.state.idempotency[ik]);
    if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    const expected=String(hash||'').replace(/^sha256:/,'');
    if(expected&&expected!==digest){const error=new Error('Evidence hash mismatch');error.code='HASH_MISMATCH';throw error;}
    const id='file_'+crypto.randomUUID(),objectName=digest+'-'+id+'.bin',objectPath=path.join(this.objectsDir,objectName);
    fs.writeFileSync(objectPath,bytes,{mode:0o600,flag:'wx'});
    const metadata={id,organisationId,ownerId,timeRecordId,mime,size:bytes.length,hash:'sha256:'+digest,objectKey:'objects/'+objectName,visibility:'private'};
    this.state.objects[this.key(organisationId,id)]=metadata;this.state.idempotency[ik]=metadata;this.persist();return clone(metadata);
  }
  listPrivate(org,timeRecordId){return Object.values(this.state.objects).filter(x=>x.organisationId===org&&x.timeRecordId===timeRecordId).map(clone)}
  getPrivate(org,id){
    const metadata=this.state.objects[this.key(org,id)];if(!metadata)throw notFound('Evidence not found');
    const objectPath=path.resolve(this.root,metadata.objectKey);
    if(!objectPath.startsWith(this.root+path.sep))throw new Error('Unsafe evidence path');
    const bytes=fs.readFileSync(objectPath),digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if('sha256:'+digest!==metadata.hash||bytes.length!==metadata.size){const error=new Error('Stored evidence integrity failure');error.code='INTEGRITY_ERROR';throw error;}
    return {metadata:clone(metadata),bytes};
  }
  integrity(){for(const value of Object.values(this.state.objects))this.getPrivate(value.organisationId,value.id);return true}
}

module.exports={FileTimeRepository,FilePrivateEvidenceStorage};
