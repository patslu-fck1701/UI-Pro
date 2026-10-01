# WerkZ Current Work

**State:** BLOCKED  
**Updated:** 2026-10-01  
**Baseline:** KB-v1.41
**Last verified Issue #3 branch commit:** `82b465626d3e87dc4405acbde032ad675262d360`  
**Draft PR:** #4 — https://github.com/patslu-fck1701/UI-Pro/pull/4

## One-time launch order

`docs/operations/CODEX_LAUNCH_ORDER.md`

Use this once to start Codex. Afterward use the persistent `weiter` protocol.

## Active issue

**#3 — Codex Next: commercial modules, entitlements, pricing catalog & Time productionization**

https://github.com/patslu-fck1701/UI-Pro/issues/3

## Objective

Turn the current reusable WerkZ Time/reference work into the next sellable product layer:

1. correct remaining WebsitePublisher-as-production assumptions;
2. preserve and finish Time feature consolidation;
3. build real module contracts;
4. build organisation-level entitlements;
5. build versioned commercial catalog + quote model;
6. seed configurable pricing/package presets;
7. build professional Chefmodus/Entscheider boundaries;
8. build generic notification/approval channel contracts before any real WhatsApp provider integration.

## Current evidence

Repository-visible prior Codex work already created:
- Time source precedence/consolidation docs;
- Time feature parity matrix;
- reusable time-tracking package/reference implementation.

Known next gaps include:
- gallery;
- correction/edit UI;
- odometer;
- IndexedDB/offline vault evaluation;
- product auth abstraction;
- server persistence;
- private photo storage;
- multi-device sync;
- entitlement/catalog layer.

## Canonical code baseline for phone-based Codex

Files Library:

`/WerkZ/Baseline/WerkZ.zip`

Do not wait for PC comparison.

## Latest verified progress

Issue #3 has implemented the commercial/module foundation on draft PR #4:
- module manifests + SKUs;
- organisation entitlements + guard/audit/suspend/reactivate;
- versioned catalog + editable presets;
- quote price snapshots;
- contract-to-entitlement mapping;
- optional management projection;
- generic NotificationPort/ApprovalChannel + idempotent local adapters.

Reported verification:
- CI success;
- 19/19 tests passed;
- lint/typecheck/build checks passed.

Remaining work:
- Time AuthPort/session boundary;
- server repository/persistence boundary;
- offline command queue + conflict semantics;
- private photo/document storage + gallery;
- correction/history;
- optional mileage;
- multi-device/cross-tenant integration tests;
- remove remaining WebsitePublisher production assumptions.

New integration research source:
`/WerkZ/Research/Werk_Z_Integrationsbericht_Oktober_2026.txt`

Use it to keep the connector boundary provider-neutral. Real provider adapters are the likely next package after Issue #3, not a reason to skip the remaining Time production work.

## Required completion state

Codex must finish issue #3 and then update this file to:

`DONE_NEEDS_NEXT_ORDER`

with:
- final commit SHA;
- test/build results;
- completed scope;
- remaining blockers;
- recommended next issue.

## When owner says "weiter"

Read:
1. `docs/operations/CODEX_RUNBOOK.md`
2. this file
3. `docs/operations/CURRENT_WORK.json`
4. active issue and latest commits

Then continue automatically.


## Continuation result — Time production domain

Verified branch commit: `82b465626d3e87dc4405acbde032ad675262d360`  
CI run: `36894530431` — success

Implemented:

- provider-neutral AuthPort, tenant TimeRepositoryPort and EvidenceStoragePort;
- tenant-keyed records and cross-tenant denial;
- optional order link and mileage;
- optimistic revisions and visible conflict errors;
- reasoned correction history with before/change evidence;
- private photo metadata and tenant gallery;
- offline command envelopes with exactly-once idempotency, retry state and conflict state;
- automated check that production Time source has no WebsitePublisher runtime tokens.

Verification: syntax passed; lint 13 files passed; runtime contract/type check 7 modules passed; tests 27/27 passed; npm audit reported 0 vulnerabilities.

Remaining: durable SQLite/server adapter, real object upload/storage, PWA IndexedDB/mobile UI, HTTP/multi-device integration tests, Library ZIP reconciliation and PR #4 review/merge.

Next block: continue Issue #3 with durable adapters and HTTP-neutral integration tests.

## Next continuation — durable adapters + PWA

Codex should continue Issue #3 from branch commit `82b465626d3e87dc4405acbde032ad675262d360` with:
- durable Time repository with restart/idempotency persistence;
- durable private evidence/object storage;
- transport-neutral application boundary;
- concurrent-device and cross-tenant integration tests;
- browser/IndexedDB offline queue adapter;
- minimal generic mobile/PWA Time reference surface;
- provider-neutral connector/SecretStore/webhook/sync contracts only.

Do not start real provider APIs until Issue #3 is complete.

## Temporary blocker — Codex usage limit

Development is temporarily paused because the current Codex usage limit has been reached. This is **not** a technical/product blocker and does not change the implementation plan.

Resume rule:
- when Codex usage becomes available again and the owner says `weiter`, read RUNBOOK + CURRENT_WORK and continue Issue #3 from the last verified branch commit;
- do not create a new issue merely because of this temporary quota pause;
- do not mark Issue #3 done.

## Cross-cutting foundations added from 2026-10-01 research

These requirements now apply to the active Issue #3 continuation and every later work package:

- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- `docs/integrations/INTEGRATION_STRATEGY.md`

Important consequence for the remaining Issue #3 work:
- durable Time persistence/storage must preserve tenant isolation, revision/idempotency semantics, backup/restore and secret-safe logging;
- PWA/offline work must not make browser storage the production system of record;
- any new local connector/agent code must follow outbound-only/least-privilege/no-remote-shell constraints and use device enrollment rather than embedded customer secrets;
- provider-specific APIs remain out of scope until generic SecretStore/OAuth/webhook/queue/mapping primitives exist;
- production-readiness claims remain blocked until the security/privacy/commercial-readiness gates are satisfied.

Source research is stored in the connected Files Library and mirrored through the repository foundation docs; chat is not the only record.


## Commercial pricing model v2

The earlier small per-module monthly price seed is superseded as the commercial source of truth.

Canonical direction:
- public entry/setup: Solo from €490, Team from €1,490, Business from €2,490;
- realistic project ranges may be materially higher depending on scope;
- managed operation: Solo from €79/month, Team from €179/month, Business from €349/month;
- modules remain technical entitlements, not a public €9/€19/€29 price list;
- solution scope and deployment are separate axes;
- deployment choices: Managed Cloud, Dedicated Cloud, Hybrid + Connector, suitable existing customer hardware, WerkZ Box, Dedicated/On-Premise;
- existing customer infrastructure must be assessed before proposing new hardware;
- a WerkZ-supplied box is procured only after order, with hardware, procurement/handling, provisioning and ongoing management shown separately;
- self-managed handover remains possible without an artificial mandatory subscription; support/security/updates are then separately contracted.

Canonical document:
`docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md`

Active Issue #3 branch also contains:
`config/catalog/werkz-v0.2.json`

**Merge guard:** PR #4 must not ship the v0.1 €9/€19/€29 module price seed as the canonical public/commercial model. Codex must migrate quote/catalog behavior to v0.2 while preserving module entitlements and versioned quote snapshots.


## KB-v1.41 commercial/security/customer-operation consolidation

Before continuing or merging Issue #3, also read:
- `docs/knowledge/BUSINESS_SECURITY_CUSTOMER_OPERATION_MASTER.md`
- `docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md`
- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- `docs/integrations/INTEGRATION_STRATEGY.md`

Additional guards:
- no permanent free/basic production tier;
- v0.1 small module prices are historical seed values only and must not become public/canonical again;
- pricing v0.2 must preserve setup + managed-operation + deployment/infrastructure logic;
- implementation must support cloud-first and optional connector/local/on-prem paths without coupling Solo/Team/Business to a deployment type;
- first regular paid production customer remains blocked until auth/persistence/private storage/tenant isolation/backup-recovery and contract/privacy readiness are demonstrably in place;
- public compliance wording must describe actual controls, not blanket GDPR/NIS2/C5 certification claims.

2026 priority:
October–December is a controlled customer-readiness phase: finish production foundations, legal/privacy package, demo/onboarding/acceptance/support flow, then run end-to-end dry-runs and only sell scopes that can actually be supported.
