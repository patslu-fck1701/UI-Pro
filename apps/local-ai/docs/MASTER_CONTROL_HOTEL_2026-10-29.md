# Master Control: tested local Hotel operator flow

Scope: existing WerkZ Admin/operator/chat surfaces, same identities, ModuleConfig,
module entitlements, audit and Qwen engine. No second dashboard, policy engine,
model runtime or business database. Development only; installed Hotel untouched.

## Usable functionality

- Existing Module & Users screen now names Master Control and shows the current
  operator's own tenant, modules, existing users/Hotel roles and audit events.
- Creating a user remains restricted to the current tenant. Role changes use
  PATCH `/api/admin/users/{id}/role` with expected_role (CAS). Current owner must
  still be admin inside the write transaction; target must belong to that same
  tenant. Self edits, global-admin targets, admin escalation and arbitrary roles
  are rejected. Membership transfer to another tenant is deliberately absent;
  existing authenticated membership is authoritative, not a submitted tenant.
- Roles take effect on existing sessions because every request reads the current
  User; live chat rechecks identity/role before each emitted chunk. Applied changes
  use existing Audit: actor, tenant, target, before/after role, event and time.
  No password, full prompt, token or document content is audited. This is an
  applied-change audit, not a claim of comprehensive failed-login monitoring.
- Existing demo entitlement controls remain synthetic-test-only. This change
  does not grant a productive module-policy editor or broaden operator ownership.
- Connections show probe time, configuration/reachability/authentication/usability
  and failure reason. After 60 seconds a stale warning requires a fresh probe.
  Local WerkZ authentication and role controls are real; external KundenZ
  identity federation and independent Master Control monitoring remain PARTIAL.
  No direct plugin-to-plugin or Google/Render connection is claimed.
- Chat option "Freigegebenes AiZ-Wissen verwenden" is enabled only when the
  backend reports current operator permission and readable pinned AiZ sources.
  It calls the existing include_knowledge path. Retrieved sources/revisions are
  displayed; empty results are explicit. The heading says retrieved context,
  because existing token budgeting may shorten optional context.
- Operator search now also uses both approved-v1 and exchange-v2 protocols.
- Knowledge-bound saved chats are protected against role/source withdrawal on
  listing, history, follow-up and export (ChatKnowledge additive local table).

## Actual verification

- Hotel program scenario: real FastAPI/SQLite sessions, own room/category,
  reception -> reader through operator PATCH, same live session denied Hotel
  context, foreign real synthetic tenant denied, stale role 409, self/admin
  escalation 403, foreign headers 409, applied-change audit verified.
- Actual operator role PATCH DURING a Hotel AI stream: authorized prefix delivered,
  subsequent protected chunk denied with ACCESS_CHANGED. Synthetic model only.
- Edge browser Hotel flow: own room/category persisted; user created through UI;
  role changed through UI confirmation; audit rendered. No unexpected disabled
  workspace requests or JavaScript errors.
- Edge AiZ flow: actual checkbox -> authenticated HTTP -> real AiZ temporary
  Git/FTS5 fixture -> synthetic engine response. Sources and empty search rendered;
  390/768/1440 widths without horizontal overflow. Time advanced 61 seconds shows
  stale warning; temporary binding removed -> connection unavailable -> option
  disabled after reload. No production binding touched.
- TypeScript/Vite build passed. Existing ~886 KB bundle warning remains.
- Full final Python regression: **64 passed / 3 skipped / 0 failed**, 95.22 s.
  Skips are explicit real-model/browser opt-ins plus existing optional scenario.
  The AiZ browser opt-in was separately executed: **1 passed**, 9.05 s.
  Hotel browser scenario and direct Hotel operator scenario both passed separately.
  Exact commit is recorded in PR74 after commit/readback.
- Actual Qwen proof exists for preceding adapter commit435db78 (1 pass, 12.23s).
  Engine/inference implementation unchanged in this stage; this UI test does not
  falsely claim a new real-model inference or real external provider connection.

Screenshots (synthetic local artifacts, not customer data):
`D:/dev-infrastructure/master-control-hotel-20261029.png` and
`D:/dev-infrastructure/master-control-aiz-chat-20261029.png`.

## Later controlled adoption

Not installed or deployed. To adopt later: revalidate source/PR head and access,
back up installed source and database using the existing protected backup path,
verify restore, pin the reviewed AiZ revision in local config, apply source/build
and additive ChatKnowledge schema in the authorized maintenance step, restart
only the intended Hotel service reusing Qwen, then recheck personal operator login,
empty real knowledge state, role/tenant denial, chat sources and rollback.
Do not copy temporary test users/stores, weaken CI, or alter real permissions.

Broader mission remains open: multi-business navigation/ownership, full shared-app
consolidation, productive policy workflow and external-provider approvals require
their own evidence. WebsitePublisher23947 and DeutschZ remain unchanged.
