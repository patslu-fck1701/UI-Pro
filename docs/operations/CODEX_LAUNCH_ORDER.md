# WerkZ Codex Launch Order — one-time start prompt

**Date:** 2026-10-01  
**Baseline:** KB-v1.41  
**Active work package:** GitHub Issue #3  
**Purpose:** Historical one-time bootstrap. For all current/future continuation sessions, the owner should normally only need to say **"weiter"** and Codex must follow `CODEX_RUNBOOK.md` + `CURRENT_WORK.md/json` + `CODEX_RESUME_NOW.md`.

---

## START NOW

You are Codex working on WerkZ from the phone with connected plugins.

Do not ask the owner where the project is or what to open. The persistent control plane already exists.

### 1. Read the control plane first

Repository:

`patslu-fck1701/UI-Pro`

Read the **latest versions from `main`** in this exact order:

1. `docs/operations/CODEX_RUNBOOK.md`
2. `docs/operations/CURRENT_WORK.json`
3. `docs/operations/CURRENT_WORK.md`
4. `docs/operations/CODEX_RESUME_NOW.md` when present
5. active GitHub issue referenced there, including newest comments
6. compare latest `main` with the active implementation branch
7. recent commits after the recorded last verified implementation commit

Current active issue is expected to be:

**#3 — Codex Next: commercial modules, entitlements, pricing catalog & Time productionization**

Do not trust this sentence over CURRENT_WORK if CURRENT_WORK has changed. CURRENT_WORK is authoritative.

---

## 2. Canonical accessible code baseline

Phone-based Codex cannot inspect the owner's PC.

Use Files Library:

`/WerkZ/Baseline/WerkZ.zip`

Library file id:

`libfile_356b20f709588191905c43ed43edd7c4`

Materialize/unpack this ZIP into your working environment and inspect it before making structural assumptions.

Do NOT wait for a PC comparison.

Do NOT substitute later prepared/working/consolidated/handoff ZIPs as the baseline.

Those are reference/delta sources only.

---

## 3. Read supporting sources

### GitHub architecture/product docs

At minimum read:

- `README.md`
- `docs/knowledge/BASELINE.md`
- `docs/knowledge/KB-v1.40_SYNC.md`
- `docs/knowledge/CORRECTION_2026-10-01.md`
- `docs/architecture/DEPLOYMENT_TOPOLOGY.md`
- `docs/operations/WEBSITEPUBLISHER_23947_MANIFEST.md`
- `docs/operations/CODEX_LOCAL_SNAPSHOT.md`
- `docs/operations/CODEX_CONSOLIDATION_ORDER.md`
- `docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md`
- `docs/knowledge/BUSINESS_SECURITY_CUSTOMER_OPERATION_MASTER.md`
- `docs/commercial/COMMERCIAL_MODEL_v0.1.md` — historical seed only; never current price authority
- `docs/architecture/TIME_TRACKING_CONSOLIDATION.md`
- `docs/testing/TIME_TRACKING_FEATURE_PARITY.md`
- `docs/architecture/TIME_TRACKING_MODULE.md`

### Google Drive

If available, read the current WerkZ documents:

- WerkZ – Wissensregister
- WerkZ – Codex Masterauftrag & Architektur ab 01.10.2026
- WerkZ – Deployment, Domain & Codex Snapshot
- WerkZ – Fehleranalyse & Korrektur Website/DeutschZ – 01.10.2026
- WerkZ – KB-v1.40 Systemstand & Handoff Index
- WerkZ – Codex Steuerung – WEITER-Protokoll
- WerkZ – Preismodell & Module v0.1 – 01.10.2026

### WebsitePublisher

Project 23947 is reference/marketing/UX only.

Do not turn WebsitePublisher into the operational WerkZ product runtime.

---

## 4. Execute the active work package, not just documentation

The active issue is implementation work.

You are expected to materially advance WerkZ.

Do not stop after writing architecture prose.

First inspect the actual baseline/repository, then implement the safe next increments.

The current package requires:

### A. Finish/productionize WerkZ Time

Preserve the additive merge rule between:

- the practical 29212 feature set;
- the generic WerkZ Time module;
- the audited/private reference.

Carry forward or explicitly decide on:

- photo gallery;
- booking/history correction;
- optional odometer/mileage;
- IndexedDB/offline cache/vault where useful;
- product auth/session abstraction;
- server persistence;
- private/gated photo storage;
- multi-device sync;
- cross-tenant negative tests.

Remove production coupling to WebsitePublisher-specific auth, `admin_token`, project URLs or CDN-hosted product assets.

Gabriel-specific names/default employers/profile values belong in fixtures, not generic product code.

### B. Build the real module contract

Core is infrastructure only.

Every business module must declare:

- module id;
- commercial SKU;
- display name;
- version;
- capabilities;
- routes/endpoints;
- UI/nav contributions;
- schema/migrations;
- config schema;
- hard dependencies;
- optional integrations;
- compatibility/version metadata.

Initial modules:

- `werkz.time`
- `werkz.customers`
- `werkz.orders`
- `werkz.materials`
- `werkz.documents`
- `werkz.billing-prep`
- `werkz.analytics`
- `werkz.simulation`
- `werkz.management`
- `werkz.approvals`
- `werkz.channel.whatsapp`

Rules:

- Time works standalone.
- Orders can be enabled later and Time may link optionally.
- Analytics may observe events but operational modules do not depend on Analytics.
- Simulation never mutates production.
- Chefmodus/Management is optional.
- WhatsApp is only a channel adapter, never the source of truth.

### C. Build entitlements

Per organisation:

- module id
- status: active/trial/suspended/expired
- config
- activated_at
- optional expires_at
- optional contract_item_id
- catalog_version

Required:

- server-side enforcement;
- capabilities only from entitled modules;
- audit entitlement changes;
- disabled module preserves data;
- re-enable restores access;
- direct API access denied without entitlement.

### D. Build versioned commercial catalog and quote model

Implement typed/domain models for:

- CatalogItem
- PackagePreset
- Quote
- QuoteItem
- Contract/subscription entitlement mapping

Pricing must be data/configuration.

Historical quotes keep price snapshots after catalog changes.

Support:

- one-time setup;
- recurring monthly;
- seat/team packs;
- integrations;
- provider pass-through;
- custom project work;
- support/service levels.

Do **not** use `COMMERCIAL_MODEL_v0.1.md` as current pricing. It is historical seed/test material only.

Canonical commercial behavior must follow `PRICING_DEPLOYMENT_MODEL_v2.md` and `config/catalog/werkz-v0.2.json`: setup + managed operation + deployment/infrastructure, no permanent Free tier, and modules remain technical entitlements rather than a public small-module price menu.

### E. Package presets

Solo/Team/Business are sales presets only.

They must expand into independent SKU/entitlement items.

Different customers in the same sales class may have different module sets.

### F. Chefmodus / Entscheider

Build a professional management surface around:

- exceptions;
- approvals;
- blocked work;
- ready-to-bill items;
- over-budget/attention items.

Do not force a full office UI on management.

All actions permission-checked and audited.

### G. Approval/notification adapter

Define generic:

- `NotificationPort`
- `ApprovalChannel`

Implement a local/fake adapter first.

Do not pretend real WhatsApp is connected.

Preserve:

- actor
- organisation
- entity type/id
- command
- state
- provider/message id
- correlation/idempotency
- audit result

---

## 5. Minimum acceptance tests for this work package

At minimum verify:

1. Time-only organisation works without Orders.
2. Orders can be enabled later and optional linking appears.
3. Analytics can be disabled without affecting operational modules.
4. Two organisations can have different module entitlements.
5. Disabled module routes/APIs are denied server-side.
6. Module disable preserves its stored data.
7. Re-enable restores access.
8. Quote price snapshot survives catalog price change.
9. Package preset expands into independent SKUs.
10. Fake approval adapter is idempotent.
11. Chefmodus can be disabled without breaking core/approvals.
12. Production module contracts contain no WebsitePublisher auth/entity dependency.

Also run any existing repository tests/build/lint/typecheck.

---

## 6. Persistence — mandatory

Every important result must be saved outside chat.

### GitHub is the development control plane

Persist:

- implementation code;
- tests;
- architecture decisions;
- migrations;
- commercial catalog models;
- active issue progress;
- current-work pointer.

### Current-state files

Before ending a work session, update:

- `docs/operations/CURRENT_WORK.md`
- `docs/operations/CURRENT_WORK.json`

Record:

- current state;
- final/last verified commit SHA;
- what was implemented;
- exact tests/build results;
- unresolved blockers;
- recommended next work package.

### Active GitHub issue

Add a progress/completion comment with:

- commit SHA(s);
- implemented scope;
- tests;
- blockers;
- next recommendation.

### Google Drive

Mirror only high-value human-readable architecture/commercial/handoff deltas where useful.

Do not duplicate every source-code detail into Drive.

### WebsitePublisher

Update only public/reference information when explicitly appropriate.

Do not implement operational product state there.

---

## 7. Completion state

When Issue #3 is genuinely complete:

Set CURRENT_WORK state to:

`DONE_NEEDS_NEXT_ORDER`

Do not immediately invent unrelated work and hide the transition.

Record a recommended next package.

Then the owner can simply say:

**weiter**

and the next Codex/agent session must:

1. read RUNBOOK;
2. read CURRENT_WORK;
3. inspect the finished issue/comment/commits;
4. derive/create the next issue;
5. repoint CURRENT_WORK;
6. continue.

---

## 8. General rules

- Do not ask for information already present in the persistent sources.
- Do not rely on chat memory when GitHub current-state files exist.
- Do not claim tests that were not run.
- Do not call generated code "finished" only because it exists.
- Do not delete working/unique material merely to reduce plan limits.
- Use KEEP / MERGE / ARCHIVE / REMOVE before destructive changes.
- Keep Core generic.
- Keep modules commercially and technically identifiable.
- Keep pricing separate from domain logic.
- Keep WebsitePublisher out of production persistence.
- Keep DeutschZ independent from the WerkZ product codebase.
- Make small, reviewable commits.
- Build WerkZ forward, not just documentation around it.

---

## 9. Start action

Start/resume now by:

1. reading latest main RUNBOOK + CURRENT_WORK + `CODEX_RESUME_NOW.md`;
2. reading Issue #3 newest comments;
3. comparing latest main vs active branch and synchronizing safely;
4. running the current verify suite;
5. attempting Library baseline materialization once if available;
6. executing the first incomplete block in `CODEX_RESUME_NOW.md`;
7. running tests;
8. committing;
9. updating CURRENT_WORK and Issue #3 before stopping.

Do not wait for another owner message to begin the active work package.
