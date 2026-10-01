# WerkZ Codex Runbook — "weiter" protocol

**Purpose:** Make WerkZ development resumable without relying on chat history.

## Single control plane

Repository: `patslu-fck1701/UI-Pro`

Every Codex/agent session starts from the **latest files on `main`**, even when the implementation work happens on another branch:

1. `main:docs/operations/CODEX_RUNBOOK.md` — this protocol.
2. `main:docs/operations/CURRENT_WORK.json` — machine-readable pointer/state.
3. `main:docs/operations/CURRENT_WORK.md` — human-readable current state.
4. `main:docs/operations/CODEX_RESUME_NOW.md` when present — current exact continuation checkpoint.
5. GitHub issue referenced by `CURRENT_WORK.md/json`, including newest comments.
6. Compare `main` with the active implementation branch before editing code.
7. Recent commits after the recorded last verified implementation commit.

A branch-local copy of CURRENT_WORK may be stale. The latest `main` control plane wins.

Do not infer the current task from old chat messages when these files exist.

## Meaning of "weiter"

When the owner says only **"weiter"**:

1. Read latest `main:CURRENT_WORK.json`.
2. Read latest `main:CURRENT_WORK.md`.
3. Read `main:CODEX_RESUME_NOW.md` if present.
4. Open the referenced active GitHub issue and newest comments.
5. Inspect recent repository commits after the recorded last verified implementation commit.
6. Compare latest `main` against the active work branch. If the branch is behind, synchronize it safely before new implementation and rerun verification.
7. If status is `IN_PROGRESS`, continue the current work package.
6. If status is `READY_FOR_REVIEW`, verify tests/results and close gaps.
7. If status is `DONE_NEEDS_NEXT_ORDER`, derive the next work package from:
   - completed work;
   - blockers;
   - architecture docs;
   - product/commercial priorities;
   - current connected-source evidence.
8. Create the next GitHub issue.
9. Update both CURRENT_WORK files to point to the new issue.
10. Continue implementation if safe and authorized.

No user prompt should be needed merely to rediscover where the work lives.

## Canonical accessible code baseline for phone-based Codex

Files Library:

`/WerkZ/Baseline/WerkZ.zip`

Library file id:

`libfile_356b20f709588191905c43ed43edd7c4`

Phone-based Codex cannot inspect the owner's PC. Do not ask for a PC comparison as a prerequisite.

## Persistent source roles

### GitHub
Canonical for:
- source code;
- architecture docs;
- current work pointer;
- Codex orders/issues;
- tests;
- commits;
- technical decisions.

### Files Library
Canonical accessible archive baseline and handoff binaries.

### Google Drive
Human-readable knowledge mirror, business/context documents and cross-system handoff index.

### WebsitePublisher
Public website/reference surface only. Not the operational WerkZ product runtime.

## Work-package rule

Each substantial Codex work package gets its own GitHub issue.

Issue body must contain:
- objective;
- exact source references;
- in-scope work;
- out-of-scope work;
- acceptance tests;
- persistence/backup expectations;
- completion protocol.

Do not reuse a finished issue for unrelated work.

## Completion protocol — mandatory

Before Codex considers a work package complete:

1. Run all available:
   - tests;
   - build;
   - lint;
   - typecheck.
2. Record exact results.
3. Commit work in meaningful increments.
4. Update relevant architecture/docs.
5. Update `CURRENT_WORK.md`.
6. Update `CURRENT_WORK.json`.
7. Add a concise completion comment to the active issue containing:
   - final commit SHA;
   - what changed;
   - test results;
   - blockers;
   - recommended next package.
8. Set current work state to:
   - `DONE_NEEDS_NEXT_ORDER` if finished;
   - `BLOCKED` if external input is genuinely required;
   - `IN_PROGRESS` if not finished.

## How the next order is generated

When the owner says "weiter" after a completed package:

The next agent must inspect, in this order:

1. `CURRENT_WORK.json`
2. active/just-finished issue
3. latest commits
4. completion comment
5. relevant architecture/testing docs
6. current external/provider information if the next task depends on changing APIs/prices/rules

Then create a NEW issue and point CURRENT_WORK to it.

## Documentation discipline

Do not create a new KB number merely because a task was documented.

Create/update a semantic baseline only when there is a material architecture/product/governance change.

## Destructive changes

Before deletion use:
- KEEP
- MERGE
- ARCHIVE
- REMOVE

Never delete merely to reduce a plan limit.

## Phone workflow

Because the owner often works from the phone:

- every required source path must be written into the active issue;
- no instruction may depend on remembering a local PC path;
- every result must be persisted in GitHub/Files/Drive as appropriate;
- chat is coordination, not the only record.

## Cross-cutting foundations — always apply

These are not optional issue-specific notes. Every implementation package must preserve them:

- `docs/security/SECURITY_PRIVACY_FOUNDATION.md` — identity, tenant isolation, secrets, audit, backup/retention, incident response, connector security and commercial-readiness gates.
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md` — cloud-first/agent-optional deployment, enrollment, packaging/signing, release/update and onboarding model.
- `docs/integrations/INTEGRATION_STRATEGY.md` — provider-neutral connector, OAuth/secret/webhook/queue/mapping model.

Before introducing a new runtime dependency, provider, customer-side agent, credential store, installer, background worker or production data path, check the change against all three foundations.

Do not weaken these baselines merely to make a demo work. If a work package cannot yet satisfy a production gate, keep the implementation explicitly non-production and record the gap.


## Active-branch freshness rule

The persistent control plane lives on `main`; implementation may live on a feature branch.

Before new implementation:
- fetch latest main;
- compare main and active branch;
- if main contains newer architecture, commercial, security, deployment, integration or control-plane decisions, bring them into the active branch first;
- preserve already verified implementation commits;
- prefer a reviewable safe merge when a history rewrite/rebase would add unnecessary recovery risk;
- rerun the existing verification suite immediately after synchronization.

Never continue for hours on a stale branch merely because its branch-local CURRENT_WORK file says IN_PROGRESS.

## Commercial migration guard

The current canonical pricing direction is v0.2.

- no permanent Free/Basic production tier;
- v0.1 small per-module prices are historical seed/test data only;
- no PR may merge active commercial behavior that re-establishes those values as canonical/public pricing;
- module entitlements remain independent from priceable offer lines;
- setup, managed operation and deployment/infrastructure must remain separately representable.

See:
- `docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md`
- `docs/knowledge/BUSINESS_SECURITY_CUSTOMER_OPERATION_MASTER.md`
- `docs/operations/CODEX_RESUME_NOW.md`

## Mandatory licensing/IP protection foundation

For any work touching commercial entitlements, authentication/tenant authority, connector installation, local Agent identity, packaging, updates, On-Prem/offline deployment or production rollout, also read:

- `docs/security/LICENSING_IP_PROTECTION_FOUNDATION.md`
- Issue #5: https://github.com/patslu-fck1701/UI-Pro/issues/5

Do not treat minification/obfuscation as access control. Do not embed reusable licence/signing secrets. A copied frontend or Agent directory must not become a valid customer deployment without server-side entitlement or device-enrollment authority.

The public/private repository policy is a release-governance decision: never commit real customer/provider/signing secrets even if repository visibility changes later.

## Mandatory product-security lifecycle foundation

For work touching production release, Agent/On-Prem distribution, security incidents, AI-assisted product features, enterprise identity, support access or recovery, also read:

- `docs/security/PRODUCT_SECURITY_LIFECYCLE_COMPLIANCE_FOUNDATION.md`
- Issue #6: https://github.com/patslu-fck1701/UI-Pro/issues/6

Required operating rules:
- vulnerability handling is a lifecycle process;
- support/EOL metadata is part of the product model;
- CRA/AI/NIS2/GDPR applicability is assessed by scope, not advertised as a blanket claim;
- AI transparency state is preserved where applicable;
- enterprise identity remains OIDC/SAML/SCIM-capable;
- support access is temporary/scoped/audited;
- restore testing covers tenant isolation and private-object consistency.

Do not mark production-ready solely because feature tests pass.

## Mandatory IP/OSS/brand foundation

For work touching dependencies, fonts/assets, contributors/contractors, AI-assisted code, packaging/distribution, trademark/brand decisions or commercial handover, also read:

- `docs/legal/IP_OSS_BRAND_FOUNDATION.md`
- `docs/legal/IP_PROVENANCE_REGISTER.md`
- `THIRD_PARTY_NOTICES.md`
- Issue #7: https://github.com/patslu-fck1701/UI-Pro/issues/7

Rules:
- no unreviewed third-party component enters production;
- no blanket proprietary notice may overwrite third-party licences;
- no freelancer/agency contribution is accepted without an adequate rights basis;
- public source must not be treated as a trade secret;
- AI-assisted code still requires human, security and licence review;
- brand filing requires documented clearance first.

