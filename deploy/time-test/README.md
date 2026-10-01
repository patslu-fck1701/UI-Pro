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

## Concrete persistent HTTPS target: Render

`deploy/time-test/render.yaml` defines one Docker web service with Render TLS, a 1 GB persistent disk mounted at `/data`, the existing Dockerfile, an HTTPS health check and automatic deployments disabled. Render Starter with disk is a paid external account resource; this repository cannot create the account, authorize billing or store its secret values. Do not deploy this publicly until the owner has reviewed the plan and supplied two independent high-entropy runtime values through Render's encrypted environment settings.

1. In an owner-controlled Render account, create a Blueprint from this repository and select `deploy/time-test/render.yaml`. Restrict access to the test service and review the paid disk/plan before confirming it.
2. Generate `WERKZ_TEST_SESSION_TOKEN` and `WERKZ_TEST_LOGIN_CODE` separately with a cryptographic random generator. Enter them only in Render's secret environment fields. Never put them into Git, URLs, browser JavaScript, screenshots or issue comments.
3. Confirm the persistent disk is mounted at `/data`. The service must run as one instance while using the file-backed repository. The disk is not a backup; use the Time backup/restore tool and retain backups outside the service.
4. Record the assigned `https://…onrender.com` origin privately. Check `GET /healthz` (200), then open `/test-login` and use the temporary code. Check `GET /session` in the browser developer tools and the CORS response from the project-29212 origin.
5. Run the complete command/multipart/replay/tenant and iPhone tests. Only after the HTTPS API passes, set `apiBase` in project 29212's existing `config/werkz-time-test.json` asset to the HTTPS origin. Keep project 23947 separate.
6. Rotate both runtime values and clear test records after the acceptance run. Never put real customer or employee data into this non-production tenant.

**Safari risk:** The WebsitePublisher frontend and Render API are cross-site. Safari may block the `SameSite=None; Secure` test cookie even when CORS is correct. Test this on the physical iPhone before treating the setup as accepted. If blocked, route the API through a verified same-origin proxy that supports binary multipart, or host the test frontend and API under controlled same-site subdomains. Do not silently switch to a browser-embedded long-lived secret.

The project-29212 config remains `apiBase: null` until an actual HTTPS service URL exists and has passed these checks. This Blueprint is deployment preparation, not evidence that a service is running.
