import json,re,uuid
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from typing import Literal
from .. import engine
from .registry import guard,check_module
from ..core import register_callback

router=APIRouter(prefix='/api/voice',tags=['voice_ai'])
class Transcript(BaseModel):
    text:str=Field(min_length=5,max_length=5000)
class Call(BaseModel):
    name:str=Field(min_length=1,max_length=160)
    topic:str=Field(min_length=1,max_length=1000)
    urgency:Literal['normal','high','urgent']='normal'
    phone:str=Field(min_length=3,max_length=100)
    address:str=Field(min_length=1,max_length=300)
    requested:str=Field(default='',max_length=100)
@router.post('/extract')
async def extract(input:Transcript,user=Depends(guard('voice_ai'))):
    check_module(user,'business_ai')
    from ..app import busy
    if busy or engine.loading:raise HTTPException(409,'Das lokale Modell ist beschäftigt. Bitte kurz warten.')
    marker='voice:'+str(uuid.uuid4());busy.add(marker)
    prompt=[{'role':'system','content':'Extrahiere aus dem Gespräch ausschließlich Fakten. Antworte nur als JSON mit name, topic, urgency (normal/high/urgent), phone, address, requested. Fehlende Werte als leere Zeichenfolge. Keine Fakten erfinden. /no_think'},{'role':'user','content':input.text}]
    try:
        result=''
        async for value in engine.tokens(prompt,'',0.1,320):result+=value
        match=re.search(r'\{[\s\S]*\}',result)
        if not match:raise ValueError('Kein JSON')
        value=json.loads(match.group())
        fields={key:str(value.get(key,'') or '') for key in ['name','topic','urgency','phone','address','requested']}
        if fields['urgency'] not in {'normal','high','urgent'}:fields['urgency']='normal'
        return {'fields':fields,'reviewRequired':True,'callbackCreated':False}
    except Exception:
        raise HTTPException(503,'Lokale Extraktion nicht abgeschlossen. Felder manuell erfassen oder erneut versuchen.')
    finally:busy.discard(marker)
@router.post('/callbacks',status_code=201)
def create_callback(input:Call,user=Depends(guard('voice_ai'))):
    return register_callback(user,input.model_dump())
