# WerkZ Codex Resume — current authoritative checkpoint

**Date:** 2026-10-01  
**Baseline:** KB-v1.41  
**Owner signal:** Codex usage is available again.  
**Active issue:** #3  
**Active draft PR:** #4  
**Active work branch:** `codex/issue-3-commercial`

This file is the immediate continuation checkpoint for the owner's normal command:

`weiter`

Do not ask what to do next. Follow this file, `CODEX_RUNBOOK.md`, and `CURRENT_WORK.md/json`.

## 1. What is actually verified

Last CI-verified Issue #3 implementation commit:

`82b465626d3e87dc4405acbde032ad675262d360`

Verified evidence:
- GitHub Actions run `36894530431`: success;
- 27/27 tests passed;
- syntax/build check passed;
- lint passed for 13 JS files;
- runtime contract/type check passed for 7 modules;
- npm audit: 0 vulnerabilities.

Implemented and verified:
- module manifests and organisation entitlements;
- server-side entitlement denial / suspend / reactivate;
- quote price snapshots and contract-to-entitlement mapping;
- optional management projection;
- generic local ApprovalChannel / NotificationPort;
- Time AuthPort;
- tenant-scoped TimeRepositoryPort;
- EvidenceStoragePort;
- tenant isolation;
- optimistic revisions and explicit conflicts;
- correction history;
- optional mileage;
- private photo metadata + tenant gallery;
- offline command idempotency/retry/conflict state;
- explicit absence of WebsitePublisher runtime tokens in production Time source.

Not yet verified/implemented as production:
- durable server repository;
- durable object bytes/storage;
- restart persistence;
- transport/application boundary;
- real browser IndexedDB queue;
- PWA/mobile generic Time surface;
- HTTP/network integration tests;
- real multi-device transport;
- real provider integrations;
- production deployment.

## 2. Branch freshness problem — FIRST ACTION

Current comparison at checkpoint:
- `main` tip at audit time: `a9747f71957e5bcc980a5c7b7f55889332440f81`;
- `codex/issue-3-commercial` was 12 commits ahead and 35 commits behind main;
- the branch contains Issue #3 implementation plus `config/catalog/werkz-v0.2.json`;
- main contains newer KB-v1.41 commercial/security/deployment/integration/control-plane decisions.

Therefore the FIRST implementation action is:

1. fetch latest `main`;
2. inspect `main...codex/issue-3-commercial`;
3. merge/rebase the active branch onto current main without dropping Issue #3 code;
4. resolve control-plane/document conflicts in favor of the newest KB-v1.41 rules while preserving verified implementation code;
5. rerun `npm run verify` before adding new code.

Do not continue from the stale branch control-plane files without this synchronization.

Do not force-push or rewrite verified history unnecessarily. Prefer a safe merge if rebasing would make recovery/review harder.

## 3. Commercial migration gate — before PR #4 can merge

The old v0.1 catalog is now historical seed data only.

Canonical commercial direction:
- no permanent Free/Basic production tier;
- Solo setup from €490;
- Team setup from €1,490;
- Business setup from €2,490;
- managed operation from €79 / €179 / €349 per month;
- modules remain technical entitlements, not a public €9/€19/€29 module menu;
- deployment is a separate pricing axis;
- Cloud / Dedicated / Hybrid Connector / existing hardware / WerkZ Box / On-Premise must remain representable;
- hardware is separate from provisioning/management;
- no new hardware before infrastructure assessment and order.

Current code defect:
- `config/catalog/werkz-v0.2.json` exists on the Issue #3 branch;
- `src/commercial/catalog.js` still expects the v0.1 `items + presets` shape;
- `test/commercial-modules.test.js` still imports v0.1 and verifies old module prices.

Required migration:
1. make v0.2 loadable by the production catalog model;
2. preserve versioned quote snapshots;
3. preserve independent module entitlements;
4. separate priceable offer lines from entitlement activation;
5. keep v0.1 only as historical/migration fixture where useful;
6. add tests proving no Free tier and no canonical public small-module pricing;
7. add tests for setup + managed operation + deployment quote composition;
8. do not silently convert Solo/Team/Business into technical editions.

Do not merge PR #4 until this migration passes.

## 4. Block A — durable Time persistence

Implement a genuinely durable adapter for `TimeRepositoryPort`.

Preferred decision rule:
- use SQLite only if it is reliable in the current Node/CI workflow;
- otherwise first implement an atomic file-backed durable reference adapter and document the later SQLite/PostgreSQL production adapter;
- never label an in-memory adapter durable.

Persist across adapter restart:
- time records;
- revisions;
- correction history;
- idempotency results/keys required for exactly-once behavior.

Tests:
- create -> destroy adapter -> recreate -> record exists;
- duplicate idempotency key after restart does not duplicate;
- stale revision still conflicts after restart;
- tenant separation survives restart.

## 5. Block B — durable private evidence/object storage

Implement a durable local/private reference adapter behind `EvidenceStoragePort`.

Requirements:
- actual object bytes stored outside business records;
- tenant/owner/time-record metadata;
- MIME, size, hash, object key;
- hash/size validation;
- tenant-scoped reads;
- safe file/object naming;
- idempotent retry behavior;
- restart persistence;
- no base64 blob in Time record;
- no secret/private content in audit logs.

Tests:
- upload fixture -> restart -> bytes + metadata available;
- wrong tenant cannot access;
- retry does not create uncontrolled duplicate;
- corrupted/hash-mismatched input rejected deterministically.

## 6. Block C — transport-neutral application boundary

Add an application/use-case layer above the Time domain.

Responsibilities:
- resolve authenticated session;
- validate command/query DTO;
- call domain service;
- return serializable DTO;
- map domain errors to stable application error codes;
- keep HTTP/framework details outside domain.

Support at least:
- start;
- stop;
- correct;
- get/list;
- add/upload evidence;
- gallery;
- sync offline command.

Do not add Express/Fastify merely to satisfy this issue.

Audit gap to fix:
Current Time code audits start but does not yet consistently emit equivalent audit events for stop, correction, evidence upload and rejected/conflicting mutations. Make audit reconstruction complete without logging secrets/object bytes.

## 7. Block D — concurrent-device and cross-tenant integration tests

Using durable adapters:
- two sessions in same org read revision 1;
- client A writes revision 2;
- client B writes from revision 1 -> explicit conflict;
- server state is deterministic after restart;
- identical-looking entity IDs in two tenants never cross-read/write;
- idempotency survives restart;
- private evidence remains tenant-scoped.

## 8. Block E — browser offline persistence / PWA

After Blocks A-D pass, continue in the SAME issue.

Create `OfflineQueuePort`.

Implement IndexedDB adapter if practical. If Node CI cannot directly run IndexedDB:
- define an IndexedDB driver boundary;
- unit-test with deterministic fake driver;
- keep the browser adapter exact enough to wire later.

Persist:
- command id;
- idempotency key;
- organisation/actor context;
- entity + expected revision;
- payload;
- local timestamp;
- attempts;
- error;
- status: queued/syncing/synced/failed/conflict.

Rules:
- browser state is not the production system of record;
- do not rely on permanent iOS background execution;
- conflict remains visible after reload.

Minimal generic mobile Time surface:
- session/current user;
- start/running timer/finish;
- optional customer/order;
- note;
- photo capture hook;
- optional mileage;
- day/history;
- offline/sync/conflict indicator;
- correction action with permission;
- no Gabriel-specific private/default employer data except fixtures;
- no fake production backend.

PWA shell if safe:
- manifest;
- installable shell;
- offline static shell/service worker.

## 9. Block F — provider-neutral integration foundation contracts only

After synchronization, honor:
- `docs/integrations/INTEGRATION_STRATEGY.md`
- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`

Add code contracts only if absent:
- Connector;
- SecretStore / CredentialReference;
- IntegrationAccount;
- WebhookSubscription;
- SyncJob;
- SyncCursor;
- IntegrationEvent;
- MappingProfile;
- ConnectorHealth.

Required principles:
- provider classes never leak into Core/domain modules;
- global WerkZ credentials and per-customer credentials are separate;
- no plaintext customer secrets in normal DB/logs;
- webhook verification hook -> tenant resolution -> persist metadata -> fast acknowledgement boundary -> queue -> retry/idempotency;
- no live Microsoft/Google/WhatsApp/DATEV API implementation in Issue #3.

## 10. Baseline ZIP reconciliation

Attempt to materialize:
`/WerkZ/Baseline/WerkZ.zip`
library id:
`libfile_356b20f709588191905c43ed43edd7c4`

The earlier runtime could not materialize it. Try once in the current Codex workspace now that a new session is available.

If materialization works:
- compare intentionally;
- do not overwrite newer verified GitHub work blindly;
- document meaningful deltas.

If the Files workspace is still unavailable:
- record that exact external tooling limitation;
- do not block safe GitHub work that is independently verifiable.

## 11. PR #2 / PR #4

PR #4 contains the Core slice needed by Issue #3. PR #2 is still open.

Before final merge:
- inspect whether PR #2 is fully superseded by PR #4;
- do not merge both blindly and duplicate/replay code;
- document the decision;
- PR #4 remains draft until Issue #3 completion gates pass.

## 12. Issue #3 completion gate

Issue #3 becomes `DONE_NEEDS_NEXT_ORDER` only when:
- branch is synchronized with current main;
- commercial catalog/quote behavior is migrated to v0.2;
- all old v0.1 public-price assumptions are removed from active behavior;
- durable Time repository + restart/idempotency test pass;
- durable private object storage + restart/tenant tests pass;
- transport-neutral application boundary exists;
- concurrent-device/cross-tenant tests pass;
- browser queue persistence exists or is explicitly deferred with exact technical reason and contract;
- generic PWA Time surface is present if feasible;
- no WebsitePublisher production runtime dependency exists;
- provider-neutral integration contracts obey security/deployment foundations;
- all available build/test/lint/typecheck/audit jobs pass;
- PR #4 is updated;
- `CURRENT_WORK.md/json` record final verified SHA and evidence;
- Issue #3 gets a completion comment with exact evidence.

Do not start live provider APIs before Issue #3 is complete.

## 13. Next package after Issue #3

Recommended next issue:

**WerkZ Integration Foundation v1**

Scope:
1. replaceable SecretStore implementation;
2. OAuth connection/account lifecycle;
3. webhook gateway;
4. durable queue/retry/idempotency worker;
5. mapping/normalization engine;
6. connector health/observability;
7. then first real adapters, after fresh provider-doc verification:
   - Microsoft 365;
   - Google Workspace;
   - WhatsApp Business.

Deployment/customer-agent implementation then follows the same security foundation:
- device enrollment;
- outbound-preferred connection;
- least privilege;
- signed installer/update;
- revocation;
- no embedded customer secrets;
- Cloud / Hybrid / WerkZ Box / On-Premise remain deployment choices, not separate products.

## 14. Meaning of owner saying only "weiter"

When the owner says `weiter`:
1. read latest `main:docs/operations/CODEX_RUNBOOK.md`;
2. read latest `main:docs/operations/CURRENT_WORK.json`;
3. read latest `main:docs/operations/CURRENT_WORK.md`;
4. read this file;
5. read active Issue #3 and newest comments;
6. inspect main vs active branch;
7. synchronize branch;
8. run verification;
9. execute the next incomplete block automatically;
10. persist progress before stopping.

Do not ask the owner to restate this plan.
