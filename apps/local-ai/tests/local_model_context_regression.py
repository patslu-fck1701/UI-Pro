"""Explicit local runtime test: synthetic demo tenants, existing model, no external API."""
import json,time,random,string
import httpx

for port,package,workspace,role in [(8000,'handwerk-demo','handwerk','administrator'),(8001,'hotel-demo','hotel','management'),(8002,'schrotties-demo','scrap','administrator')]:
    base=f'http://127.0.0.1:{port}'
    with httpx.Client(base_url=base,headers={'Origin':base},timeout=180,trust_env=False) as client:
        health=client.get('/api/health').json()
        assert health['package']==package and health['mode']=='demo' and health['engine']=='ready'
        prefix='hotel' if workspace=='hotel' else 'work'
        client.post('/api/'+prefix+'/demo/start',json={'role':role}).raise_for_status()
        chat=client.post('/api/chats',json={'workspace':workspace,'system_prompt':'Antworte kurz auf Deutsch anhand der bereitgestellten Fakten. Fehlende Informationen sind unbekannt. /no_think'})
        chat.raise_for_status();url='/api/chats/'+chat.json()['id']+'/stream'
        started=time.monotonic()
        response=client.post(url,json={'content':'Fasse den heutigen Hotelbetrieb zusammen.' if workspace=='hotel' else 'Fasse den heutigen Betrieb zusammen.','include_hotel':workspace=='hotel','include_work':workspace!='hotel','max_tokens':96})
        response.raise_for_status()
        events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
        context=next(e['context'] for e in events if e['type']=='start')
        assert context['input_tokens']+context['response_reserve']+64<=context['context_limit']
        assert any(e['type']=='token' and e.get('content') for e in events)
        assert events[-1]=={'type':'done','status':'complete'}
        rng=random.Random(75)
        oversized=''.join(rng.choices(string.ascii_letters+string.digits,k=15000))
        rejected=client.post(url,json={'content':oversized,'max_tokens':96})
        assert rejected.status_code==413,rejected.status_code
        followup=client.post(url,json={'content':'Antworte nur mit: Bereit','max_tokens':32})
        followup.raise_for_status()
        assert '"status": "complete"' in followup.text and '"type": "error"' not in followup.text
        print(json.dumps({'package':package,'generic_summary':'passed','overlong_then_short':'passed','context':context,'seconds':round(time.monotonic()-started,2)},ensure_ascii=False))
