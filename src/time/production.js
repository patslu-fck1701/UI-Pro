'use strict';

const crypto=require('node:crypto');
const clone=value=>structuredClone(value);
const uid=prefix=>prefix+'_'+crypto.randomUUID();

class AuthPort { resolveSession(_) { throw new Error('AuthPort.resolveSession must be implemented'); } }
class TimeRepositoryPort {
  create(_) { throw new Error('TimeRepositoryPort.create must be implemented'); }
  get(_,__) { throw new Error('TimeRepositoryPort.get must be implemented'); }
  update(_,__,___) { throw new Error('TimeRepositoryPort.update must be implemented'); }
}
class EvidenceStoragePort {
  putPrivate(_) { throw new Error('EvidenceStoragePort.putPrivate must be implemented'); }
  listPrivate(_,__) { throw new Error('EvidenceStoragePort.listPrivate must be implemented'); }
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
    const value={...clone(record),revision:1,corrections:[]};
    this.records.set(this.key(value.organisationId,value.id),value);
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
  constructor(){super();this.objects=new Map();}
  putPrivate({organisationId,ownerId,timeRecordId,mime,size,hash,objectKey}){
    const metadata={id:uid('file'),organisationId,ownerId,timeRecordId,mime,size,hash,objectKey,visibility:'private'};
    this.objects.set(organisationId+':'+metadata.id,metadata);
    return clone(metadata);
  }
  listPrivate(organisationId,timeRecordId){
    return [...this.objects.values()].filter(x=>x.organisationId===organisationId&&x.timeRecordId===timeRecordId).map(clone);
  }
  getPrivate(organisationId,id){
    const value=this.objects.get(organisationId+':'+id);
    if(!value){const error=new Error('Evidence not found');error.code='NOT_FOUND';throw error;}
    return clone(value);
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
  start(token,input){
    const s=this.session(token,'time.start');
    const record={
      id:this.id('time'),organisationId:s.organisationId,actorId:s.actorId,
      orderId:input.orderId||null,customerLabel:input.customerLabel||null,
      startedAt:input.startedAt||this.clock().toISOString(),endedAt:null,
      mileageStart:input.mileageStart??null,mileageEnd:null,note:input.note||'',status:'running'
    };
    const result=this.repository.create(record,input.idempotencyKey);
    this.audit({organisationId:s.organisationId,actorId:s.actorId,eventType:'time.started',entityId:result.id});
    return result;
  }
  stop(token,input){
    const s=this.session(token,'time.stop');
    return this.repository.update(s.organisationId,input.id,{expectedRevision:input.expectedRevision,idempotencyKey:input.idempotencyKey,apply:record=>{
      record.endedAt=input.endedAt||this.clock().toISOString();record.mileageEnd=input.mileageEnd??record.mileageEnd;record.status='finished';return record;
    }});
  }
  correct(token,input){
    const s=this.session(token,'time.correct');
    if(!String(input.reason||'').trim())throw new Error('Correction reason required');
    return this.repository.update(s.organisationId,input.id,{expectedRevision:input.expectedRevision,idempotencyKey:input.idempotencyKey,apply:record=>{
      const before={startedAt:record.startedAt,endedAt:record.endedAt,mileageStart:record.mileageStart,mileageEnd:record.mileageEnd,note:record.note};
      for(const field of ['startedAt','endedAt','mileageStart','mileageEnd','note'])if(input.changes[field]!==undefined)record[field]=input.changes[field];
      record.corrections.push({id:this.id('correction'),actorId:s.actorId,at:this.clock().toISOString(),reason:input.reason,before,changes:clone(input.changes)});
      return record;
    }});
  }
  addPhoto(token,input){
    const s=this.session(token,'document.upload');
    const record=this.repository.get(s.organisationId,input.timeRecordId);
    if(!record){const error=new Error('Time record not found');error.code='NOT_FOUND';throw error;}
    return this.storage.putPrivate({organisationId:s.organisationId,ownerId:s.actorId,timeRecordId:record.id,mime:input.mime,size:input.size,hash:input.hash,objectKey:input.objectKey});
  }
  gallery(token,timeRecordId){
    const s=this.session(token,'time.start');
    if(!this.repository.get(s.organisationId,timeRecordId)){const error=new Error('Time record not found');error.code='NOT_FOUND';throw error;}
    return this.storage.listPrivate(s.organisationId,timeRecordId);
  }
}

module.exports={AuthPort,TimeRepositoryPort,EvidenceStoragePort,LocalAuthPort,RevisionConflictError,InMemoryTenantTimeRepository,InMemoryPrivateEvidenceStorage,OfflineCommandQueue,TimeProductionService};
