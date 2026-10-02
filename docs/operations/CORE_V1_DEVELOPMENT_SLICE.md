# WerkZ Core v1 — GitHub development slice

**Status:** Prepared on branch `codex/werkz-core-v1` from the reachable GitHub state.  
**Canonical archive:** Files Library `/WerkZ/Baseline/WerkZ.zip` (`libfile_356b20f709588191905c43ed43edd7c4`).

This slice does not claim that the Library ZIP was materialized: the Files connector was not available in the execution session. It is an intentionally isolated, dependency-free implementation to merge deliberately with that archive when materialization becomes available.

## Implemented

- organisation/tenant boundary;
- users and capability bundles;
- module enable/disable checks;
- customer and order creation;
- optional zero/many responsible users;
- order-linked or standalone time tracking;
- field evidence for notes, voice metadata, GPS/address, photos, material, additional work and problems;
- order completion;
- configurable approval bypass for Solo;
- approval request and approve/return/defer decisions;
- append-oriented audit records;
- idempotency keys for mutating workflow commands;
- in-memory repository with JSON backup, restore and integrity check.

This is a core/domain slice, not yet a production HTTP API, database, PWA or authentication implementation.

## Windows start and verification

Install Node.js 20 LTS, open PowerShell in the repository and run:

```powershell
npm install --ignore-scripts
npm run verify
node demo/solo-flow.js
```

No third-party runtime packages are installed. The demo prints sanitized fictional state as JSON.

## Smartphone/PWA test boundary

No PWA UI is claimed in this slice. After the canonical ZIP is materialized, connect its responsive shell to these commands and test:

1. install/open the PWA on a phone;
2. create a customer and order;
3. enable airplane mode;
4. start time and add a note/photo;
5. reconnect;
6. verify each idempotency key reached the server once;
7. create a concurrent order revision and confirm a visible conflict instead of silent last-write-wins;
8. verify tenant and capability denials server-side.

## Migration into the canonical ZIP

1. Materialize the exact Library file and verify its expected identity/hash metadata.
2. Inventory its language, persistence and existing tests.
3. Compare domain concepts; do not overwrite existing working features.
4. Port `WerkZCore` behavior behind the archive's native service/repository boundaries.
5. Replace the in-memory repository with SQLite through an abstract repository contract.
6. Add authentication/session validation and derive context server-side.
7. Run archive-native tests plus the acceptance claims in `test/werkz-core.test.js`.
8. Only then call the merged archive updated.

## Verification labels

- IMPLEMENTED: yes, on the isolated GitHub branch.
- BUILDS/CHECKS: automated by GitHub Actions.
- UNIT TESTED: automated by GitHub Actions; eight core tests.
- INTEGRATION TESTED: no database/HTTP/PWA integration exists yet.
- MANUALLY TESTED: not claimed.
- LIBRARY ZIP MERGED: no; explicit pending migration step.
