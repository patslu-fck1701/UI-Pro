"""One application entry; retired pages must never become another SPA shell."""
from fastapi import Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

RETIRED = {'berater', 'hub', 'demo', 'pilot', 'zeit', 'assistant', 'advisor',
           'customer-advisor', 'assistant-pwa', 'advisor-pwa', 'simple-showcase'}

def install_web_fallback(app):
    @app.get('/index.html', include_in_schema=False)
    @app.get('/app', include_in_schema=False)
    @app.get('/hotel', include_in_schema=False)
    def canonical_entry():
        return RedirectResponse('/', status_code=308, headers={'Cache-Control': 'no-store'})

    @app.get('/{missing:path}', include_in_schema=False)
    def missing_page(missing: str, request: Request):
        # API typos and private image paths never receive the application HTML.
        retired = missing.split('/', 1)[0] in RETIRED
        status = 410 if retired else 404
        if missing.startswith('api/') or 'text/html' not in request.headers.get('accept', ''):
            return JSONResponse({'detail': 'Seite nicht mehr verfügbar.' if retired else 'Nicht gefunden.'},
                                status_code=status, headers={'Cache-Control': 'no-store'})
        title = 'Diese alte Testseite wurde entfernt.' if retired else 'Diese Seite wurde nicht gefunden.'
        return HTMLResponse('<!doctype html><html lang="de"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>WerkZ Digital</title><main><h1>' + title + '</h1>'
            '<p><a href="/">Zur aktuellen WerkZ-Anwendung</a></p></main></html>',
            status_code=status, headers={'Cache-Control': 'no-store',
                'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"})
