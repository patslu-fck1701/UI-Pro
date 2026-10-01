# KB-v1.39 Cross-System Sync

**Date:** 2026-10-01  
**Status:** synchronized after readback

## Why v1.39

Google Drive's WerkZ knowledge register had already reached KB-v1.38. The 2026-10-01 correction therefore advances the shared semantic baseline to **KB-v1.39**. Any same-session references to KB-v1.34 are superseded.

## Current decisions

1. **WerkZ is the main business/product focus.**
2. The real local implementation baseline is the owner's actual `WerkZ.zip` / local Codex workspace derived from it.
3. WebsitePublisher project 23947 is the public company website/reference surface, not the operational WerkZ product runtime/database.
4. Operational WerkZ is built in the local/GitHub codebase and deployed separately as app/PWA/customer instance.
5. Smartphone-only Solo is a first-class target; no office PC is required.
6. One modular core should scale from Solo to team/mid-size/later enterprise.
7. DeutschZ remains an **active DayZ live server** with real players and ongoing development.
8. DeutschZ public website structure:
   - `/server.html` — consolidated live-server hub;
   - `/roadmap.html` — active roadmap;
   - `/deutschz-story.html` — spoiler-gated story/noindex.
9. Changelog, roadmap and test evidence have distinct meanings.
10. Deletion requires KEEP/MERGE/ARCHIVE/REMOVE classification; limits alone are not a reason to delete unique functions/data.

## Website snapshot

- pages: 26 / 30
- assets: 51 / 300
- entities: 24 / 25
- broken internal page links in latest scan: 0

Visual image cleanup is deferred and must be non-destructive.

## Key repository documents

- `README.md`
- `docs/knowledge/BASELINE.md`
- `docs/knowledge/CORRECTION_2026-10-01.md`
- `docs/architecture/DEPLOYMENT_TOPOLOGY.md`
- `docs/operations/WEBSITEPUBLISHER_23947_MANIFEST.md`
- `docs/operations/CODEX_LOCAL_SNAPSHOT.md`
- `docs/operations/CODEX_CONSOLIDATION_ORDER.md`
- `docs/operations/DOMAIN_AND_RUNTIME_PLAN.md`
- `docs/knowledge/CODEX_WEBSITEPUBLISHER_MERGE.md`

## Codex issue

GitHub issue #1 has been rewritten to the sanitized KB-v1.39 master order:
`Codex: build WerkZ Core v1 from the real local WerkZ.zip baseline`.

Private personal/financial/funding details are intentionally kept out of the public issue/repository.

## Other persistent nodes

- WebsitePublisher task/history: architecture + error analysis + visual cleanup deferral.
- Google Drive:
  - WerkZ – Wissensregister
  - WerkZ – Codex Masterauftrag & Architektur ab 01.10.2026
  - WerkZ – Deployment, Domain & Codex Snapshot
  - WerkZ – Fehleranalyse & Korrektur Website/DeutschZ – 01.10.2026
- DayZServer:
  - README updated for active live-server status
  - `docs/WEBSITE_AND_ROADMAP_2026-10-01.md`

## Stop rule

Do not create another semantic baseline merely to document that this sync was documented. Reopen on a real functional/architectural change, new evidence, a correction, or a deliberate audit.
