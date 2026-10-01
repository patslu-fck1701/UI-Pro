# Third-Party Notices

**Status:** initial inventory. This file must be generated/reviewed as part of each production release and does not replace the authoritative licence text shipped with a component.

## Current identified items

### Manrope

- Type: font
- Current use: referenced remotely by prototype WerkZ Time HTML pages via Google Fonts
- Upstream licence: SIL Open Font License 1.1
- Production direction: self-host approved version where practical and ship/store the applicable OFL text/provenance
- Modification status: no local bundled font file is recorded in the current repository baseline
- References:
  - https://openfontlicense.org/
  - https://googlefonts.github.io/gf-guide/license-file.html

## Current Node package baseline

The Issue #3 branch `codex/issue-3-commercial` was inspected on 2026-10-01:
- package name: `werkz-core`
- package version: `0.3.0`
- `private: true`
- no npm `dependencies` or `devDependencies` are declared in the current `package.json`
- no package lockfile was present at the inspected root

This is only a point-in-time baseline. Re-scan after every dependency change and before production release.

## Required release process

For every shipped release:
1. inventory bundled/runtime dependencies, fonts/media and relevant build dependencies;
2. resolve licence/SPDX identifiers;
3. flag review-required licences;
4. include required licence/NOTICE/attribution material;
5. generate SBOM;
6. retain evidence of the scan and approval.

## Review-required licence families

No automatic approval:
- GPL;
- LGPL;
- AGPL;
- MPL;
- SSPL/source-available;
- dual/commercial/custom licences.

Manual review does not mean “forbidden”; it means the exact usage/distribution model must be checked.

Canonical policy:
`docs/legal/IP_OSS_BRAND_FOUNDATION.md`
