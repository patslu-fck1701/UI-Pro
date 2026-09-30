# WerkZ Time Consolidation

**Baseline:** KB-v1.33  
**Date:** 2026-09-30

## Source precedence

WerkZ Time currently has three useful sources with different strengths.

### 1. Project 29212 — primary practical source

This is the **latest and most advanced practical implementation** created during the Gabriel build.

Observed capabilities include:
- employer/assignment selection including custom employer;
- running work timer;
- jobsite completion while the main shift continues;
- finish-work/day summary flow;
- GPS and reverse-geocoded address;
- speech input;
- optional photos and photo gallery;
- today/week metrics;
- booking/history correction UI;
- reports/evaluation views;
- optional note and odometer;
- local state plus IndexedDB/encrypted-vault logic;
- login/session handling and tenant-auth integration attempts.

It leads on **real UX, feature breadth and practical workflow**.

### 2. Generic WerkZ Time module in project 23947 — primary abstraction target

Files/pages:
- `werkz-zeit.html`
- `werkz-zeit-einsatz.html`
- `werkz-zeit-tag.html`
- `js/werkz-time-core.js`
- `css/werkz-time.css`

It leads on:
- generic naming;
- reusable shift/job/event contracts;
- stable IDs;
- backup-before-write;
- restore/export;
- error journal;
- reusable WerkZ module boundaries.

### 3. Audited single-file/private app — evidence/reference source

`private/arbeitszeit.html` in project 23947 provides an additional audited implementation/reference with local-vault, locations, reports and device-oriented behavior. It is not the final product source by itself.

## Merge rule

Do not simplify project 29212 down to the current smaller generic prototype.

Instead:
1. inventory every useful 29212 feature and interaction;
2. map it to a generic WerkZ Time capability;
3. retain/merge the stronger core-state, backup and error contracts from `werkz-time-core.js`;
4. use the audited private app as a cross-check for features, storage and evidence;
5. remove personal names and employer presets from generic production code, keeping them only as private test fixtures;
6. add missing production requirements rather than claiming the local prototype is production-ready.

## Production gaps to close

Before real employee/customer rollout:
- server-side persistence;
- Tenant Auth with real member sessions;
- explicit row/tenant policies;
- cross-tenant negative tests;
- multi-device synchronization;
- private/gated photo storage;
- backup/export/recovery;
- deletion/data-retention rules;
- device/browser validation for GPS, camera and speech;
- support/update policy.

## Retirement gate for project 29212

Project 29212 may be removed only when:
- exact source snapshot is privately preserved;
- feature inventory is complete;
- generic module has feature parity for all capabilities intentionally retained;
- personal test data is excluded from public/generic source;
- tests pass;
- rollback/source references are documented.


## Feature-parity checklist

The live source comparison is maintained in `docs/testing/TIME_TRACKING_FEATURE_PARITY.md`. Treat it as a merge gate: a capability present in project 29212 must either exist in the generic result or have an explicit documented decision explaining why it was intentionally not carried forward.
