# WerkZ Time Tracking Module

**Baseline:** KB-v1.30  
**Status:** reusable internal reference module; customer/employee production rollout not yet declared.

## Purpose

WerkZ Time Tracking is not designed as an isolated stopwatch. The module captures a workday as a chain of linked operational evidence:

`login -> employer/assignment -> shift start -> one or more jobsite completions -> shift finish -> daily summary -> office/billing handoff`

The first practical UX reference is the Gabriel mobile time-tracking test. The WerkZ module extracts the reusable workflow and separates it from Gabriel-specific credentials and test data.

## Core objects

- **Shift** — start, end, duration, employer/assignment, status.
- **Jobsite / Work unit** — timestamp, shift reference, customer, place, work description, GPS/address, optional photo.
- **Event** — start, jobsite completion, finish, later pause/travel/material events.
- **Daily summary** — day, first start, last finish, total time, employers, jobsites and chronological flow.
- **Error entry** — stage, message, time, optional technical context.
- **Backup snapshot** — previous persisted state plus exportable JSON snapshot.

All operational objects receive stable IDs. The UI must never infer identity from visible labels alone.

## Current implementation

Live internal pages on WebsitePublisher project 23947:

- `/werkz-zeit.html` — start/select/timer.
- `/werkz-zeit-einsatz.html` — GPS, reverse address lookup, speech/text, optional photo, save and continue.
- `/werkz-zeit-tag.html` — daily summary and CSV/JSON export.
- `/werkz-zeiterfassung.html` — public product/reference explanation.

Shared source:

- `packages/time-tracking/werkz-time-core.js`
- `packages/time-tracking/werkz-time.css`
- `packages/time-tracking/pages/*`

The current internal prototype persists locally in the browser. This is deliberate for the reference stage. The UI and domain model are separated so the persistence adapter can later move to tenant-scoped server entities without rebuilding the workflow.

Private server-side schema foundations already exist in WebsitePublisher: `werkztimeshift`, `werkztimejob`, `werkztimeevent` and `werkztimeerror` (`public_read: false`). They are intentionally not wired to browser writes yet. Tenant/member policies and real member-session authorization tests must exist before they become the production persistence path.

## Production target

For customer/employee use, the same workflow should use:

- Tenant Auth for employee/member identity.
- Explicit tenant/row access policies on private entities.
- Server-side records for shifts, jobsites and events.
- Gated/private file storage for evidence photos where required.
- Role-specific views for worker, office and management.
- Explicit retention, export and deletion rules.
- Cross-tenant negative authorization tests before rollout.

The public site must never expose employee/customer time records via anonymous MAPI or SSR.

## Business Operating Graph integration

A time record can later link to:

`employee -> shift -> assignment/job -> customer -> location -> jobsite/work unit -> evidence -> material -> billing -> KPI`

This makes time data part of the WerkZ Business Operating Graph rather than a disconnected attendance table.

## UX rule

The worker view remains intentionally short:

1. choose where/for whom work is done;
2. start time;
3. close individual work units without stopping the shift;
4. finish the day once;
5. review the resulting day.

Office/management receives a richer view from the same underlying data.


## Product boundary — time tracking is a module, not WerkZ Solo

The time-tracking reference is deliberately a reusable component. It must not be presented as equivalent to a complete WerkZ Solo implementation.

A full **WerkZ Solo** workflow can connect:

`inquiry (phone/email/form) -> customer -> order/job -> mobile execution/time/evidence -> supplier/order/confirmation -> material/service -> invoice preparation -> approval -> customer communication -> print/archive/history`

The time-tracking module contributes the mobile execution/time/evidence portion of that chain.

**WerkZ Team / Business** extends the same operating model across multiple roles and departments such as office, management, HR, accounting, production/workshop, purchasing and field installation. Each role receives an appropriate view and rights while events remain linked to the same business objects.

The reusable rule is: build small modules with stable contracts, then connect them into an end-to-end business workflow. Do not market one isolated module as the whole product.


## Superseding production boundary — Issue #3

The earlier WebsitePublisher Tenant Auth/entity path is superseded for production.

WerkZ Time production uses WerkZ-owned ports:

- authenticated actor/session context supplied by a WerkZ AuthPort;
- tenant-scoped repository and storage ports;
- private evidence storage;
- explicit server-side entitlement and capability guards;
- no `admin_token`, WebsitePublisher entity, project URL or CDN dependency.

WebsitePublisher remains a UX/reference source only. The module manifest in `src/modules/module-registry.js` makes this boundary machine-testable.
