# WerkZ Knowledge Baseline

**Current baseline:** KB-v1.40  
**Date:** 2026-10-01

## Canonical responsibilities

| Domain | Canonical layer |
|---|---|
| WerkZ source / commits / branches / repo-local technical docs | this GitHub repository |
| Phone-based Codex code baseline | Files Library `/WerkZ/Baseline/WerkZ.zip` |
| Public company website / current web presentation | WebsitePublisher project 23947 |
| Structured reflection / architecture history | WebsitePublisher tasks/history |
| Human-readable cross-system knowledge register | Google Drive / WerkZ system knowledge |
| Active reasoning / handoff preparation | chat/project context |

## Non-negotiable local-baseline rule

Codex is currently working from the phone and cannot inspect the owner's PC.

For this environment, the canonical accessible implementation baseline is Files Library `/WerkZ/Baseline/WerkZ.zip` (library file id `libfile_356b20f709588191905c43ed43edd7c4`).

Codex should materialize that ZIP and develop forward from it. Later prepared/working/consolidated/handoff ZIPs are reference/delta snapshots only. No PC comparison is required for the current phone-based development session; transfer/synchronization back to the PC is a separate later step.

## Main product direction

WerkZ is the primary business/product focus.

WerkZ must work from:
- solo / smartphone-only;
- small teams;
- mid-sized organisations;
- later enterprise-scale structures.

Do not create separate products for each size. Use one core with optional modules, capability-based rights and optional organisation structure.

## Website/product boundary

WebsitePublisher project 23947 is **not the canonical operational WerkZ runtime**.

It is the public company website and reference/documentation surface:
- customer-friendly explanation;
- modules/workflows;
- pricing guidance;
- pre-check/detail-check;
- technical and security depth;
- selected practice references.

Production customer solutions are deployed separately from the WerkZ codebase as app/PWA/customer instances.

## DeutschZ boundary

DeutschZ is an active DayZ community server with real players and ongoing development.

It also provides real engineering experience behind WerkZ, but it must not be reduced to a mere reference/lab.

Public structure:
- `/server.html` — live-server hub and consolidated information;
- `/roadmap.html` — active roadmap;
- `/deutschz-story.html` — spoiler-gated full story/noindex.

The consolidated server page retains server/mod context, current development, changelog, learning/technical content, support/test feedback, vote and archives.

## WerkZ Time

WerkZ Time comes from the private Gabriel mobile pilot. The pilot is a reference and migration source. The production module belongs in the WerkZ product core.

A customer must not require a PC: hosted smartphone/PWA usage is a first-class target. Team use adds central sync, permissions and tenant boundaries.

## Events, analytics and simulation

Operational modules produce structured history/events. Analytics derives metrics from tenant-scoped history. Simulation runs on separate scenario/run data and never mutates production data.

## Approvals and messaging

Management/approval UX can be extremely reduced. Messenger channels such as WhatsApp or email are adapters only; the WerkZ core authorises, links, de-duplicates and audits the actual decision.

## Deletion/change guardrail

Before deleting an existing website page, entity, document or operational function, classify it:

- **KEEP** — live/unique function;
- **MERGE** — content/function fully preserved in a verified target;
- **ARCHIVE** — historical but worth retaining;
- **REMOVE** — proven redundant/obsolete with no unique function/data.

Do not delete merely to reduce a plan limit.

Roadmap, changelog, live-server information, support/test flows, story canon and operational data default to KEEP/MERGE unless explicitly decided otherwise.

## 2026-10-01 correction

A cleanup incorrectly removed the DeutschZ roadmap and over-framed DeutschZ as only a technical reference. The roadmap was restored and DeutschZ was reclassified correctly as an active live server plus WerkZ origin/reference.

See `docs/knowledge/CORRECTION_2026-10-01.md`.

## Current WebsitePublisher resource snapshot

As of the correction:
- pages: 26 / 30;
- assets: 51 / 300;
- entities: 17 / 25;
- internal link audit: no broken internal page links detected.

Visual asset cleanup (white/uneven backgrounds and duplicate variants) is deferred as a separate non-destructive task.

## Cross-system lifecycle

`semantic delta -> affected layers -> compare -> resolve -> persist -> cross-link -> readback -> STABLE/STOP`

Reopen on substantive new evidence, correction, regression, integration/dependency change, rights/phase change, or a deliberate audit.

## DeutschZ data cleanup — KB-v1.40

The former WebsitePublisher DeutschZ log/config/package verification database was a temporary test structure and has been removed.

Deleted entities:
- `dzlogreport`
- `dzconfigsnapshot`
- `dzconfigchunk`
- `dzconfigchange`
- `dzconfigvalidation`
- `dzfeedbackstate`
- `dzserverpackage`

Deleted specialized forms:
- `deutschz_testmeldung`
- `deutschz_lootmeldung`
- `deutschz_discord_alert`

Operational player reporting now stays intentionally simple: the existing `bug_report` form stores the report as a WebsitePublisher lead and sends an internal server-side notification. Deep log/config analysis is performed on demand from the actual files/logs instead of being mirrored into permanent WebsitePublisher entities.

`mediaasset` and `werkzreflection` explicitly remain.

## Cross-cutting platform foundations

The following repository documents are now part of the canonical WerkZ baseline and apply across modules:

- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- `docs/integrations/INTEGRATION_STRATEGY.md`

They establish from the start:
- capability/tenant enforcement and negative tests;
- SecretStore/credential references instead of plaintext business-table secrets;
- audit, backup/restore, retention/exit and incident-response expectations;
- cloud-first/agent-optional deployment;
- signed packages and trusted update/revocation paths for local agents;
- one enrollment model across installer/MDM/automation paths;
- provider-neutral OAuth/webhook/queue/retry/idempotency/mapping contracts;
- separation of WebsitePublisher marketing/reference surfaces from customer runtime and production data.

These are engineering constraints, not a signal that all production infrastructure is already implemented.
