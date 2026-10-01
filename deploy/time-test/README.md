# WerkZ Time non-production HTTPS backend

This image runs the real `TimeApplication`, durable file repository and private evidence storage. It is a device-test profile, not a production customer deployment.

## Required environment

- `WERKZ_TEST_SESSION_TOKEN`: random server-side session value
- `WERKZ_TEST_LOGIN_CODE`: temporary owner-only device login code
- `WERKZ_TEST_ALLOWED_ORIGIN`: defaults to `https://project29212.websitepublisher.ai`
- `WERKZ_TIME_DATA_DIR`: persistent private volume, defaults to `./var/time-test`

Never commit values. Put TLS in front of port 8080. The owner opens `https://API-HOST/test-login`, submits the temporary code, and is redirected to the WebsitePublisher test page. The session cookie is HttpOnly, Secure and cross-site compatible.

## Endpoints

- `GET /healthz`
- `GET /session`
- `POST /time/commands`
- `POST /time/evidence` multipart
- `GET|POST /test-login` non-production session bootstrap

CORS is restricted to the configured test origin. Organisation and actor are resolved from the server session. Client tenant fields have no authority.

## Run

```powershell
$env:WERKZ_TEST_SESSION_TOKEN = '<random>'
$env:WERKZ_TEST_LOGIN_CODE = '<temporary>'
docker compose -f deploy/time-test/compose.yaml up --build
```

Publish behind a persistent HTTPS reverse proxy, verify `/healthz`, then set the WebsitePublisher runtime config `apiBase` to that HTTPS origin. Do not register the proxy until that target exists and has passed the HTTP integration tests.
