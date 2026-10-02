# Issue #7 release inventory and gates

The current root Node package has no declared third-party npm dependencies. `sbom.spdx.json` records that point-in-time state. `npm run oss:check` rejects an unreviewed dependency, missing lockfile, missing licence metadata, review-required licences, or a stale SBOM. A changed dependency requires human review of the exact licence and distribution mode before broadening the allowlist.

Known browser asset dependency: prototype pages fetch Manrope from Google Fonts. The font is not bundled by the current Node package; see `THIRD_PARTY_NOTICES.md`. Before production redistribution, pin a self-hosted font version and include its OFL text.

The repo is public. No committed signing private keys, provider secrets, customer records or confidential contractor materials are permitted. The owner must decide private product repository versus a deliberate public/private split before confidential production work.

Open human/legal gates remain: contributor rights backfill, contractor written rights clauses, DPMA/EUIPO/WIPO clearance and canonical spelling decision, production asset licence inventory, actual insurance comparison and contract review. The repository does not claim any of those decisions have been completed.
