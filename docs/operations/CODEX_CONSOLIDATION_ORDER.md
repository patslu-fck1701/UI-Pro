# Codex Consolidation Order — WerkZ

**Date:** 2026-09-30
**Scope:** local Codex workspace + GitHub source alignment.
**Do not perform DNS changes or delete WebsitePublisher project 29212.**

## Goal

Produce one canonical WerkZ code/documentation base aligned with the live WebsitePublisher topology:

- project 23947 = WerkZ live runtime;
- DeutschZ = integrated technical reference/lab;
- WerkZ Time = reusable module;
- project 29212 = latest practical Gabriel implementation and temporary source branch for feature harvesting; not the final deployment target.

## Required work

1. **Clean workspace**
   - exclude .skill-audit-temp, Python caches and other temporary audit/vendor material;
   - keep the uploaded original snapshot unchanged;
   - run the existing doctor/check/tests.

2. **Create a deployment manifest**
   - map live project 23947 pages/assets/fragments to source responsibility;
   - identify canonical, legacy and archive-only routes;
   - include rollback/restore notes;
   - record werkz-digital.eu as planned/not-connected.

3. **Merge website truth**
   - use the current WebsitePublisher public site as the more complete public UX baseline;
   - preserve strong Codex concepts: Mods für Betriebe, existing-system reuse, evidence, business graph, approvals and validation;
   - do not copy private pricing/margin data into public GitHub.

4. **Consolidate WerkZ Time**
   - treat project 29212 as the latest/most advanced practical source for the mobile workflow and feature behavior;
   - compare it against the audited private/single-file app and the generic WerkZ Time core;
   - extract generic state/data contracts and reusable UI/logic, preserving every useful capability from 29212 unless there is a documented reason not to;
   - keep personal Gabriel/employer names only in private test fixtures;
   - document which production gaps remain (server persistence, member auth, multi-device, private files, backup/recovery).

5. **Prepare project 29212 retirement only after merge**
   - inventory pages/assets and feature behavior;
   - create a private source snapshot/export;
   - maintain a feature-parity checklist against the new generic WerkZ Time module;
   - mark 29212 removable only after backup verification and parity sign-off.

6. **Align business/public docs**
   - remove the obsolete public NOT_SET price statement;
   - public starting prices remain Solo 490 EUR, Team 1,490 EUR, Business 2,490 EUR;
   - direct third-party/runtime costs and custom scope remain separately quoted;
   - internal hourly/margin calculations stay private.

7. **Domain/runtime docs**
   - keep werkz-digital.eu as planned and unconnected until registrar confirmation;
   - do not claim DNS/SSL is complete without live verification.

## Acceptance tests

- existing CLI/unit tests pass;
- active JS syntax checks pass;
- link/path audit passes;
- no secrets;
- no personal Gabriel data in generic product files;
- no references to temporary audit directories from canonical docs;
- deployment manifest is internally consistent;
- change report lists what still needs to be applied in WebsitePublisher.

## Deliverable

One clean commit/PR containing the canonical workspace changes and a short migration report. No destructive WebsitePublisher action.