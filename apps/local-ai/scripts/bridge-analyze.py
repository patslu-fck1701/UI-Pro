"""Bounded local inference for the outbound operator worker; no business tools or writes."""
import asyncio,json,sys,time,uuid
from datetime import datetime
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend import engine
from backend.context_budget import assemble

# The outbound WerkZ bridge has its own loopback-only Qwen instance.  Keep the
# interactive UI-Pro engine on 8080 untouched and never accept a remote origin.
BRIDGE_MODEL_BASE = 'http://127.0.0.1:8081'
MAX_ANALYSIS_SECONDS = 30
COMPLETION_RESERVE_SECONDS = 4
engine.BASE = BRIDGE_MODEL_BASE

async def analyze(job):
    uuid.UUID(job['request_id']);uuid.UUID(job['lease_id'])
    expires=datetime.fromisoformat(job['expires_at'].replace('Z','+00:00')).timestamp()
    if not time.time()<expires<=time.time()+120:raise ValueError('EXPIRED')
    text=job['prompt']
    if not isinstance(text,str) or not text.strip() or len(text)>4000:raise ValueError('INVALID_JOB')
    # The cloud lease is currently 35 s.  Leave a fixed completion reserve so
    # the signed result can be accepted before the lease expires, while never
    # allowing the engine's broader HTTP timeout to control worker lifetime.
    budget=min(MAX_ANALYSIS_SECONDS,expires-time.time()-COMPLETION_RESERVE_SECONDS)
    if budget<=0:raise ValueError('EXPIRED')
    async with asyncio.timeout(budget):
        models=await engine.models()
        if not models:raise ValueError('MODEL_UNAVAILABLE')
        prompt,_=await assemble(system='Du bist der lokale WERKZ-Betreiberassistent. Antworte kurz auf Deutsch. Du hast hier keinen Zugriff auf Betriebsdaten, Dateien oder aktuelle externe Zustände. Behaupte keine ausgeführten Aktionen. Kennzeichne fehlende Quellen. /no_think',user=text,history=[],contexts=[],document='',limit=await engine.context_window(),response_tokens=128,count=engine.count_tokens)
        answer=''
        async for chunk in engine.tokens(prompt,models[0]['id'],0.2,128):
            answer+=chunk
            if len(answer)>8000:raise ValueError('MODEL_UNAVAILABLE')
        if time.time()>=expires:raise ValueError('EXPIRED')
        if not answer.strip():raise ValueError('MODEL_UNAVAILABLE')
        # llama.cpp may identify a model by its full local path. Never send that path.
        return {'answer':answer,'model':str(models[0]['id']).replace('\\','/').rsplit('/',1)[-1][:200]}

if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(16385)
        if len(raw)>16384:raise ValueError('INVALID_JOB')
        result=asyncio.run(analyze(json.loads(raw)))
    except TimeoutError:result={'error_code':'MODEL_TIMEOUT'}
    except Exception:result={'error_code':'MODEL_UNAVAILABLE'}
    print(json.dumps(result,ensure_ascii=True))
