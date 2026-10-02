# WebsitePublisher HTTPS test host — WerkZ Time

**Status:** live device-test frontend prepared by ChatGPT on 2026-10-01  
**Purpose:** HTTPS/iPhone/browser test host only. This is NOT the production WerkZ runtime or source of record.

## Projects

### Test host — use this
- WebsitePublisher project: **29212**
- Name: `WerkZ Zeitnachweis`
- HTTPS origin: `https://project29212.websitepublisher.ai`
- Device test page: `https://project29212.websitepublisher.ai/werkz-time-test.html`
- Plan: Starter
- Capacity before this test setup: 7/30 pages, 1/300 assets
- This test setup added one page and six small assets. Plenty of room remains.

### Main company/marketing site — do NOT use for Time test runtime
- WebsitePublisher project: **23947**
- HTTPS origin: `https://project23947.websitepublisher.ai`
- Current plan pressure at audit time: 29/30 pages used.
- Keep this project for public WerkZ marketing, pricing, pre-check/detail-check and company information.

## Live test assets

- JS:
  `https://cdn.websitepublisher.ai/custom/wid29212/werkz-test/app.js`
- CSS:
  `https://cdn.websitepublisher.ai/custom/wid29212/werkz-test/styles.css`
- Manifest:
  `https://cdn.websitepublisher.ai/custom/wid29212/werkz-test/manifest.json`
- Icon:
  `https://cdn.websitepublisher.ai/custom/wid29212/werkz-test/icon.svg`
- Runtime test config:
  `https://cdn.websitepublisher.ai/custom/wid29212/config/werkz-time-test.json`

The config is intentionally:
- `mode: local-device-test`
- `apiBase: null`

Do not claim backend sync until `apiBase` is intentionally connected and verified.

## What the live page already does

The WebsitePublisher device-test page is intentionally self-contained and contains no production customer data.

It currently verifies/implements:
- HTTPS page delivery;
- responsive iPhone-oriented UI;
- IndexedDB;
- local stable Time IDs;
- local start/stop;
- local notes/correction;
- mileage;
- photo capture/file input;
- binary Blob storage in IndexedDB (no Base64);
- SHA-256 photo hash;
- 20 MB photo cap;
- explicit monotonically increasing command `sequence`;
- per-entity `causationId` link between queued commands;
- visible ordered queue;
- local history;
- local test-data deletion.

This frontend deliberately does NOT pretend that commands are server-synced.

## WebsitePublisher platform capabilities already checked

Project 29212 has:
- HTTPS publishing;
- static assets;
- `tenant_auth` integration available/configured;
- `api-proxy` integration available;
- no API proxy endpoints registered yet.

The API proxy can forward to an external **HTTPS** API endpoint and can keep target credentials in WebsitePublisher vault. Do not assume it supports multipart/photo proxy semantics until tested against the actual backend.

Tenant Auth is configured globally with:
- email OTP and password methods;
- provisioned-members-only;
- rotating access/refresh token model.

Do not couple WerkZ production auth to WebsitePublisher tenant_auth. It may be used for a test portal if needed, but the production architecture remains WebsitePublisher-independent.

## Backend contract Codex must finish

The live test page is the browser/phone host. Codex should now finish the backend/API side.

Preferred test API shape remains compatible with the current Time PWA contracts:

### Session
`GET /session`

Return authenticated server-derived identity, e.g.:
```json
{
  "organisationId": "org-test",
  "actorId": "user-test",
  "capabilities": ["time.use", "time.correct"]
}
```

Identity must not be accepted from arbitrary client-supplied organisation/user fields.

### Commands
`POST /time/commands`

Body:
```json
{
  "operation": "time.start | time.stop | time.correct | time.list | time.get | time.gallery",
  "input": {}
}
```

Use existing `TimeApplication` and stable application DTO/error codes.

### Evidence
`POST /time/evidence`

Multipart:
- `timeRecordId`
- `idempotencyKey`
- `mime`
- `size`
- `hash`
- binary `file`

Map to `TimeApplication.uploadEvidence`.

## Before connecting the live WebsitePublisher page

Codex must first finish the two correctness gates already recorded in CURRENT_WORK:

1. **Service-worker cache boundary**
   - API/session/operational responses must never be cached.
   - Static shell allowlist only.

2. **Offline ordering + revision chaining**
   - deterministic sequence;
   - start -> edit/photo -> stop order;
   - causation/revision propagation;
   - no silent stale overwrite;
   - full automated offline-chain tests.

The WebsitePublisher device-test page already uses explicit local sequence + causation as a reference. Align the repo PWA behavior with that principle rather than copying blindly.

## HTTPS backend requirement

WebsitePublisher is the HTTPS **frontend host**.

It does not currently provide a custom Node runtime for the existing WerkZ TimeApplication code.

Therefore Codex must provide an HTTPS-reachable non-production test API for the routes above, using a deployment method available in the Codex environment.

Rules:
- no production customer data;
- no hard-coded secrets in browser code;
- no WebsitePublisher credentials committed to GitHub;
- test tenant only;
- CORS/same-origin strategy must be explicit.

Once an HTTPS backend URL exists:
1. register WebsitePublisher `api-proxy` only if its request/response/body semantics fit;
2. otherwise call the backend directly over HTTPS with a controlled CORS policy;
3. update the WebsitePublisher test config asset `config/werkz-time-test.json` with the verified API base;
4. adapt the live test JS only after API behavior is verified;
5. perform the physical iPhone/browser test.

## Physical device acceptance flow

Use:
`https://project29212.websitepublisher.ai/werkz-time-test.html`

Acceptance:
1. open on iPhone;
2. start time;
3. add note;
4. capture photo;
5. stop time;
6. repeat with network interrupted once backend sync is connected;
7. reconnect;
8. commands execute exactly once in sequence;
9. revisions remain correct;
10. photo uploads as binary multipart;
11. no API/session response is available from service-worker cache;
12. wrong tenant cannot read Time/evidence.

## Important boundary

WebsitePublisher remains:
- test/public frontend infrastructure;
- company/marketing website;
- intake/pre-check tooling.

It is NOT the production WerkZ data store or authoritative backend.


## Implemented backend/client checkpoint — 2026-10-01

Repository commit `cb2d882d10165995cb380afcbf1dae280f2e8f02` now provides:
- real server-derived `GET /session`;
- real `POST /time/commands`;
- real multipart `POST /time/evidence`;
- durable Time/evidence adapters;
- explicit CORS allowlist;
- a container-ready non-production server under `deploy/time-test`;
- automated HTTP, tenant-isolation, multipart, service-worker and complete offline-chain tests;
- a repository snapshot of the live 29212 sync client under `deploy/websitepublisher-29212`.

The live project-29212 client was upgraded in place to perform ordered command sync, revision propagation, explicit conflicts and binary multipart upload when `apiBase` is present. It remains safely disconnected while `apiBase` is null.

Live API Proxy inspection found zero registered endpoints. A proxy cannot be registered safely until an external HTTPS target exists. Multipart support is not assumed; the prepared direct API supports controlled CORS.

External infrastructure blocker: the connected tools cannot provision a persistent public Node HTTPS runtime or its runtime-only secrets. Do not place those values in GitHub or the WebsitePublisher browser config.


## Physical iPhone acceptance — PASSED

Accepted by the owner on a real iPhone on 2026-10-02.

Verified on the live non-production acceptance host:

- Render HTTPS host: `https://werkz-time-device-test.onrender.com`
- same-origin session/login flow works in Safari;
- Time entry can be started and the live timer runs;
- offline state is shown and queued changes are retained;
- note/photo/mileage/stop workflow is usable on the device;
- reconnect/synchronisation completes successfully;
- history renders the running/completed entries;
- camera/file picker path is usable;
- Add to Home Screen works;
- WerkZ Home Screen icon is installed successfully;
- final UI theme uses anthracite/translucent panels with neon-green accents.

Owner acceptance statement: the tested flow works completely. Issue #3's physical-device acceptance gate is therefore satisfied.

The Render service remains non-production acceptance infrastructure. This result does not convert the free filesystem into production durability or authorize real customer data.
