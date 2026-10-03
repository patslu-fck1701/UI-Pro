'use strict';

const crypto=require('node:crypto');
const clone=value=>structuredClone(value);
const uid=prefix=>prefix+'_'+crypto.randomUUID();

class AuthPort { resolveSession(_) { throw new Error('AuthPort.resolveSession must be implemented'); } }
class TimeRepositoryPort {
  create(_) { throw new Error('TimeRepositoryPort.create must be implemented'); }
  get(_,__) { throw new Error('TimeRepositoryPort.get must be implemented'); }
  list(_) { throw new Error('TimeRepositoryPort.list must be implemented'); }
  update(_,__,___) { throw new Error('TimeRepositoryPort.update must be implemented'); }
}
class EvidenceStoragePort {
  putPrivate(_) { throw new Error('EvidenceStoragePort.putPrivate must be implemented'); }
  listPrivate(_,__) { throw new Error('EvidenceStoragePort.listPrivate must be implemented'); }
  getPrivate(_,__) { throw new Error('EvidenceStoragePort.getPrivate must be implemented'); }
}

class LocalAuthPort extends AuthPort {
  constructor(sessions={}){super();this.sessions=new Map(Object.entries(sessions));}
  resolveSession(token){
    const session=this.sessions.get(token);
    if(!session) { const error=new Error('Invalid session');error.code='UNAUTHENTICATED';throw error; }
    return clone(session);
  }
}

class RevisionConflictError extends Error {
  constructor(entityId,expected,actual){super('Revision conflict');this.code='REVISION_CONFLICT';this.entityId=entityId;this.expected=expected;this.actual=actual;}
}

class InMemoryTenantTimeRepository extends TimeRepositoryPort {
  constructor(){super();this.records=new Map();this.idempotency=new Map();}
  key(org,id){return org+':'+id}
  create(record,idempotencyKey){
    const ik=this.key(record.organisationId,idempotencyKey);
    if(this.idempotency.has(ik)) return clone(this.idempotency.get(ik));
    const recordKey=this.key(record.organisationId,record.id);
    if(this.records.has(recordKey)){const error=new Error('Time record id already exists');error.code='ID_CONFLICT';throw error;}
    const value={...clone(record),revision:1,corrections:[]};
    this.records.set(recordKey,value);
    this.idempotency.set(ik,value);
    return clone(value);
  }
  get(organisationId,id){
    const value=this.records.get(this.key(organisationId,id));
    return value?clone(value):null;
  }
  list(organisationId){
    return [...this.records.values()].filter(x=>x.organisationId===organisationId).map(value=>clone(value));
  }
  update(organisationId,id,{expectedRevision,apply,idempotencyKey}){
    const ik=this.key(organisationId,idempotencyKey);
    if(this.idempotency.has(ik)) return clone(this.idempotency.get(ik));
    const key=this.key(organisationId,id),current=this.records.get(key);
    if(!current){const error=new Error('Time record not found');error.code='NOT_FOUND';throw error;}
    if(current.revision!==expectedRevision) throw new RevisionConflictError(id,expectedRevision,current.revision);
    const next=apply(clone(current));
    next.revision=current.revision+1;
    this.records.set(key,next);this.idempotency.set(ik,next);
    return clone(next);
  }
}

class InMemoryPrivateEvidenceStorage extends EvidenceStoragePort {
  constructor(){super();this.objects=new Map();this.bytes=new Map();this.idempotency=new Map();}
  key(org,id){return org+':'+id}
  putPrivate({organisationId,ownerId,timeRecordId,mime,size,hash,objectKey,bytes,idempotencyKey}){
    const ik=this.key(organisationId,idempotencyKey);
    if(this.idempotency.has(ik))return clone(this.idempotency.get(ik));
    const body=Buffer.from(bytes||[]);
    const metadata={id:uid('file'),organisationId,ownerId,timeRecordId,mime,size:size??body.length,hash,objectKey,visibility:'private'};
    const key=this.key(organisationId,metadata.id);
    this.objects.set(key,metadata);this.bytes.set(key,body);this.idempotency.set(ik,metadata);
    return clone(metadata);
  }
  listPrivate(organisationId,timeRecordId){
    return [...this.objects.values()].filter(x=>x.organisationId===organisationId&&x.timeRecordId===timeRecordId).map(value=>clone(value));
  }
  getPrivate(organisationId,id){
    const key=this.key(organisationId,id),value=this.objects.get(key);
    if(!value){const error=new Error('Evidence not found');error.code='NOT_FOUND';throw error;}
    return {metadata:clone(value),bytes:Buffer.from(this.bytes.get(key)||[])};
  }
}

class OfflineCommandQueue {
  constructor(){this.entries=[];this.completed=new Map();}
  enqueue(command){
    if(!command.id||!command.idempotencyKey||!command.organisationId||!command.actorId||!command.createdAtLocal) throw new Error('Invalid offline command');
    const existing=this.entries.find(x=>x.idempotencyKey===command.idempotencyKey);
    if(existing)return clone(existing);
    const entry={...clone(command),status:'queued',attempts:0,lastError:null};
    this.entries.push(entry);return clone(entry);
  }
  async sync(processor){
    for(const entry of this.entries.filter(x=>x.status==='queued'||x.status==='failed')){
      if(this.completed.has(entry.idempotencyKey)){entry.status='synced';continue;}
      entry.attempts++;
      try{
        const result=await processor(clone(entry));
        this.completed.set(entry.idempotencyKey,clone(result));entry.status='synced';entry.result=clone(result);entry.lastError=null;
      }catch(error){
        entry.status=error.code==='REVISION_CONFLICT'?'conflict':'failed';
        entry.lastError={code:error.code||'ERROR',message:error.message,expected:error.expected,actual:error.actual};
      }
    }
    return this.snapshot();
  }
  snapshot(){return clone(this.entries)}
}

class TimeProductionService {
  constructor({auth,repository,storage,entitlements,clock=()=>new Date(),id=uid,audit=()=>{}}){
    this.auth=auth;this.repository=repository;this.storage=storage;this.entitlements=entitlements;this.clock=clock;this.id=id;this.audit=audit;
  }
  session(token,capability){
    const session=this.auth.resolveSession(token);
    this.entitlements.require(session.organisationId,'werkz.time');
    if(!session.capabilities.includes(capability)){const error=new Error('Missing capability: '+capability);error.code='FORBIDDEN';throw error;}
    return session;
  }
  readSession(token){
    const session=this.auth.resolveSession(token);
    this.entitlements.require(session.organisationId,'werkz.time');
    if(!session.capabilities.includes('time.start')&&!session.capabilities.includes('time.read.all')){
      const error=new Error('Missing Time read capability');error.code='FORBIDDEN';throw error;
    }
    return session;
  }
  mayRead(session,record){
    return session.capabilities.includes('time.read.all')||record.actorId===session.actorId;
  }
  event(session,eventType,entityId,idempotencyKey,payload={}){
    this.audit({
      organisationId:session.organisationId,actorId:session.actorId,entityType:'time-record',
      entityId,eventType,summary:eventType,idempotencyKey,source:'werkz.time',payload:clone(payload)
    });
  }
  conflict(session,error,operation,idempotencyKey){
    this.event(session,'time.conflict',error.entityId,idempotencyKey,{operation,expectedRevision:error.expected,actualRevision:error.actual});
  }
  start(token,input){
    const s=this.session(token,'time.start');
    const record={
      id:input.id||this.id('time'),organisationId:s.organisationId,actorId:s.actorId,
      actorLabel:String(s.actorLabel||s.displayName||s.actorId).trim().slice(0,160),
      orderId:input.orderId||null,customerLabel:input.customerLabel||null,
      startedAt:input.startedAt||this.clock().toISOString(),endedAt:null,
      mileageStart:input.mileageStart??null,mileageEnd:null,note:input.note||'',status:'running'
    };
    const result=this.repository.create(record,input.idempotencyKey);
    this.event(s,'time.started',result.id,input.idempotencyKey,{orderId:result.orderId});
    return result;
  }
  stop(token,input){
    const s=this.session(token,'time.stop');
    try{
      const result=this.repository.update(s.organisationId,input.id,{expectedRevision:input.expectedRevision,idempotencyKey:input.idempotencyKey,apply:record=>{
        record.endedAt=input.endedAt||this.clock().toISOString();record.mileageEnd=input.mileageEnd??record.mileageEnd;record.status='finished';return record;
      }});
      this.event(s,'time.stopped',result.id,input.idempotencyKey,{revision:result.revision});
      return result;
    }catch(error){if(error.code==='REVISION_CONFLICT')this.conflict(s,error,'stop',input.idempotencyKey);throw error;}
  }
  correct(token,input){
    const s=this.session(token,'time.correct');
    if(!String(input.reason||'').trim()){const error=new Error('Correction reason required');error.code='VALIDATION_ERROR';throw error;}
    try{
      const result=this.repository.update(s.organisationId,input.id,{expectedRevision:input.expectedRevision,idempotencyKey:input.idempotencyKey,apply:record=>{
        const before={startedAt:record.startedAt,endedAt:record.endedAt,mileageStart:record.mileageStart,mileageEnd:record.mileageEnd,note:record.note};
        for(const field of ['startedAt','endedAt','mileageStart','mileageEnd','note'])if(input.changes[field]!==undefined)record[field]=input.changes[field];
        record.corrections.push({id:this.id('correction'),actorId:s.actorId,at:this.clock().toISOString(),reason:input.reason,before,changes:clone(input.changes)});
        return record;
      }});
      this.event(s,'time.corrected',result.id,input.idempotencyKey,{revision:result.revision,reason:input.reason,fields:Object.keys(input.changes)});
      return result;
    }catch(error){if(error.code==='REVISION_CONFLICT')this.conflict(s,error,'correct',input.idempotencyKey);throw error;}
  }
  addPhoto(token,input){
    const s=this.session(token,'document.upload');
    const record=this.repository.get(s.organisationId,input.timeRecordId);
    if(!record){const error=new Error('Time record not found');error.code='NOT_FOUND';throw error;}
    const result=this.storage.putPrivate({
      organisationId:s.organisationId,ownerId:s.actorId,timeRecordId:record.id,mime:input.mime,
      size:input.size,hash:input.hash,objectKey:input.objectKey,bytes:input.bytes,idempotencyKey:input.idempotencyKey
    });
    this.event(s,'time.evidence.added',record.id,input.idempotencyKey,{evidenceId:result.id,mime:result.mime,size:result.size,hash:result.hash});
    return result;
  }
  get(token,id){
    const s=this.readSession(token),record=this.repository.get(s.organisationId,id);
    if(!record||!this.mayRead(s,record)){const error=new Error('Time record not found');error.code='NOT_FOUND';throw error;}
    return record;
  }
  list(token){
    const s=this.readSession(token),records=this.repository.list(s.organisationId);
    return s.capabilities.includes('time.read.all')?records:records.filter(record=>record.actorId===s.actorId);
  }
  gallery(token,timeRecordId){
    const s=this.readSession(token),record=this.repository.get(s.organisationId,timeRecordId);
    if(!record||!this.mayRead(s,record)){const error=new Error('Time record not found');error.code='NOT_FOUND';throw error;}
    return this.storage.listPrivate(s.organisationId,timeRecordId);
  }
  getEvidence(token,evidenceId){
    const s=this.readSession(token),evidence=this.storage.getPrivate(s.organisationId,evidenceId);
    const record=this.repository.get(s.organisationId,evidence.metadata.timeRecordId);
    if(!record||!this.mayRead(s,record)){const error=new Error('Evidence not found');error.code='NOT_FOUND';throw error;}
    return evidence;
  }
}

module.exports={AuthPort,TimeRepositoryPort,EvidenceStoragePort,LocalAuthPort,RevisionConflictError,InMemoryTenantTimeRepository,InMemoryPrivateEvidenceStorage,OfflineCommandQueue,TimeProductionService};
