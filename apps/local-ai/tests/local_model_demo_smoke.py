"""Opt-in runtime proof using synthetic per-browser demo tenants and existing Qwen."""
import json,time,httpx

for port,package,workspace,role,question in [
    (8000,'handwerk-demo','handwerk','administrator','Wie viele offene Aufträge sind laut den beigefügten Betriebsdaten vorhanden? Antworte kurz mit der Zahl.'),
    (8001,'hotel-demo','hotel','management','Welchen Status hat Zimmer 205? Antworte nur mit Zimmernummer und dem belegten Status.'),
    (8002,'schrotties-demo','scrap','administrator','Wie viele offene Aufträge sind laut den beigefügten Betriebsdaten vorhanden? Antworte kurz mit der Zahl.')]:
    base=f'http://127.0.0.1:{port}'
    with httpx.Client(base_url=base,headers={'Origin':base},timeout=180,trust_env=False) as client:
        health=client.get('/api/health');health.raise_for_status();assert health.json()['package']==package and health.json()['mode']=='demo'
        prefix='hotel' if workspace=='hotel' else 'work'
        login=client.post('/api/'+prefix+'/demo/start',json={'role':role});login.raise_for_status()
        chat=client.post('/api/chats',json={'workspace':workspace,'system_prompt':'Antworte auf Deutsch anhand der beigefügten freigegebenen Fakten. Keine Daten erfinden. /no_think'});chat.raise_for_status()
        start=time.monotonic();answer=client.post('/api/chats/'+chat.json()['id']+'/stream',json={'content':question,'include_hotel':workspace=='hotel','include_work':workspace!='hotel','max_tokens':96})
        answer.raise_for_status();events=[json.loads(line[6:]) for line in answer.text.splitlines() if line.startswith('data: ')]
        text=''.join(e.get('content','') for e in events if e.get('type')=='token')
        assert text and not any(e.get('type')=='error' for e in events),events
        if workspace=='hotel':assert '205' in text and ('ready' in text.lower() or 'frei' in text.lower()),text
        else:assert '1' in text or 'ein' in text.lower(),text
        print(json.dumps({'package':package,'engine':health.json()['engine'],'seconds':round(time.monotonic()-start,2),'answer':text},ensure_ascii=False))
