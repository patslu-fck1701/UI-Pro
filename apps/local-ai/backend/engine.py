import json
import os
from pathlib import Path
import httpx
import asyncio
import hashlib
import subprocess

BASE='http://127.0.0.1:8080'
loading=False
def installed_models():
    found=[]
    for root in [Path.home()/'.cache'/'huggingface'/'hub',Path.home()/'.lmstudio'/'models']:
        if root.exists():
            for file in root.rglob('*.gguf'):
                if len(found)>=100:break
                if file.is_file():found.append({'id':hashlib.sha256(str(file).encode()).hexdigest()[:24],'name':file.name,'path':str(file),'bytes':file.stat().st_size})
    return found
async def load_model(id):
    global loading
    if loading:raise ValueError('Ein Modellwechsel läuft bereits.')
    model=next((row for row in installed_models() if row['id']==id),None)
    if not model:raise ValueError('Lokales Modell nicht gefunden.')
    loading=True
    try:
        root=Path(__file__).resolve().parents[1]
        with (root/'.runtime'/'model-switch.log').open('w',encoding='utf-8') as log:
            result=await asyncio.to_thread(subprocess.run,['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'scripts'/'start-model.ps1'),'-ModelPath',model['path'],'-SwitchModel'],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,timeout=150,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if result.returncode:raise ValueError('Modellwechsel fehlgeschlagen. Lokale Engine-Logs prüfen.')
        return {'loaded':model['name']}
    except (subprocess.TimeoutExpired,OSError):raise ValueError('Lokaler Modellwechsel konnte nicht abgeschlossen werden. Engine-Logs prüfen.')
    finally:loading=False
def headers():
    keyfile=Path(__file__).resolve().parents[1]/'.runtime'/'engine.key'
    return {'Authorization':'Bearer '+keyfile.read_text().strip()} if keyfile.exists() else {}
async def models():
    async with httpx.AsyncClient(timeout=5,trust_env=False) as client:
        response=await client.get(BASE+'/v1/models',headers=headers())
        response.raise_for_status()
        return response.json().get('data',[])

async def context_window():
    """Read the real loaded model context; never enlarge the configured 4096 cap."""
    async with httpx.AsyncClient(timeout=8,trust_env=False) as client:
        response=await client.get(BASE+'/props',headers=headers());response.raise_for_status()
        limit=response.json().get('default_generation_settings',{}).get('n_ctx')
        if not isinstance(limit,int) or limit<512:raise ValueError('Invalid model context')
        return min(4096,limit)

async def count_tokens(messages):
    """Use llama.cpp's own chat template and tokenizer, including control tokens."""
    async with httpx.AsyncClient(timeout=8,trust_env=False) as client:
        template=await client.post(BASE+'/apply-template',headers=headers(),json={'messages':messages,'add_generation_prompt':True,'chat_template_kwargs':{'enable_thinking':False}})
        template.raise_for_status()
        formatted=template.json().get('prompt')
        if not isinstance(formatted,str):raise ValueError('Chat template unavailable')
        result=await client.post(BASE+'/tokenize',headers=headers(),json={'content':formatted,'add_special':False,'parse_special':True})
        result.raise_for_status();tokens=result.json().get('tokens')
        if not isinstance(tokens,list):raise ValueError('Tokenizer unavailable')
        return len(tokens)
async def tokens(messages,model,temperature,max_tokens):
    async with httpx.AsyncClient(timeout=httpx.Timeout(240,connect=5),trust_env=False) as client:
        async with client.stream('POST',BASE+'/v1/chat/completions',headers=headers(),json={
            'messages':messages,'model':model,'temperature':temperature,'max_tokens':max_tokens,
            'stream':True,'chat_template_kwargs':{'enable_thinking':False}
        }) as response:
            response.raise_for_status()
            complete=False
            async for line in response.aiter_lines():
                if not line.startswith('data:'): continue
                payload=line[5:].strip()
                if payload=='[DONE]':
                    complete=True
                    break
                value=json.loads(payload)
                choices=value.get('choices') if isinstance(value,dict) else None
                if not isinstance(choices,list) or not choices or not isinstance(choices[0],dict):
                    raise ValueError('Invalid model stream event')
                delta=choices[0].get('delta',{})
                if not isinstance(delta,dict):
                    raise ValueError('Invalid model stream event')
                # [DONE] only marks transport completion; a length-limited or filtered
                # answer is not a successfully completed user response.
                finish_reason=choices[0].get('finish_reason')
                if finish_reason is not None and finish_reason!='stop':
                    raise ValueError('Local model response not completed normally')
                content=delta.get('content')
                if content is not None and not isinstance(content,str):
                    raise ValueError('Invalid model stream event')
                if content: yield content
            if not complete:
                raise ValueError('Local model stream ended before completion')
