# WerkZ Current Work

**State:** IN_PROGRESS  
**Updated:** 2026-10-01  
**Baseline:** KB-v1.40
**Last verified Issue #3 branch commit:** `81a6da094d47ffe166b90b6d005536bd268a60f4`  
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
