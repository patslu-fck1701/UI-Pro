import hashlib,json,uuid
from sqlalchemy import select
from fastapi import HTTPException
from .platform_models import WorkflowEvent
def replay(db,user,key,operation,payload):
    if not key:return None
    fingerprint=hashlib.sha256(json.dumps(payload,sort_keys=True,default=str).encode()).hexdigest()
    row=db.scalar(select(WorkflowEvent).where(WorkflowEvent.tenant==user.tenant,WorkflowEvent.actor==user.id,WorkflowEvent.key==key))
    if row:
        if row.operation!=operation or row.fingerprint!=fingerprint:raise HTTPException(409,'Dieser Vorgangsschlüssel wurde bereits für andere Angaben verwendet.')
        return json.loads(row.result)
    return None
def record(db,user,key,operation,payload,result):
    db.add(WorkflowEvent(id=str(uuid.uuid4()),tenant=user.tenant,actor=user.id,key=key or str(uuid.uuid4()),fingerprint=hashlib.sha256(json.dumps(payload,sort_keys=True,default=str).encode()).hexdigest(),operation=operation,result=json.dumps(result,default=str)))
