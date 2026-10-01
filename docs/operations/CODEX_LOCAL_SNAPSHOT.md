# Local Codex Snapshot

**Baseline:** KB-v1.40  
**Corrected:** 2026-10-01

## Authoritative phone-based Codex baseline

Codex is currently working on the phone through connected tools and cannot inspect PC-local files.

The canonical accessible implementation baseline is:

- Files Library path: `/WerkZ/Baseline/WerkZ.zip`
- library file id: `libfile_356b20f709588191905c43ed43edd7c4`

Codex must materialize/use this ZIP as the current development baseline.

Do not substitute a later archive merely because it has a newer date or a name such as `codex_working`, `prepared`, `consolidated` or `handoff`. Those are reference/delta snapshots only unless specific changes are intentionally merged.

## Known historical snapshot hashes

- Original upload SHA-256: `b060bdb96319f713ff080ae0ded0fb3f430e97f1465e4f502d9f6c0895b65c8f`
- Clean pre-change snapshot SHA-256: `06e60b0d10ece1177a6c56607c7ea960c43f9d7422e1f214ce63dda8f6594f39`
- Prepared archive SHA-256: `ddb8e9e02e8774e18e44b4514b71c8028e4e3199b7f5c17bb5b74fd27f5b5951`

These hashes document historical artifacts only.

## Correct workflow for Codex

1. Use Files plugin to materialize `/WerkZ/Baseline/WerkZ.zip`.
2. Create a fresh working copy before modification.
3. Inventory the ZIP's actual structure and working features.
4. Read the KB-v1.40 GitHub/Drive architecture and handoff documentation.
5. Build forward from this baseline and merge only deliberate deltas.
6. Run tests/readback and document every resulting change.
7. Commit safe, verified work to GitHub in small increments.
8. Do not wait for or request a PC-local comparison; PC synchronization is a separate later transfer/deployment task.

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
