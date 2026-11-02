# Issue #123 – OIDC and isolated Hotel test customers (DRAFT)

This is an undeployed implementation increment, not completion of issue #123.
Existing Hotel app and local KundenZ policy are reused. No GINI source/assets
are included. No invitations were created on a remote service or sent.

## Behavior

Online mode now requires OIDC and refuses password/setup/demo authentication.
Missing configuration fails closed; local non-online password behavior remains.
OIDC code flow uses S256 PKCE, browser-bound state, nonce, atomic flow consumption,
fixed HTTPS callback, same-origin trusted discovery endpoints and fresh JWKS.
Authlib validates RS256/ES256 signatures and issuer/audience/expiry/nonce; subject,
issued time and authorized-party binding are checked. Tokens are never returned
to browser storage or persisted as provider credentials. Sessions are rotated and
persisted server-side with Secure/HttpOnly/Strict cookies. Origin protects POSTs.
Durable 15-minute login limits survive consumed flows and process restart.

Every protected API request rechecks persistent identity binding, session,
tenant, grant, expiry/revocation and Hotel access. Additional module checks apply.
Owner requires pinned issuer+subject AND a valid OWNER grant; email is insufficient.
Legacy operator privilege cannot be inherited by customer grants. Hotel roles
remain separate from KundenZ roles. TEST_CUSTOMER maps to hotel_reception.

Owner UI prepares confirmed-recipient, single-use invitations with one-hour
acceptance TTL and 1–168 hour access (counted from creation). No email transport.
Codes are shown once, stored only as hashes. Acceptance requires signed verified
email matching the recipient; identity binding then uses issuer+subject.
Two test customers get separate tenants and two synthetic rooms each. Revocation
disables the grant and removes its active app sessions. Re-login cannot revive it.
Only Hotel is enabled in this increment. Roles CUSTOMER_ADMIN/CUSTOMER_USER are
recognized by policy but have no self-service provisioning interface yet.

## Configuration that must be confirmed by Owner/operator

- WERKZ_OIDC_ISSUER
- WERKZ_OIDC_CLIENT_ID
- WERKZ_OIDC_REDIRECT_URI (registered HTTPS /api/auth/callback)
- WERKZ_OIDC_CLIENT_SECRET if the registered client requires it
- WERKZ_OWNER_ISSUER and WERKZ_OWNER_SUBJECT
- Explicitly provisioned OWNER grant bound to an existing verified operator user

No automatic Owner bootstrap or email-based promotion is implemented.
Existing Supabase Auth is a candidate trust anchor, not automatically trusted.
The existing Google identity-link function requires Supabase operator login;
it is not an independent customer login. Do not reuse its bearer flow blindly.
Discovery currently restricts all endpoints to the issuer origin; a provider
requiring other origins needs reviewed explicit endpoint policy before use.

## Schema/release

hotel_005 adds grants, session bindings, login flows/rate buckets and invitations.
Migration is prepared, not executed against Render. Readiness requires hotel_005.
Review existing rows, backup, isolated PostgreSQL restore and migration parity
before any release. Existing sessions without OIDC binding are refused online.
DB roles/RLS and cross-process concurrency need PostgreSQL validation.

## Actual verification

- 29 focused local tests pass: policy, signed RSA tokens, invalid claims,
  browser binding/PKCE/state replay, persistent grants/revocation/rate limit,
  recipient matching, invitation reuse denial and two synthetic tenants.
- Extended focused run with Hotel program/management/entitlements: 34 passed
  before the final online-default change; rerun required for release.
- TypeScript/Vite build passed (known ~895 kB chunk warning).
- Existing Headless Edge Hotel program smoke passed (local password mode).
- No real provider login or authenticated Render E2E, mobile hardware, PostgreSQL
  restart/persistence or backup/restore has been tested for this revision.
- Authlib JOSE and Starlette httpx deprecation warnings remain.

## Incomplete gates

JWKS rotation/invalid-signature HTTP E2E, callback error UX, invitation acceptance
browser tests, expired sessions and concurrent Postgres acceptance need expanded
tests. Full role administration, module editing and grant renewal are incomplete.
The previous Windows DLL-blocked whole-suite result remains historical, not a
pass. The focused signature tests now run; no security setting was changed.

Cloud-file storage/edit approval/version history and cloud GINI adapter are NOT
implemented. GINI API v1 currently documents loopback-only transport and cannot
provide PC-independent cloud service. Partner issue #124 must deliver the cloud
contract; no guessed endpoints or local port exposure is introduced here.
OWNER_PRIVATE policy tests are not actual image-URL/cache E2E proof. Owner assets
must remain outside the customer deploy and Claude's protection must be reviewed.

Browser remains BLOCKED_BROWSER_PERMISSION. No bypass, deploy, migration on a
remote DB, additional cost, paid provider call, invitation or customer release.
