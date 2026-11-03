"""Cloud 1.1 host: server-bound replies, durable character reservations, no local voice data."""
import os
import re
import time
import uuid
import threading
from datetime import datetime, timezone
from urllib.request import build_opener, ProxyHandler, HTTPRedirectHandler
from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import String, Integer, select, delete
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, Session
from .write_lock import begin_write
from .gini_cloud import ElevenLabsVoicePort, GiniCloudError, AUDIO_RESPONSE_HEADERS
from .cloud_api import Input, context, service

router=APIRouter(prefix='/api/gini/v1/voice',tags=['gini-cloud-voice'])

class VoiceBudget(Base):
    __tablename__='cloud_voice_budgets'
    scope: Mapped[str]=mapped_column(String,primary_key=True)
    period: Mapped[str]=mapped_column(String,primary_key=True)
    used: Mapped[int]=mapped_column(Integer)

def positive(name):
    try:return max(0,int(os.environ.get(name,'0')))
    except (TypeError,ValueError):return 0

class CharacterBudget:
    def __init__(self,identity):
        self.identity=identity
        self.limit=positive('WERKZ_GINI_CLOUD_VOICE_CHAR_LIMIT')
        self.reserved=0
    def reserve(self,amount):
        if not self.limit or not isinstance(amount,int) or amount<1:
            raise GiniCloudError('COST_LIMIT_NOT_APPROVED',429,'Zeichenbudget nicht freigegeben')
        month=datetime.now(timezone.utc).strftime('%Y-%m')
        minute=str(int(time.time())//60)
        with Session() as db:
            begin_write(db)
            row=db.get(VoiceBudget,('tenant:'+self.identity.tenant_id,month))
            rate=db.get(VoiceBudget,('rate:'+self.identity.principal_id,minute))
            if (rate.used if rate else 0)>=6:
                raise GiniCloudError('PROVIDER_RATE_LIMITED',429,'Sprachanfragen begrenzt')
            if (row.used if row else 0)+amount>self.limit:
                raise GiniCloudError('COST_LIMIT_REACHED',429,'Zeichenbudget erreicht')
            if not row:row=VoiceBudget(scope='tenant:'+self.identity.tenant_id,period=month,used=0);db.add(row)
            if not rate:rate=VoiceBudget(scope='rate:'+self.identity.principal_id,period=minute,used=0);db.add(rate)
            row.used+=amount;rate.used+=1
            db.execute(delete(VoiceBudget).where(VoiceBudget.scope.like('rate:%'),VoiceBudget.period<str(int(minute)-2)))
            db.commit()
            self.reserved=amount
    def commit(self,amount):
        if amount!=self.reserved:raise GiniCloudError('COST_LIMIT_REACHED',429,'Reservierung stimmt nicht überein')

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def make_voice(ctx):
    approved=(os.environ.get('WERKZ_GINI_CLOUD_VOICE_ENABLED')=='1'
              and os.environ.get('WERKZ_GINI_CLOUD_VOICE_COST_APPROVED')=='1')
    voice_id=os.environ.get('WERKZ_GINI_CLOUD_V10_VOICE_ID','')
    if not re.fullmatch(r'[A-Za-z0-9]{10,64}',voice_id):voice_id=''
    return ElevenLabsVoicePort(api_key=os.environ.get('WERKZ_GINI_CLOUD_ELEVENLABS_KEY',''),
        voice_id=voice_id,budget=CharacterBudget(ctx.identity),enabled=approved,
        transport=build_opener(ProxyHandler({}),NoRedirect()))

class ReplyMemory:
    """Ephemeral bounded reply/audio memory. Session-bound; never persisted or logged."""
    def __init__(self):self.items={};self.lock=threading.RLock()
    def remember(self,identity,text):
        with self.lock:
            for key,value in list(self.items.items()):
                if value['expires']<=time.time():del self.items[key]
            while len(self.items)>=64:del self.items[next(iter(self.items))]
            key='reply-'+uuid.uuid4().hex
            self.items[key]={'tenant':identity.tenant_id,'principal':identity.principal_id,
                'session':identity.session_id,'text':text,'audio':None,'mutex':threading.Lock(),
                'expires':min(time.time()+600,identity.expires_at.timestamp())}
            return key
    def get(self,identity,key):
        with self.lock:
            row=self.items.get(key)
            if (not row or row['expires']<=time.time() or
                (row['tenant'],row['principal'],row['session'])!=(identity.tenant_id,identity.principal_id,identity.session_id)):
                raise GiniCloudError('REPLY_NOT_FOUND',404,'Antwort nicht verfügbar')
            return row
    def put_audio(self,key,row,audio):
        with self.lock:
            if self.items.get(key) is not row:return
            total=sum(len(v['audio'] or b'') for v in self.items.values())
            if total+len(audio)>32*1024*1024:
                for value in self.items.values():value['audio']=None
            row['audio']=audio
    def clear_principal(self,principal):
        with self.lock:
            for key,value in list(self.items.items()):
                if value['principal']==principal:del self.items[key]

replies=ReplyMemory()

class VoiceInput(Input):
    reply_id:str=Field(min_length=8,max_length=80)
    text:str|None=Field(default=None,max_length=1200)

def authorize_voice(svc,ctx):
    svc._active(ctx.identity)
    svc.gate.require(ctx.identity,resource='elevenlabs:tts',action='tts:synthesize',
        purpose='assistant_voice',data_class='synthetic',consent_ref=ctx.consent())
    if svc.voice is None or svc.voice.status()['state']!='online':
        raise GiniCloudError('PROVIDER_DISABLED',503,'Cloud-Stimme nicht freigegeben oder konfiguriert')

@router.post('/tts')
def tts(data:VoiceInput,ctx=Depends(context)):
    svc=service(ctx)
    authorize_voice(svc,ctx)
    row=replies.get(ctx.identity,data.reply_id)
    if data.text is not None and data.text!=row['text']:
        raise GiniCloudError('REPLY_TEXT_MISMATCH',422,'Nur die fertige Antwort darf vorgelesen werden')
    with row['mutex']:
        authorize_voice(svc,ctx)
        if row['audio'] is not None:
            audio=row['audio'];source='cache'
        else:
            result=svc.tts(ctx.identity,text=row['text'],purpose='assistant_voice',
                consent_ref=ctx.consent(),data_class='synthetic')
            audio=result['audio'];source='provider'
            authorize_voice(svc,ctx)
            replies.put_audio(data.reply_id,row,audio)
        authorize_voice(svc,ctx)
        return Response(audio,media_type='audio/mpeg',headers={**AUDIO_RESPONSE_HEADERS,'X-GINI-Voice':source})
