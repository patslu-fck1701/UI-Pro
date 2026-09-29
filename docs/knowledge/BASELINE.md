# WerkZ Knowledge Baseline

**Current baseline:** KB-v1.29  
**Date:** 2026-09-29

## Canonical responsibilities

| Domain | Canonical layer |
|---|---|
| WerkZ source / commits / branches / PRs / repo-local technical docs | this GitHub repository |
| Structured reflections and architecture history | WebsitePublisher / WerkZ |
| Human-readable cross-system knowledge register | Google Drive / WerkZ Wissensregister |
| Active reasoning and work | Chat/project context |

## Cross-system lifecycle

`semantic delta -> affected layers -> compare -> resolve -> persist -> cross-link -> readback -> STABLE/STOP`

Reopen on substantive new evidence, correction, regression, integration/dependency change, rights/phase change, or a deliberate audit. Metadata-only synchronization does not reopen the cycle.

## Version namespaces

- `KB-vX.Y` — shared semantic knowledge baseline
- `R-xx` — reflection record
- Git SHA/branch/tag — GitHub revision
- WebsitePublisher page/history revision — local WP revision
- Google Drive revision — local Drive revision

Different native revision numbers are expected.

## Founding/business formation link

WerkZ has a separate serious founding-package workstream. Its current cross-validated successor state is indexed in `docs/knowledge/FOUNDING_PACKAGE.md`. Business/funding documents remain separate from public marketing content and from source code. The founding package is used as evidence of preparation and professional capability, while private Jobcenter-specific content stays out of public marketing pages.

## Business graph / operational twin direction

WerkZ now distinguishes the existing System Graph from a new Business Operating Graph. The latter models goals, customers, projects, processes, roles, people/resources, finance, rules, quality, automation, dependencies and evidence as typed nodes and relationships. See `docs/architecture/BUSINESS_GRAPH.md`. This is an architecture direction, not a claim that a graph database is already deployed.

## Integration and access lifecycle

Business-graph relationships now drive an explicit integration/access matrix: system role, authoritative data, interface, auth type, scopes, access owner, environment, sensitivity, failure path, approval, rotation/revocation, test evidence and handover state. See `docs/architecture/INTEGRATION_ACCESS_MATRIX.md`. Discovery records no plaintext secrets.

## Enterprise relationship model

KB-v1.26 extends the Business Operating Graph with master data, API/integration/ETL, IAM/token metadata, monitoring/logging, backup/recovery, reporting, knowledge, compliance, asset/service management and authoritative-source rules. Canonical trace: goal → process → role → data → source system → interface → credential type → scopes → environment → automation → evidence → KPI/impact → history. See `docs/architecture/ENTERPRISE_RELATIONSHIP_MODEL.md`.

## Time tracking module

KB-v1.29 adds a reusable WerkZ time-tracking reference module derived from the Gabriel mobile pilot. The module separates shift time from individual jobsite/work-unit completion and combines GPS/address, speech/text, optional photo evidence, daily summary, local backup/restore and an error journal. Canonical source and test/backup rules live under `packages/time-tracking/`, `docs/architecture/TIME_TRACKING_MODULE.md`, `docs/testing/TIME_TRACKING_TEST_PLAN.md` and `docs/operations/TIME_TRACKING_BACKUP_ERRORS.md`.

The current internal WebsitePublisher prototype is deliberately local/offline-first and admin-gated. Employee/customer production rollout requires Tenant Auth plus explicit tenant/row policies and server-side records; it is not claimed complete until real member-session cross-tenant tests pass.
