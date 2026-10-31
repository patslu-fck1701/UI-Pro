# WerkZ Hotel release-candidate contract

This document prepares a release candidate; it does not authorize a Render
configuration change, database migration, deploy, provider request, or merge.

## Immutable source

- Source branch: `codex/hotel-ai-providers-persistence-gates-20261031`
- Container definition: `apps/local-ai/Dockerfile.online`
- HTTP readiness path: `/api/ready`
- Automatic deploys remain disabled until an operator approves a deployment.

Record the exact Git commit before building. A branch name alone is not release
evidence.

## Runtime configuration

The release service must override the safe demo defaults with:

```text
WERKZ_AI_PACKAGE=hotel
WERKZ_AI_MODE=production
WERKZ_ONLINE_TEST=1
WERKZ_HOTEL_POSTGRES_ENABLED=1
WERKZ_HOTEL_DB_SCHEMA=werkz_hotel_test
WERKZ_HOTEL_OPENAI_ENABLED=0
```

`WERKZ_HOTEL_DATABASE_URL` is supplied only through Render secret storage. Do
not place it in Git, logs, screenshots, test output, or this document. The
offline preflight must pass before a deployment is proposed:

```powershell
python scripts/hotel_online_preflight.py
```

OpenAI remains disabled until an authenticated operator separately approves a
bounded call limit and micro-USD budget. Qwen remains `NOT_VERIFIED` until the
approved bridge URL, paired device identity, signature and a successful request
have all been observed.

## Operator-managed migration

Starting or importing the web application does not run PostgreSQL migrations.
For an already provisioned private `werkz_hotel_test` schema, the explicit
release command is:

```text
WERKZ_HOTEL_RUN_MIGRATIONS=1 WERKZ_HOTEL_MIGRATION_CONTEXT=operator-cli python -m backend.modules.hotel.migrate
```

Run it only after the target database, schema, backup/recovery path and exact
release commit have been approved. A refused command must perform no DDL. The
command is idempotent and the disposable PostgreSQL CI runs it twice.

## Readiness and acceptance

`GET /api/ready` returns HTTP 200 only when the database is reachable and the
Alembic revision is exactly `hotel_004`. Missing, stale or unavailable database
state returns HTTP 503 with `state: NOT_READY`. Configure Render's HTTP health
check to `/api/ready`; `/api/health` is informational and is not a database
readiness gate.

Before calling a commit a release candidate, require green results for:

- `verify`
- `hotel-verify`
- `hotel-postgres-verify`
- the synthetic Hotel provider browser smoke
- WERKZ-BRIDGE-1 Ed25519 interoperability and ask/claim/complete regressions
- the offline online-configuration preflight

Live Lovable pairing/revocation, a real Windows worker, a real provider request,
Render configuration and a deployment remain separate operator-approved checks.
