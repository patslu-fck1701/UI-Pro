"""Run separately: synthetic cloud-boundary smoke, no real data or network."""
import os
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as tmp:
    os.environ.update(WERKZ_AI_DATA=tmp,WERKZ_AI_PACKAGE='hotel-demo',WERKZ_AI_MODE='demo',WERKZ_ONLINE_TEST='1',RENDER_EXTERNAL_HOSTNAME='hotel-test.onrender.com')
    from fastapi.testclient import TestClient
    from backend.app import app
    from backend.db import engine
    origin='https://hotel-test.onrender.com'
    try:
        with TestClient(app,base_url=origin) as first, TestClient(app,base_url=origin) as second:
            assert first.get('/api/health').json()['onlineTest'] is True
            assert first.get('/api/setup').json()=={'required':False}
            assert first.post('/api/setup',headers={'Origin':origin},json={'username':'synthetic','password':'synthetic-only'}).status_code==403
            assert first.get('/api/hotel/snapshot').status_code==401
            assert first.post('/api/hotel/demo/start',headers={'Origin':'https://wrong.invalid'},json={'role':'management'}).status_code==403
            assert first.get('/api/health',headers={'Host':'wrong.invalid'}).status_code==400
            a=first.post('/api/hotel/demo/start',headers={'Origin':origin},json={'role':'management'})
            b=second.post('/api/hotel/demo/start',headers={'Origin':origin},json={'role':'reception'})
            assert a.status_code==b.status_code==200,(a.text,b.text)
            assert a.json()['tenant']!=b.json()['tenant']
            assert all('Secure' in h and 'HttpOnly' in h and 'SameSite=strict' in h for h in a.headers.get_list('set-cookie'))
            assert first.get('/api/hotel/snapshot').status_code==200
            assert second.get('/api/hotel/snapshot').status_code==200
            assert first.get('/api/modules').json()['modules']['deutschz_ai'] is False
            assert first.get('/api/health').headers['strict-transport-security']
        print('PASS: cloud health, setup lock, auth, origin/host, secure cookies, two visitors/roles, scoped modules')
    finally:
        engine.dispose()
