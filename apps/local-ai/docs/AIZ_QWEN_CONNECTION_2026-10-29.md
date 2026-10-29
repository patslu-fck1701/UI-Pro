# AiZ -> existing WerkZ Qwen path, 29 October 2026

## Implemented connection

The existing authenticated `POST /api/chats/{id}/stream` accepts the optional
`include_knowledge=true`. Default is false. This is an API capability; the chat
UI does not yet expose a checkbox. No application installation/deployment was
performed in this task. The personal installed Hotel runtime was not restarted.

Existing session/actor/tenant validation and workspace module entitlements run
before retrieval. Only the existing admin role can request portable AiZ context;
there is no new role, grant, account, project selector, generic tool or port.
Extra request fields (including supplied project/tenant selectors) are rejected.
DeutschZ workspace is denied. `shared` means explicitly portable knowledge, not
permission to query DeutschZ business/server/player sources.

`KnowledgeSearchPort.context` reuses the pinned independent AiZ checkout and its
v1 search CLI. It also reads the v2 exchange database using SQLite `mode=ro`.
It does NOT invoke the handoff CLI's writable database initializer. The pinned
Git version of the existing v2 validator validates payloads and provenance;
canonical payload hashes must match. Only APPROVED_PORTABLE, policy version 2,
WerkZ/shared cards can pass. Review/revoked/conflict records are excluded;
overlapping IDs with contradictory approved content fail closed. Git-approved
v1 records remain checked against their current tracked sources and index text.
No real knowledge was approved, indexed, imported or changed.

Retrieval has at most 3 cards, 2400 serialized characters, 240 query characters;
natural-language fallback uses at most 6 bounded term searches. An oversized
exchange snapshot (more than 500 scoped records) is rejected, not silently
partially read. Context goes through the existing template/tokenizer budget,
4096 cap and response reserve. Cards are user-role data with the existing
instruction guard, never system instructions or callable tools. No executor
is available to source text or model output. This constrains capability; it
does not claim that a language model can never repeat malicious wording.

### Stored-answer revocation follow-up

The additive `chat_knowledge` table binds conversations that used AiZ to the
retrieval epoch. Existing unbound conversations remain unchanged. Reading a bound
conversation, continuing it (even without include_knowledge), or exporting it
requires the operator role and unchanged available source epoch. Inaccessible
conversations are excluded from listings/search results; export fails closed.
An owner can still delete their own blocked conversation. There is no automatic
rewriting of old answers or automatic reauthorization after a source change.
Tests also downgrade the same operator to reader, rather than only testing a
separate reader identity. Local initialization creates the additional table;
no installed database was migrated or modified in this task.

Session/role/tenant/module checks repeat before dispatch and every emitted
chunk. A read-only source/store fingerprint detects knowledge withdrawal or
change during budgeting/inference and stops subsequent chunks. A source can be
withdrawn after already authorized text was delivered; delivered text cannot
be recalled. Remote/offline copies already delivered cannot be recalled by the
local stored-answer guard. External upstream source freshness beyond the approved recorded revision
is not inferred: this adapter performs no network source verification.

## Actual runtime evidence

Independent AiZ HEAD: `0f45b1528dc7891d5ea3cc161495effb82cba7b6`.
Real local index: **0 approved records**. Both approved-v1 and exchange-v2 were
queried through this adapter; **0 context records**, `model_called=false`.
The exchange store exists. Temporary binding used for inspection; no persistent
production binding or permission changed.

A separate opt-in synthetic HTTP test used the existing running Qwen/llama.cpp
at loopback 8080 through the actual `backend.engine` models/template/tokenizer/
stream methods. One model was loaded. Authenticated temporary Hotel request ->
synthetic approved AiZ fixture -> bounded prompt -> real streamed output ->
`done:complete` **passed** (12.23 seconds including setup and negative checks).
No model download, installation, second engine, new listener or cloud inference.
Engine credentials were read locally by the test and never printed/persisted.

## Test evidence

- `test_knowledge_port.py`: 8 passed / 1 opt-in real-model skip in normal run.
  Actual AiZ scripts run against temporary synthetic Git/FTS5/outbox fixtures.
  Covers both protocols, approval, missing binding/store, bounds, tracked source
  withdrawal, altered index/code, payload hash corruption, conflict, provenance,
  portable scopes and instruction-as-data/no executor.
- `aiz_chat_scenarios.py`: actual FastAPI session/chat path, synthetic engine
  asserts received source revision; forged tenant denied, reader denied,
  unknown project rejected, mid-stream knowledge removal stops next chunk,
  missing binding returns 503. Temporary users/database only.
- Existing context-budget and session/role/module/document revocation tests:
  13 passed / 1 opt-in skip together before final regression.
- Independent AiZ suite: 50 tests, 46 passed / 4 skipped.
- Final full WerkZ Python suite: **64 passed / 2 skipped / 0 failed**, 96.22 s.
  Skips: existing optional scenario and explicitly opt-in real-model case;
  the latter was executed separately and passed. Existing Starlette deprecation
  warning remains; no dependency installation was performed.
- Real model test: `WERKZ_TEST_REAL_QWEN=1` opt-in pytest case: 1 passed.

CI is separate from these local results. No rerun, budget change, merge or deploy.
Continuation: use PR74's new source revision, preserve original worktree HUD WIP;
any subsequent local installation is separate from this no-deployment task.
