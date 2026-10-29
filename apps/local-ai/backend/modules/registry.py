import json
import uuid
from fastapi import Depends,HTTPException
from ..db import Session,ModuleConfig,Audit,ROOT,PACKAGE
from ..security import current_user
from .entitlements import effective

MODULES={'business_ai':{'name':'Business AI','status':'available'},'voice_ai':{'name':'Voice AI','status':'simulation'},'automation':{'name':'Automation','status':'preview'},'deutschz_ai':{'name':'DeutschZ AI','status':'available'},'creative_ai':{'name':'Creative AI','status':'available'}}
MODULES['hotel_ai']={'name':'Hotel AI','status':'available'}
MODULES['handwerk_ai']={'name':'Handwerk AI','status':'available'}
MODULES['scrap_ai']={'name':'Schrotties','status':'available'}

def stored_configuration(db,tenant):
    row=db.get(ModuleConfig,tenant)
    try:
        configured=json.loads(row.modules) if row else json.loads((ROOT/'config'/'packages'/(PACKAGE+'.json')).read_text())['modules']
        if not isinstance(configured,dict):raise ValueError('configuration')
        return configured
    except (ValueError,TypeError,KeyError):
        raise HTTPException(503,'Modulfreigaben sind derzeit nicht prüfbar.')

def configuration(tenant):
    with Session() as db:
        configured=stored_configuration(db,tenant)
        result={key:effective(configured.get(key,False)) for key in MODULES}
        if PACKAGE in {'hotel','hotel-demo'}:result.update(business_ai=False,handwerk_ai=False,scrap_ai=False)
        if PACKAGE=='handwerk-demo':result.update(hotel_ai=False,scrap_ai=False)
        if PACKAGE=='schrotties-demo':result.update(hotel_ai=False,handwerk_ai=False,business_ai=False)
        return result
def check_module(user,name):
    value=configuration(user.tenant).get(name)
    if value is not True and not (name in MODULES and MODULES[name]['status'] in {'simulation','preview'} and value==MODULES[name]['status']):
        raise HTTPException(403,'Dieses Modul ist deaktiviert oder die Freigabe ist abgelaufen.')
def guard(name):
    def dependency(user=Depends(current_user)):
        check_module(user,name);return user
    return dependency
def check_workspace(user,workspace):
    module={'business':'business_ai','creative':'creative_ai','deutschz':'deutschz_ai','hotel':'hotel_ai','handwerk':'handwerk_ai','scrap':'scrap_ai'}.get(workspace)
    if module:check_module(user,module)
def audit(db,user,event,target):
    db.add(Audit(id=str(uuid.uuid4()),tenant=user.tenant,actor=user.id,event=event,target=str(target)))
