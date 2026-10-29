import json,uuid
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field,ConfigDict
from typing import Literal
from sqlalchemy import select,text
from ..db import Session,User,ModuleConfig,Audit,PACKAGE,MODE
from ..security import current_user,hash_password
from .registry import MODULES,configuration,audit,stored_configuration
from .entitlements import revision
from datetime import datetime,timezone
from .. import engine

router=APIRouter(prefix='/api/admin',tags=['administration'])
def admin(user=Depends(current_user)):
    if user.role!='admin':raise HTTPException(403,'Administrator erforderlich.')
    return user
@router.get('/modules')
def modules(user=Depends(admin)):
    with Session() as db:records=stored_configuration(db,user.tenant)
    return {'core':True,'package':PACKAGE,'mode':MODE,'modules':configuration(user.tenant),'available':MODULES,'entitlements':records,'revision':revision(records)}

class EntitlementInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    status:Literal['active','trial','suspended','expired']
    expiresAt:datetime|None=None
    expectedRevision:str=Field(pattern=r'^[a-f0-9]{64}$')

@router.put('/entitlements/{module}')
def update_entitlement(module:str,input:EntitlementInput,user=Depends(admin)):
    if MODE!='demo':raise HTTPException(403,'Produktive Modulfreigaben benötigen den geprüften Betreiberprozess.')
    if module not in MODULES or MODULES[module]['status']!='available':raise HTTPException(400,'Nur verfügbare Fachmodule freigeben.')
    if input.expiresAt is not None and (input.expiresAt.tzinfo is None or input.expiresAt.utcoffset() is None):raise HTTPException(400,'Ablaufzeit mit Zeitzone erforderlich.')
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'))
        records=stored_configuration(db,user.tenant)
        if revision(records)!=input.expectedRevision:raise HTTPException(409,'Modulfreigaben wurden geändert. Neu laden.')
        records[module]={'status':input.status,'expiresAt':input.expiresAt.astimezone(timezone.utc).isoformat() if input.expiresAt else None}
        value=db.get(ModuleConfig,user.tenant)
        if value is None:value=ModuleConfig(tenant=user.tenant,modules='{}');db.add(value)
        value.modules=json.dumps(records)
        audit(db,user,'core.entitlement.changed',module)
        db.commit()
    return {'modules':configuration(user.tenant),'revision':revision(records),'demoOnly':True}
class ModuleInput(BaseModel):
    modules:dict[str,bool|Literal['simulation','preview']]
@router.put('/modules')
def update_modules(input:ModuleInput,user=Depends(admin)):
    if set(input.modules)!=set(MODULES):raise HTTPException(400,'Vollständiges, gültiges Modulmanifest erforderlich.')
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'))
        if any(isinstance(value,dict) for value in stored_configuration(db,user.tenant).values()):raise HTTPException(409,'Versionierte Modulfreigaben über den Freigabeprozess ändern.')
        value=db.get(ModuleConfig,user.tenant)
        if not value:value=ModuleConfig(tenant=user.tenant,modules='{}');db.add(value)
        value.modules=json.dumps(input.modules);audit(db,user,'core.modules.updated',user.tenant);db.commit()
    return {'modules':configuration(user.tenant),'core':True}
class UserInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    username:str=Field(min_length=3,max_length=64,pattern=r'^[a-zA-Z0-9_.-]+$')
    password:str=Field(min_length=4,max_length=128)
    role:str=Field(default='staff',max_length=40,pattern=r'^[a-z_]+$')

def assignable_roles(user):
    roles={'staff':'Allgemeiner Mitarbeiter','reader':'Allgemeiner Leser'}
    if configuration(user.tenant).get('hotel_ai') is True:
        from .hotel.service import ROLES
        roles.update({'hotel_'+key:label for key,label in ROLES.items()})
    return roles

@router.get('/roles')
def roles(user=Depends(admin)):
    return assignable_roles(user)
@router.post('/users',status_code=201)
def create_user(input:UserInput,user=Depends(admin)):
    if input.role not in assignable_roles(user):raise HTTPException(403,'Diese Rolle ist für diesen Betrieb nicht freigegeben.')
    with Session() as db:
        if db.scalar(select(User).where(User.username==input.username)):raise HTTPException(409,'Benutzername bereits vergeben.')
        value=User(id=str(uuid.uuid4()),username=input.username,password_hash=hash_password(input.password),role=input.role,tenant=user.tenant);db.add(value);audit(db,user,'core.user.created',value.id);db.commit();return {'id':value.id,'username':value.username,'role':value.role}
@router.get('/users')
def users(user=Depends(admin)):
    with Session() as db:return [{'id':row.id,'username':row.username,'role':row.role} for row in db.scalars(select(User).where(User.tenant==user.tenant))]

class RoleChange(BaseModel):
    model_config=ConfigDict(extra='forbid')
    role:str=Field(max_length=40)
    expected_role:str=Field(max_length=40)

@router.patch('/users/{identifier}/role')
def change_role(identifier:str,input:RoleChange,user=Depends(admin)):
    if identifier==user.id:raise HTTPException(403,'Eigene Betreiberrolle hier nicht ändern.')
    if input.role not in assignable_roles(user):raise HTTPException(403,'Rolle für diesen Betrieb nicht freigegeben.')
    with Session() as db:
        db.execute(text('BEGIN IMMEDIATE'))
        actor=db.get(User,user.id)
        if not actor or actor.role!='admin' or actor.tenant!=user.tenant:raise HTTPException(403,'Betreiberrecht nicht mehr gültig.')
        target=db.get(User,identifier)
        if not target or target.tenant!=user.tenant:raise HTTPException(404,'Benutzer nicht gefunden.')
        if target.role=='admin':raise HTTPException(403,'Betreiberkonten benötigen einen eigenen Freigabeprozess.')
        if target.role!=input.expected_role:raise HTTPException(409,'Rolle wurde geändert. Benutzerliste neu laden.')
        previous=target.role;target.role=input.role
        audit(db,user,'core.user.role.changed:'+previous+'>'+input.role,target.id)
        db.commit()
        return {'id':target.id,'username':target.username,'role':target.role,'result':'APPLIED','session_policy':'live_role_recheck'}
@router.get('/audit')
def logs(user=Depends(admin)):
    with Session() as db:return [{'event':row.event,'target':row.target,'actor':row.actor,'created':row.created} for row in db.scalars(select(Audit).where(Audit.tenant==user.tenant).order_by(Audit.created.desc()).limit(100))]
@router.get('/models')
def installed_models(user=Depends(admin)):
    return [{'id':row['id'],'name':row['name'],'bytes':row['bytes']} for row in engine.installed_models()]
class LoadModel(BaseModel):
    id:str=Field(min_length=24,max_length=24)
@router.post('/models/load')
async def load_model(input:LoadModel,user=Depends(admin)):
    from ..app import busy
    if busy:raise HTTPException(409,'Bitte laufende Antwort zuerst abschließen oder stoppen.')
    try:return await engine.load_model(input.id)
    except ValueError as error:raise HTTPException(400,str(error))
