# WerkZ Digital P0 release and surface inventory

Continuation of issues #126 and #128, UI-Pro draft PR #15. No release approval
is implied. No merge, live migration, deploy, invitation or paid call performed.

## Surface decisions

| Source | Classification | Decision and evidence |
|---|---|---|
| local-ai frontend / OnlineWorkspace | current online entry | One navigation: Hotel, GINI/files, Owner customers. Reuses existing components and server permissions. No local Qwen/model/file menus in OIDC sessions. |
| local-ai frontend / local workspace | still needed locally | Preserved for personal/local installs; no local GINI/AiZ/Qwen code changed. |
| local-ai Hotel, GuestPortal, WorkApp, Business | still needed | Fachflows, guest portal, Handwerk and Schrotties preserved. Demo login remains disabled in OIDC mode. |
| apps/advisor-pwa (3 files) | unused | Deleted; no runtime/import/workflow references in this checkout. |
| apps/assistant-pwa (5 files) | replaced/unused | Deleted; no runtime/import/workflow references in this checkout. |
| apps/customer-advisor (3 files) | replaced | Deleted; /berater already retired in Node runtime with 410. |
| apps/simple-showcase (1 file) | unused | Deleted; no runtime/build references. |
| apps/trades-pilot | still needed | Existing Node Handwerk routes and required role assets; preserved. Dead advisor link replaced with current demo entry. |
| apps/simple-pilot and simple-site | still needed | Existing Schrotties operations and customer site routes; preserved. Removed link to absent demo hub. |
| apps/time-pwa and time-tracking reference pages | still needed | Time component runtime and tests still reference these; not removed merely because old Render services are retired. |
| old /hub handler in Node runtime | replaced | Removed references to absent demo-hub filesystem; explicit 410. |
| Hotel old demo paths | replaced | /berater, /hub, /demo, /pilot, /zeit and obsolete assistant paths return 410; unknown pages return 404 with safe root link for HTML requests. No arbitrary path becomes the app shell. |
| /index.html, /app, /hotel on Hotel host | canonical aliases | 308 to / without forwarding query values. Root remains current application. |
| service-worker navigation | current | Only root can use cached application shell; retired and unknown paths do not get an offline shell fallback. API/private files are never added to this cache. |

WerkZ private main tree was read at 0a71af4ab179dbfeb698c19671f77cb1a7f0a773,
untruncated. Its GINI belongs to Claude, website/legal pages remain independent
public/company material, demo-hub and industry profiles remain separate reference
demos, websitepublisher snapshots remain historical archives, and the Schrotties
mirror remains a source mirror. They are not copied into the Hotel Docker image.
No evidence establishes that these reference sources can be deleted without
losing another runtime; preserved. Public deployment state is not inferred from
repository files. No changes made to WerkZ main or Claude's GINI/voice work.

## Explicit deletion authorization and actual blocker

Render readback confirms the exact authorized targets:

- werkz-assistant-iphone-test / srv-db08gj2d0e5s73ahoeeg: exists, suspended.
- werkz-time-device-test / srv-davf4iu7bikc73dqvfhg: exists, suspended.

BLOCKED_RENDER_DELETE_CAPABILITY: current Render connector has no delete/remove
service operation. No Render CLI executable or configured Render environment
access was found. No credentials extracted or new keys created. Dashboard remains
BLOCKED_BROWSER_PERMISSION and is not bypassed. No deletion was attempted; no
absence proof exists. User approval is already granted for these two IDs only.
Resume with an authorized management DELETE capability, compare IDs/names again,
delete only those two IDs, then verify 404/list absence and protected services.
Hotel srv-dbhi4kec6qcc73fg0i70, Handwerk srv-dbbsg3ui0phs73e2ife0 and all DBs
are outside deletion scope and were not changed.

## Exact target and configuration

Existing service: werkz-hotel-test. Current live baseline:
739b6c7b32e6eeb11b26ec962a84320920f8a52c, auto-deploy off, existing branch
codex/hotel-ai-providers-persistence-gates-20261031. Release candidate is the
reviewed PR head; verify exact SHA/checks before requesting release approval.

Required configuration names, values set only through a protected operator path:

- WERKZ_AI_PACKAGE=hotel, WERKZ_AI_MODE=production, WERKZ_ONLINE_TEST=1.
- RENDER_EXTERNAL_HOSTNAME=werkz-hotel-test.onrender.com.
- WERKZ_HOTEL_POSTGRES_ENABLED=1, WERKZ_HOTEL_DB_SCHEMA=werkz_hotel_test.
- WERKZ_HOTEL_DATABASE_URL: existing internal secret, confirmed against designated
  DB internally without printing it. No external IP allowlist opening.
- WERKZ_AUTH_MODE=oidc; WERKZ_OIDC_ISSUER, WERKZ_OIDC_CLIENT_ID,
  WERKZ_OIDC_REDIRECT_URI=https://werkz-hotel-test.onrender.com/api/auth/callback;
  WERKZ_OIDC_CLIENT_SECRET only if registered provider requires it.
- WERKZ_OWNER_ISSUER and WERKZ_OWNER_SUBJECT: verified immutable identity, plus
  explicit persistent OWNER grant for the verified operator user. Never promote
  by email alone. Check that discovery endpoint origin policy fits chosen IdP.
- GINI stays disabled: WERKZ_GINI_CLOUD_ENABLED=0,
  WERKZ_GINI_CLOUD_COST_APPROVED=0, WERKZ_GINI_CLOUD_TOKEN_LIMIT=0 until separate
  provider/model/monetary approval. Dedicated WERKZ_GINI_CLOUD_OPENAI_KEY only via
  existing secret management; no new key requested or local fallback.
- WERKZ_HOTEL_OPENAI_ENABLED=0 and no dependency on an Owner-PC Qwen bridge for
  GINI Cloud. CloudPermission actions/data classes/consent/expiry remain explicit.

## Ordered operator release procedure — prepared, NOT executed

1. Resolve verified Owner and two controlled IdP identities. Account labels and
   synthetic tenants are planned in config/test-customers.plan.json; null identity
   means NOT provisioned. No fake passwords. Plan 24-hour access, set actual UTC
   expiry at approved creation, record SSO method and confirm recipients privately.
2. In already authorized Render-internal execution, compare configured DB host,
   DB name and schema to designated Hotel instance. Record only match booleans.
   Use BEGIN READ ONLY, statement_timeout 10s and lock_timeout 2s; read current DB,
   schema, server version, migration revision, estimated counts and constraints.
   Do not import backend.app for read-only inspection. Do not expand permissions.
3. Produce PostgreSQL-16 custom-format consistent dump using existing secret
   connection channel, no command-line URI or tracing. Store in approved encrypted
   location, record SHA-256/size/exit code. Include required roles/dependencies;
   identify any file bytes outside SQL. No unencrypted synced export.
4. Restore with matching pg_restore into an approved EMPTY isolated database.
   Confirm target is different from source. No --clean against existing data.
   No new paid DB/resource without approval. Disable jobs/providers/email. Compare
   migration, schema, constraints/counts and synthetic functional readback.
5. Apply migration 004 -> 005 -> 006 to that restore first; rehearse duplicate
   upgrade, OIDC grant/session behavior and document writes. Test preserved data.
   The existing CI migration/dump/restore proof is synthetic, not this live drill.
6. Present exact SHA, green checks, configuration completion, real backup/restore
   evidence, maintenance window and rollback point for explicit Owner approval
   of merge (if needed), live migration and deployment. They remain blocked until
   that approval. Updating environment can deploy; do not mutate it beforehand.
7. Only after approval, operator migration command from apps/local-ai with approved
   existing internal configuration and temporary flags:
   WERKZ_HOTEL_RUN_MIGRATIONS=1 and
   WERKZ_HOTEL_MIGRATION_CONTEXT=operator-cli,
   then python -m backend.modules.hotel.migrate. Remove migration flags afterward.
   Web startup never implicitly migrates PostgreSQL. Require hotel_006 readback.
8. Deploy exact approved commit to EXISTING service with auto-deploy still off;
   verify deployed SHA, readiness, OIDC-only entry, two controlled synthetic
   accounts and dedicated cloud permissions. No external colleague invitation.
9. Execute actual Owner/two-customer OAuth login/logout, expired/revoked session,
   foreign tenant/URL/image denial, Hotel rooms/reservation/check-in/out/housekeeping,
   files/proposal/approval/versions/restore, two concurrent browsers, smartphone
   and approved backend restart. GINI real provider test only after cost approval.
   Verify Owner image view and customer direct URL/logout/cache denial with Claude.
   Disconnect Owner-PC dependency and prove real cloud roundtrip, not just HTTP 200.

## Rollback

Stop customer access if readiness/migration/OIDC/tenant checks fail. Keep providers
disabled. Roll back service to recorded baseline only after confirming compatibility
with the upgraded additive schema in the isolated rehearsal. Do not blindly run
downgrade: hotel_006 downgrade removes version data. Preserve any new writes and
retain the encrypted pre-release backup. Any destructive data restore requires
explicit approval and a new isolated target first; never overwrite source as a
rollback shortcut. Record deployed SHA, revision and post-rollback access proof.

## Acceptance boundaries

Synthetic CI and browser fixtures use isolated data and pre-provisioned test
sessions, not actual IdP login or real provider requests. Offline labels are not
usable online accounts. Runtime OIDC/provider routes on the old deployment are
not present. No ONLINE_BESTANDEN until actual approved target E2E succeeds.
Voice work in Claude PR #127 is not overwritten; local R17.4 acceptance does not
change the cloud contract's unavailable voice feature.
Per latest Owner instruction, old werkz-pilot-db has no needed data: no rescue,
extension or further pilot work is part of this release.
