"""Existing operator surface: scoped domain readbacks, no new dashboard/service."""
from datetime import datetime,timezone
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field,ConfigDict
from .modules.admin import admin
from .modules.registry import configuration
from .db import ROOT,PACKAGE,MODE
from .knowledge_port import KnowledgeSearchPort,KnowledgeUnavailable
from . import engine
from .modules.hotel import qwen_bridge

router=APIRouter(prefix='/api/operator',tags=['operator'])
port=KnowledgeSearchPort(ROOT/'config'/'aiz-binding.json')

@router.get('/domains')
async def domains(user=Depends(admin)):
    modules=configuration(user.tenant)
    try:
        knowledge=port.status()
        port.context('Status')
    except KnowledgeUnavailable as error:knowledge={'state':'NOT_CONNECTED','reason':'AiZ ist nicht nutzbar: lokale Quellenbindung oder freigegebener Bestand fehlt, ist verändert oder nicht lesbar.','reason_code':str(error),'scope':'werkz'}
    try:model_ready=bool(await engine.models())
    except Exception:model_ready=False
    values=[
        {'id':'werkz','state':'AVAILABLE','source':'/api/modules','package':PACKAGE,'mode':MODE,'modules':modules,'local_model_ready':model_ready},
        {'id':'qwen-bridge','state':qwen_bridge.status()['state'],'source':'configured outbound bridge','bridge':qwen_bridge.status()},
        {'id':'kundenz','state':'PARTIAL','source':'existing WerkZ authentication and module guards','session_verified':True,'external_identity_federation':False},
        {'id':'aiz',**knowledge},
        {'id':'master-control','state':'NOT_VERIFIED','source':'/api/operator/domains','independent_monitor':False},
        {'id':'deutschz','state':'NOT_CONNECTED','reason':'separate project, no live adapter authorized here'}
    ]
    for item in values:
        available=item['state']=='AVAILABLE'
        item['checks']={'configured':available or item['state']=='PARTIAL','reachable':available,'authenticated':available,'usable':available}
        if item['id']=='werkz':item['checks']['model_usable']=model_ready
        if item['id']=='kundenz':item['checks']={'configured':True,'reachable':True,'authenticated':True,'usable':True,'external_federation':False}
        if item['id']=='master-control':item['checks']={'configured':False,'reachable':False,'authenticated':False,'usable':False,'independent_monitor':False}
    return {'checked_at':datetime.now(timezone.utc).isoformat(),'stale_after_seconds':60,'tenant':user.tenant,'scope':'current_operator_tenant','domains':values,'plugin_mcp_connections_verified':False}

class Search(BaseModel):
    model_config=ConfigDict(extra='forbid')
    query:str=Field(min_length=1,max_length=240)
    limit:int=Field(default=5,ge=1,le=5)

@router.post('/knowledge/search')
def search(input:Search,user=Depends(admin)):
    try:return port.context(input.query,min(input.limit,3))
    except KnowledgeUnavailable as error:raise HTTPException(503,str(error))
