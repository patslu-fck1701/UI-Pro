from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.web_routes import install_web_fallback

def test_canonical_entry_and_retired_pages_do_not_serve_app_shell():
    app = FastAPI()
    install_web_fallback(app)
    client = TestClient(app)
    for path in ('/index.html', '/app', '/hotel'):
        r = client.get(path + '?code=never-forward', follow_redirects=False)
        assert r.status_code == 308 and r.headers['location'] == '/'
    for path in ('/berater/', '/hub/', '/demo/', '/pilot/handwerk/', '/assistant-pwa/index.html'):
        r = client.get(path, headers={'Accept': 'text/html'})
        assert r.status_code == 410
        assert 'Zur aktuellen WerkZ-Anwendung' in r.text
        assert 'script' not in r.text and r.headers['cache-control'] == 'no-store'
    for path in ('/missing', '/brand/private-owner.jpg', '/api/unknown'):
        r = client.get(path)
        assert r.status_code == 404 and r.headers['cache-control'] == 'no-store'
        assert 'private-owner' not in r.text
    assert client.get('/api/unknown', headers={'Accept':'text/html'}).headers['content-type'].startswith('application/json')
    assert client.post('/pilot/login').status_code == 405
