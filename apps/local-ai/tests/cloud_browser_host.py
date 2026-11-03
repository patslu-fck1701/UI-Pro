"""Synthetic browser host only; excluded from Docker image and never a live login bypass."""
import os
import re
import time
import sys
from pathlib import Path
if os.environ.get('WERKZ_SYNTHETIC_BROWSER')!='1' or 'werkz-cloud-browser-' not in os.environ.get('WERKZ_AI_DATA',''):
    raise SystemExit('REFUSED: isolated synthetic browser fixture required')
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app import app
from backend import cloud_api
from backend.db import Session, User, LoginSession, ModuleConfig
from backend.kundenz import IdentityGrant, OIDCSession
from backend.cloud_store import CloudPermission
from backend.security import session_hash

os.environ['WERKZ_OWNER_ISSUER']='https://identity.example.invalid'
os.environ['WERKZ_OWNER_SUBJECT']='owner'
with Session() as db:
    for name in ('owner','customer-a','customer-b'):
        db.add(User(id=name,username=name,password_hash='disabled',tenant='synthetic-'+name,
                    role='admin' if name=='owner' else 'hotel_reception'))
        db.flush()
        db.add(LoginSession(token_hash=session_hash(name),user_id=name,expires=time.time()+3600))
        db.flush()
        db.add(OIDCSession(token_hash=session_hash(name),issuer='https://identity.example.invalid',subject=name))
        db.add(IdentityGrant(user_id=name,issuer='https://identity.example.invalid',subject=name,
            tenant='synthetic-'+name,role='OWNER' if name=='owner' else 'TEST_CUSTOMER',
            modules='["hotel"]',expires=time.time()+3600,revoked=0))
        db.add(ModuleConfig(tenant='synthetic-'+name,modules='{"hotel_ai":true}'))
        db.add(CloudPermission(principal=name,actions='["ask","openai:chat","file:upload","file:read","file:propose_edit","file:save","file:restore"]',
            data_classes='["synthetic"]',consent_ref='synthetic-browser',expires=time.time()+3600,revoked=0))
    db.commit()

original=cloud_api.service
class Fake:
    def status(self): return {'state':'SYNTHETIC_BROWSER_ONLY'}
    def complete(self,messages,**kwargs):
        marks=re.findall(r'<<<GINI-(?:START|ENDE)-[a-f0-9]+>>>',messages[-1]['content'])
        text=marks[0]+'\nSYNTHETIC edited\n'+marks[1] if marks else 'SYNTHETIC browser answer'
        return {'text':text,'finish_reason':'stop','model':'synthetic-browser-only'}
def service(ctx):
    result=original(ctx)
    result.openai=Fake()
    return result
cloud_api.service=service
