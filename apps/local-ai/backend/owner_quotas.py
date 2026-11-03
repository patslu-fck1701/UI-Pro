"""Owner-only, dated quota snapshots. No provider calls, credential reads or purchases."""
import hashlib
import json
import math
import time
import uuid
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import String, Text, Integer, select
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, Session, Audit
from .test_customers import owner
from .write_lock import begin_write

router=APIRouter(prefix='/api/auth/owner/quotas',tags=['owner-quotas'])
SLOTS={
 'openai':{'prepaid':('Aktuelles Prepaid-Guthaben',{'EUR','USD'}),'daily_cost':('Kosten pro Tag',{'EUR','USD'}),
   'project_cost':('Kosten pro Projekt',{'EUR','USD'}),'request_cost':('Kosten pro Anfrage',{'EUR','USD'}),
   'input_tokens':('Input-Tokens',{'tokens'}),'output_tokens':('Output-Tokens',{'tokens'}),'cached_tokens':('Cache-Tokens',{'tokens'})},
 'elevenlabs':{'plan_units':('Tarifkontingent laut Anbieter',{'credits','provider_characters'}),
   'overage':('Zusatzverbrauch',{'EUR','USD','credits'}),'local_tts':('Lokales Zeichenbudget',{'characters'})},
 'codex':{'short_window':('Kurzes Nutzungsfenster',{'percent'}),'week':('Wochenlimit',{'percent'}),
   'resets':('Verfügbare kostenlose Resets',{'count'}),'extra':('Zusatzkontingent',{'credits','EUR','USD'})},
 'claude':{'session':('Sitzungsfenster',{'percent'}),'week':('Wochenlimit',{'percent'}),
   'model_week':('Modellbezogenes Wochenlimit',{'percent'}),'extra':('Extra Usage',{'EUR','USD','credits'})}}
NOTES={
 'openai':'API-Guthaben, Ausgaben und ChatGPT/Codex-Abos sind getrennt. Kosten-API ist kein Prepaid-Restsaldo. Die ursprüngliche Aufladung ist kein aktueller Saldo.',
 'elevenlabs':'V10 / eleven_multilingual_v2. Anbieter-Credits, Anbieter-Zählwerte und lokal reservierte Zeichen nicht gleichsetzen. Overage bleibt unbekannt, bis es bestätigt ist.',
 'codex':'Kurzes Fenster, Woche, kostenlose Resets und Zusatzkontingente getrennt prüfen. Kein automatisches Einlösen oder Kaufen.',
 'claude':'Claude/Claude-Code-Abolimits sind getrennt von Anthropic-API-Kosten. Planwerte datiert aus Settings > Usage übernehmen; keine Browser-Cookies auslesen.'}

class QuotaSnapshot(Base):
    __tablename__='owner_quota_snapshots'
    owner_id:Mapped[str]=mapped_column(String,primary_key=True)
    provider:Mapped[str]=mapped_column(String,primary_key=True)
    metric:Mapped[str]=mapped_column(String,primary_key=True)
    version:Mapped[int]=mapped_column(Integer)
    payload:Mapped[str]=mapped_column(Text)

class QuotaImport(Base):
    __tablename__='owner_quota_imports'
    owner_id:Mapped[str]=mapped_column(String,primary_key=True)
    key:Mapped[str]=mapped_column(String,primary_key=True)
    digest:Mapped[str]=mapped_column(String)
    result:Mapped[str]=mapped_column(Text)

class ManualSnapshot(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    provider:Literal['openai','elevenlabs','codex','claude']
    metric:str=Field(max_length=32)
    unit:Literal['EUR','USD','tokens','credits','provider_characters','characters','percent','count']
    period:Literal['prepaid','request','day','project','session','short','week','month','extra']
    available:float|None=Field(default=None,ge=-1e12,le=1e12)
    used:float|None=Field(default=None,ge=0,le=1e12)
    total:float|None=Field(default=None,ge=0,le=1e12)
    observed_at:datetime
    reset_at:datetime|None=None
    quality:Literal['statement','estimate','provider_export']='statement'
    plan:Literal['unknown','free','go','plus','starter','creator','pro','max_5x','max_20x','team','scale','business','enterprise','custom']='unknown'
    account_ref:str=Field(default='not-specified',max_length=48,pattern=r'^[A-Za-z0-9_.-]+$')
    model:Literal['unknown','gpt-6-luna','eleven_multilingual_v2']='unknown'
    overage_enabled:bool|None=None
    expected_version:int=Field(ge=0)
    idempotency_key:str=Field(min_length=8,max_length=128,pattern=r'^[A-Za-z0-9_-]+$')
    @model_validator(mode='after')
    def validate_snapshot(self):
        if self.metric not in SLOTS[self.provider] or self.unit not in SLOTS[self.provider][self.metric][1]:
            raise ValueError('Kennzahl und Einheit passen nicht zusammen')
        expected_period={'prepaid':'prepaid','daily_cost':'day','project_cost':'project','request_cost':'request',
                         'short_window':'short','week':'week','model_week':'week','session':'session','resets':'extra','extra':'extra'}
        if self.metric in expected_period and self.period!=expected_period[self.metric]:raise ValueError('Falsche Periode')
        if self.provider=='elevenlabs' and self.period!='month':raise ValueError('Monatsperiode erforderlich')
        if self.observed_at.tzinfo is None or (self.reset_at and self.reset_at.tzinfo is None):raise ValueError('Zeitzone erforderlich')
        if self.observed_at.timestamp()>time.time()+300:raise ValueError('Messzeit liegt in der Zukunft')
        if self.reset_at and self.reset_at<=self.observed_at:raise ValueError('Reset muss nach Messung liegen')
        if all(v is None for v in (self.available,self.used,self.total)):raise ValueError('Kein Messwert')
        if self.unit=='percent' and self.total not in (None,100):raise ValueError('Prozentnenner muss 100 sein')
        if self.unit=='percent':self.total=100
        if self.total is not None and self.available is not None and self.available>self.total:
            raise ValueError('Verfügbar überschreitet Gesamtkontingent')
        from .gini_cloud.contract import contains_secret
        if contains_secret(self.account_ref):raise ValueError('Keine Zugangsdaten')
        if self.total is not None and self.available is not None and self.used is not None:
            if not math.isclose(self.available+self.used,self.total,abs_tol=1e-6):raise ValueError('Werte widersprechen sich')
        return self

def presentation(payload,stamp=None):
    out=dict(payload);now=time.time() if stamp is None else stamp
    age=now-datetime.fromisoformat(out['observed_at']).timestamp()
    reset=datetime.fromisoformat(out['reset_at']).timestamp() if out.get('reset_at') else None
    stale=age>86400 or (reset is not None and reset<=now)
    remaining=out.get('available');used=out.get('used');total=out.get('total')
    if remaining is None and total is not None and used is not None:remaining=total-used
    out['available']=remaining
    out['source']='VERALTET' if stale else 'MANUELL';out['original_source']='MANUELL'
    out['quality_label']='SCHÄTZUNG' if out['quality']=='estimate' else 'MANUELL BESTÄTIGT'
    out['remaining_percent']=None if stale or total is None or total<=0 or remaining is None else max(0,min(100,100*remaining/total))
    out['overdrawn']=remaining is not None and remaining<0
    return out

@router.get('')
def overview(user=Depends(owner)):
    with Session() as db:
        rows={(r.provider,r.metric):json.loads(r.payload) for r in db.scalars(select(QuotaSnapshot).where(QuotaSnapshot.owner_id==user.id))}
        from .cloud_voice import VoiceBudget,positive
        from .cloud_store import CloudBudget
        month=datetime.now(timezone.utc).strftime('%Y-%m')
        voice=db.get(VoiceBudget,('tenant:'+user.tenant,month))
        text=db.get(CloudBudget,user.tenant)
        local={'source':'LOKAL_GEMESSEN','tts_reserved_characters':voice.used if voice else 0,
               'tts_monthly_character_limit':positive('WERKZ_GINI_CLOUD_VOICE_CHAR_LIMIT'),
               'openai_reserved_token_ceiling':text.used if text else 0,'period':month,
               'not_provider_consumption':True}
    return {'checked_at':datetime.now(timezone.utc).isoformat(),'provider_connection':'NOT_CONNECTED',
        'local_measurements':local,
        'cards':[{'provider':provider,'note':NOTES[provider],'metrics':[
            {'metric':metric,'label':label,'allowed_units':sorted(units),
             **(presentation(rows[(provider,metric)]) if (provider,metric) in rows else
                {'source':'UNBEKANNT','remaining_percent':None,'available':None,'used':None,'total':None,'version':0})}
            for metric,(label,units) in slots.items()]} for provider,slots in SLOTS.items()]}

@router.post('/manual')
def manual(data:ManualSnapshot,user=Depends(owner)):
    payload=data.model_dump(mode='json',exclude={'idempotency_key','expected_version'})
    digest=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
    with Session() as db:
        begin_write(db)
        replay=db.get(QuotaImport,(user.id,data.idempotency_key))
        if replay:
            if replay.digest!=digest:raise HTTPException(409,'Importkennung bereits anders verwendet.')
            return presentation(json.loads(replay.result))
        row=db.get(QuotaSnapshot,(user.id,data.provider,data.metric))
        version=row.version if row else 0
        if version!=data.expected_version:raise HTTPException(409,'Stand wurde geändert. Neu laden.')
        payload['version']=version+1
        if row:row.version=version+1;row.payload=json.dumps(payload)
        else:db.add(QuotaSnapshot(owner_id=user.id,provider=data.provider,metric=data.metric,version=1,payload=json.dumps(payload)))
        db.add(QuotaImport(owner_id=user.id,key=data.idempotency_key,digest=digest,result=json.dumps(payload)))
        db.add(Audit(id=str(uuid.uuid4()),tenant=user.tenant,actor=user.id,event='owner.quota.manual',target=data.provider+':'+data.metric))
        db.commit()
    return presentation(payload)
