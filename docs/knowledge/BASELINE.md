# WerkZ Knowledge Baseline

**Current baseline:** KB-v1.33  
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

KB-v1.29 adds a reusable WerkZ time-tracking reference module derived from the Gabriel mobile test. The module separates shift time from individual jobsite/work-unit completion and combines GPS/address, speech/text, optional photo evidence, daily summary, local backup/restore and an error journal. Canonical source and test/backup rules live under `packages/time-tracking/`, `docs/architecture/TIME_TRACKING_MODULE.md`, `docs/testing/TIME_TRACKING_TEST_PLAN.md` and `docs/operations/TIME_TRACKING_BACKUP_ERRORS.md`.

The current internal WebsitePublisher prototype is deliberately local/offline-first and admin-gated. Employee/customer production rollout requires Tenant Auth plus explicit tenant/row policies and server-side records; it is not claimed complete until real member-session cross-tenant tests pass.


## Product/module boundary — KB-v1.33

WerkZ Time is a reusable module, not the full WerkZ Solo product. Solo connects intake, customer/order, mobile work evidence, supplier/order confirmations, material/service, invoice preparation, communication and archive/history into one end-to-end workflow. Team/Business extends the same objects across multiple roles/departments with explicit rights and handoffs. See `docs/architecture/PRODUCT_MODULE_BOUNDARIES.md`.

Commercial cost assumptions and customer-specific financial models remain private and are not committed to this public repository.


## Public pricing/scope alignment — KB-v1.33

The public starting prices remain €490 / €1,490 / €2,490 for Solo / Team / Business. They are scoped starting configurations assembled from reusable modules, not unlimited bespoke development. Additional integrations, migrations, roles/processes, third-party services and ongoing operations are separately scoped. See `docs/operations/PRICING_SCOPE_PUBLIC.md`.

Detailed cost rates, private margins and internal pricing calculations remain outside this public repository.


## Deployment/product consolidation — KB-v1.33

The earlier three-separate-project plan is superseded.

- project 23947 is the canonical WerkZ live runtime;
- DeutschZ remains inside it as the technical origin/reference/lab;
- WerkZ Time is a reusable module inside WerkZ;
- project 29212 is the latest and most advanced practical Gabriel time-tracking implementation and temporarily remains a source for feature/UX harvesting, not a permanent separate product.

Project 29212 must be privately archived and feature-parity checked before any owner-side deletion. After successful consolidation, two Starter project slots can remain free for actual isolated customer/product deployments. See `docs/architecture/DEPLOYMENT_TOPOLOGY.md` and the superseded-plan note in `docs/architecture/DEPLOYMENT_PROJECT_SPLIT.md`.

## Codex / WebsitePublisher merge rule — KB-v1.33

The current Codex package and WebsitePublisher live state are complementary sources rather than competing versions. Codex is stronger for engineering, governance, business templates, testing and operational rules; WebsitePublisher is stronger for the current public site and practical implementation. They are merged into project 23947 deliberately. For time tracking, project 29212 leads on proven practical UX/behavior, the generic WerkZ Time core leads on abstraction/state contracts, and the audited single-file build remains an additional evidence source. See `docs/knowledge/CODEX_WEBSITEPUBLISHER_MERGE.md`.

## Deployment consolidation — KB-v1.33

The canonical live topology is one core WebsitePublisher project: 23947. WerkZ is the main brand; DeutschZ is an integrated technical reference/lab; WerkZ Time is a reusable module. Planned main domain: `werkz-digital.eu`, currently unconnected and pending exact registrar confirmation.

See `docs/architecture/DEPLOYMENT_TOPOLOGY.md`, `docs/operations/DOMAIN_AND_RUNTIME_PLAN.md`, `docs/operations/WEBSITEPUBLISHER_23947_MANIFEST.md`, and `docs/operations/CODEX_CONSOLIDATION_ORDER.md`.
