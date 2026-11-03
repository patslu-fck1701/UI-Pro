# Issues #123 / #126 — OIDC, customers and GINI Cloud (DRAFT)

Undeployed continuation of UI-Pro PR #15, reusing the existing Hotel application.
No remote invitation, provider request, deployment or live migration was performed.

## Implemented

Online mode requires OIDC Authorization Code flow with S256 PKCE, browser-bound
single-use state, nonce and signed token verification. Persistent sessions use
Secure/HttpOnly/SameSite cookies. Every protected request rechecks session,
identity, tenant, grant, expiry and module access. Callback query credentials are
redacted from access logs. Owner requires pinned issuer + subject AND a persistent
OWNER grant. An email or frontend role cannot promote a customer.

Owner UI prepares recipient-confirmed, single-use invitations, assigns
CUSTOMER_ADMIN / CUSTOMER_USER / TEST_CUSTOMER, limits Hotel access to 1–168 hours,
changes module access, renews access and revokes grants. Changes end existing
sessions. No email transport. Accepted customers get separate synthetic Hotel
tenants. No real invitation was sent.

The unchanged GINI Cloud 1.0 library from WerkZ PR #125, source commit
b54347e40771f9e19c8531e2a61cb296cacbe644, is integrated through a host adapter.
See backend/gini_cloud/UPSTREAM.md for provenance and proprietary boundaries.
Server sessions supply identity; persistent cloud grants supply permission.
Documents, versions, approval drafts and idempotency records are stored in SQL.
Customers cannot list/read foreign documents or OWNER_PRIVATE records.
Owner-private content is never forwarded to the model. Upload accepts text only.
No owner image assets, local GINI source or local filesystem access is added.

UI supports chat, text upload, explicit edit approval, version history and restore
as a new version. Stale writes fail closed. Drafts expire and bind to tenant and
principal. Revocation during a model call discards the answer. Provider redirects
are refused; Authorization is never forwarded to a redirect destination.

## Configuration and release gates

Operator must confirm WERKZ_OIDC_ISSUER, WERKZ_OIDC_CLIENT_ID,
WERKZ_OIDC_REDIRECT_URI (registered HTTPS /api/auth/callback), optional client
secret, WERKZ_OWNER_ISSUER / WERKZ_OWNER_SUBJECT, and explicitly provision the
verified operator's OWNER grant. Existing Supabase/Google building blocks were
reviewed; identity linking does not establish this trust automatically.
Discovery endpoints currently must use the issuer origin.

Cloud calls default to disabled. Enabling requires WERKZ_GINI_CLOUD_ENABLED=1,
WERKZ_GINI_CLOUD_COST_APPROVED=1, dedicated WERKZ_GINI_CLOUD_OPENAI_KEY and positive
WERKZ_GINI_CLOUD_TOKEN_LIMIT. There is no local key fallback. Conservative durable
token reservations are not a monetary spending guarantee. Provider/model and
monetary limit require separate Owner approval. CloudPermission must explicitly
grant actions, data classes, consent and expiry; enabling Hotel alone is insufficient.
Contract 1.0 uses gpt-6-luna and features.voice=false. Voice is clearly unavailable;
no audible playback or real TTS is claimed.

hotel_005 adds OIDC/grants; hotel_006 adds cloud tables and invitation roles.
Readiness requires hotel_006. Neither migration was applied to Render here.
Before release: review rows, actual Render backup and isolated internal restore,
migration review, approved deployment, then real IdP/Owner/two-customer acceptance.

## Actual evidence and limits

- Authlib CI dependency fixed by installing the existing `oidc` extra.
- Focused tests cover signed tokens, rotation, invalid signatures/claims,
  PKCE/state binding, expiry, revocation, roles, tenants, approvals and restore.
- Windows full Python suite at 9ee6d8d: 207 passed, 2 opt-in tests skipped.
  Later changes receive focused tests and CI; exact head results are in PR checks.
- Synthetic browser flow uses test sessions and fake model: chat, save/restore,
  reload, two separate customer contexts, logout, 390/768/1440px layouts.
  This is not real OAuth, real hardware or paid provider E2E.
- PostgreSQL 16 CI verifies migration head, optimistic writes, a fresh Python
  process reading records, pg_dump and strict pg_restore into a NEW isolated
  database. Matching tools use the existing CI service container. This proves
  the synthetic CI database, not Render data or a Render backend restart.
- Historical Windows DLL blocks remain historical. The current complete local
  Python run passed without weakening Windows security settings.

Open: real IdP/Owner binding, authenticated Render business tests and restart,
hardware/mobile test, actual Render backup/restore, deployed direct image URL /
logout / cache proof from Claude, provider approval and real voice delivery.
No online acceptance is claimed. Read final CI state against the exact PR SHA.

Dashboard remains BLOCKED_BROWSER_PERMISSION, not Owner rejection. No bypass,
allowlist opening, policy change, merge, deploy, live migration, invitation or
additional cost is authorized. Separately expiring werkz-pilot-db (2026-11-06)
still needs an authorized internal backup path; no pilot backup is claimed.
