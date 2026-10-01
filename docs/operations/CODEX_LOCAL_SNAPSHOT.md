# Local Codex Snapshot

**Baseline:** KB-v1.34  
**Corrected:** 2026-10-01

## Authoritative local-state rule

The owner has explicitly defined the real local baseline as **`WerkZ.zip` on the PC / the local Codex workspace derived from it**.

Do not treat any later archive as the current local state merely because it has a newer date or a name such as `codex_working`, `prepared` or `consolidated`.

Known historical archive metadata may remain useful for comparison, but it is not authority over the owner's stated local baseline.

## Known historical snapshot hashes

- Original upload SHA-256: `b060bdb96319f713ff080ae0ded0fb3f430e97f1465e4f502d9f6c0895b65c8f`
- Clean pre-change snapshot SHA-256: `06e60b0d10ece1177a6c56607c7ea960c43f9d7422e1f214ce63dda8f6594f39`
- Prepared archive SHA-256: `ddb8e9e02e8774e18e44b4514b71c8028e4e3199b7f5c17bb5b74fd27f5b5951`

These hashes document historical artifacts only.

## Correct workflow for Codex

1. Open the owner's actual local WerkZ project / original `WerkZ.zip` baseline.
2. Create a fresh backup/snapshot before modification.
3. Inventory the actual local structure and working features.
4. Read the 2026-10-01 handoff/delta documentation.
5. Apply deltas deliberately; do not replace the workspace blindly.
6. Run tests/readback and document the resulting new local state.
7. Only after that may a newly generated archive be called the current local Codex state.

## Current delta to apply

The major 2026-10-01 delta includes:
- website vs operational-product separation;
- modular Core / optional modules;
- smartphone-only Solo;
- role/capability model;
- offline/sync;
- events/audit;
- analytics/simulation;
- management/messenger approvals;
- corrected DeutschZ relationship: active live server + WerkZ origin/reference.

Private binary snapshots remain outside the public repository.
