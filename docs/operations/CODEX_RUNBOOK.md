# WerkZ Codex Runbook — "weiter" protocol

**Purpose:** Make WerkZ development resumable without relying on chat history.

## Single control plane

Repository: `patslu-fck1701/UI-Pro`

Every Codex/agent session starts here:

1. `docs/operations/CODEX_RUNBOOK.md` — this protocol.
2. `docs/operations/CURRENT_WORK.md` — human-readable current state.
3. `docs/operations/CURRENT_WORK.json` — machine-readable pointer/state.
4. GitHub issue referenced by `CURRENT_WORK.md/json`.
5. Recent commits after `last_verified_commit`.

Do not infer the current task from old chat messages when these files exist.

## Meaning of "weiter"

When the owner says only **"weiter"**:

1. Read `CURRENT_WORK.json`.
2. Read `CURRENT_WORK.md`.
3. Open the referenced active GitHub issue.
4. Inspect recent repository commits and any issue comments after the recorded last verified commit.
5. If status is `IN_PROGRESS`, continue the current work package.
6. If status is `READY_FOR_REVIEW`, verify tests/results and close gaps.
7. If status is `DONE_NEEDS_NEXT_ORDER`, derive the next work package from:
   - completed work;
   - blockers;
   - architecture docs;
   - product/commercial priorities;
   - current connected-source evidence.
8. Create the next GitHub issue.
9. Update both CURRENT_WORK files to point to the new issue.
10. Continue implementation if safe and authorized.

No user prompt should be needed merely to rediscover where the work lives.

## Canonical accessible code baseline for phone-based Codex

Files Library:

`/WerkZ/Baseline/WerkZ.zip`

Library file id:

`libfile_356b20f709588191905c43ed43edd7c4`

Phone-based Codex cannot inspect the owner's PC. Do not ask for a PC comparison as a prerequisite.

## Persistent source roles

### GitHub
Canonical for:
- source code;
- architecture docs;
- current work pointer;
- Codex orders/issues;
- tests;
- commits;
- technical decisions.

### Files Library
Canonical accessible archive baseline and handoff binaries.

### Google Drive
Human-readable knowledge mirror, business/context documents and cross-system handoff index.

### WebsitePublisher
Public website/reference surface only. Not the operational WerkZ product runtime.

## Work-package rule

Each substantial Codex work package gets its own GitHub issue.

Issue body must contain:
- objective;
- exact source references;
- in-scope work;
- out-of-scope work;
- acceptance tests;
- persistence/backup expectations;
- completion protocol.

Do not reuse a finished issue for unrelated work.

## Completion protocol — mandatory

Before Codex considers a work package complete:

1. Run all available:
   - tests;
   - build;
   - lint;
   - typecheck.
2. Record exact results.
3. Commit work in meaningful increments.
4. Update relevant architecture/docs.
5. Update `CURRENT_WORK.md`.
6. Update `CURRENT_WORK.json`.
7. Add a concise completion comment to the active issue containing:
   - final commit SHA;
   - what changed;
   - test results;
   - blockers;
   - recommended next package.
8. Set current work state to:
   - `DONE_NEEDS_NEXT_ORDER` if finished;
   - `BLOCKED` if external input is genuinely required;
   - `IN_PROGRESS` if not finished.

## How the next order is generated

When the owner says "weiter" after a completed package:

The next agent must inspect, in this order:

1. `CURRENT_WORK.json`
2. active/just-finished issue
3. latest commits
4. completion comment
5. relevant architecture/testing docs
6. current external/provider information if the next task depends on changing APIs/prices/rules

Then create a NEW issue and point CURRENT_WORK to it.

## Documentation discipline

Do not create a new KB number merely because a task was documented.

Create/update a semantic baseline only when there is a material architecture/product/governance change.

## Destructive changes

Before deletion use:
- KEEP
- MERGE
- ARCHIVE
- REMOVE

Never delete merely to reduce a plan limit.

## Phone workflow

Because the owner often works from the phone:

- every required source path must be written into the active issue;
- no instruction may depend on remembering a local PC path;
- every result must be persisted in GitHub/Files/Drive as appropriate;
- chat is coordination, not the only record.
