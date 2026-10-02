# WerkZ Time non-production HTTPS test server

This image runs the real `TimeApplication`, durable file repository, private evidence storage **and the mobile PWA on the same origin**. It is a device-test profile, not a production customer deployment.

## Required environment

- `WERKZ_TEST_SESSION_TOKEN`: random server-side session value
- `WERKZ_TEST_LOGIN_CODE`: temporary owner-only device login code
- `WERKZ_TEST_ALLOWED_ORIGIN`: optional additional cross-origin frontend, defaults to `https://project29212.websitepublisher.ai`
- `WERKZ_TEST_EXTERNAL_FRONTEND_URL`: optional redirect target after login; leave unset for the recommended same-origin PWA
- `WERKZ_TIME_DATA_DIR`: persistent private volume, defaults to `./var/time-test`

Never commit secret values.

## Recommended iPhone test flow

The Render service serves both frontend and API from one HTTPS origin, avoiding Safari third-party-cookie problems.

1. Open `https://API-HOST/test-login`.
2. Enter the temporary test code.
3. The server sets an HttpOnly/Secure same-site cookie and redirects to `https://API-HOST/`.
4. The PWA calls `/api/session`, `/api/time/commands` and `/api/time/evidence` on the same host.
5. Run Start → offline → note/photo → Stop → reload → reconnect.
6. Verify exactly-once sync, revision ordering and the uploaded photo.
7. Rotate the test code/session token and clear test data after acceptance.

Project 29212 remains available as an additional HTTPS frontend, but it is no longer required to prove the physical iPhone end-to-end flow.

## Endpoints

- `GET /` mobile WerkZ Time PWA
- `GET /healthz`
- `GET /api/session` and legacy `GET /session`
- `POST /api/time/commands` and legacy `POST /time/commands`
- `POST /api/time/evidence` and legacy `POST /time/evidence` multipart
- `GET|POST /test-login` non-production session bootstrap

Organisation and actor are resolved from the server session. Client tenant fields have no authority. Cross-origin access is restricted to the configured allowlist; same-origin requests are accepted automatically.

## Local run

```powershell
$env:WERKZ_TEST_SESSION_TOKEN = '<random>'
$env:WERKZ_TEST_LOGIN_CODE = '<temporary>'
docker compose -f deploy/time-test/compose.yaml up --build
```

## Render HTTPS target

`deploy/time-test/render.yaml` defines one Docker web service with Render TLS, a 1 GB persistent disk at `/data`, the existing Dockerfile, health check and automatic deployments disabled.

Render Starter with a persistent disk is an external paid resource. The owner must authorize/connect the Render account and approve any resulting charge. Runtime secrets belong only in Render encrypted environment settings.

After provisioning:
1. verify `GET /healthz`;
2. open `/test-login` and sign in;
3. verify the same-origin PWA at `/`;
4. run the full automated/physical acceptance;
5. optionally connect WebsitePublisher project 29212 by setting its `apiBase` to the verified Render origin and test cross-origin behavior separately.

The disk is not a backup. Use the Time backup/restore tool and retain backups outside the service. Never use real customer or employee data in this test tenant.
