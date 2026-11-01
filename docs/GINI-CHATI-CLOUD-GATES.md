# GINI + CHATI: Cloud-only integration gate (draft, 2026-11-01)

Status: SOURCE VERIFIED / NOT DEPLOYED / NOT GRANTED / NOT LIVE VERIFIED.

## Keep existing installation
- Retain the single existing WerkZ Control Center application, /gini conversation route and /assistant operator route. Do not replace them or construct a second app.
- Local WERKZ-AI Qwen: 127.0.0.1:8081 (outbound-only signed worker); separate UI-Pro instance on 8080; GINI Neon on 8091. No incoming firewall openings or public localhost tunnels.
- In apps/local-ai/scripts/bridge-analyze.py the source currently uses asyncio.timeout(20), with response_tokens=128. This is a probable contributing factor for long-prompt MODEL_TIMEOUT, not proven. Do not increase the limit without comparing server lease TTL, job expiry, CPU generation time and worker cancellation.
- Preserve Auth/RLS, operator permissions, Ed25519 worker identity and explicit approval gates.

## CHATI: proposed permissions only, not activated
- Distinct CHATI service identity and a scoped **cloud-only** storage connector. No local mounts, SMB, Windows filesystem, localhost file access, private keys, customers' documents or arbitrary tool execution.
- Default: deny. Operator explicitly selects cloud provider, approved workspace/container, authorized folders, supported file types, maximum size and expiry. The authorization must be enforced server-side with per-user ACL / RLS, not merely hidden in UI.
- Read access only to explicitly whitelisted cloud source folders. No delete, move, rename or overwrite.
- Write access, if separately granted, only to a dedicated output prefix/folder `CHATI-generated/` underneath the approved cloud workspace. Use create-if-absent / conditional-create semantics; on filename collision create an additional uniquely named file in the output folder rather than replacing any object.
- Never write back to the source directory, even when the filename is unchanged. Preserve input originals and metadata, store provenance (origin cloud object identifier, version, request ID, timestamp), reject path traversal and symlink-like redirection.
- Limit tool calls per job, request input/output bytes, request duration, per-user monthly budget and concurrent jobs; redact tokens, raw document contents and keys from logs. Require a new approval for every new cloud scope.
- Cloud credentials must stay in a managed secret store, never in Git, client-side browser state or log output. CHATI may not delegate broader permissions to GINI, or vice versa.
- No background polling, file processing or cloud connector activation until the operator explicitly approves exact cloud scopes.

## Gate order
1. Read-only checks on the Windows side (new opt-in diagnostic companion, never a repair).
2. Source tests for timeout/expiry handling using synthetic jobs; separate repo edits and actual Windows installation updates.
3. Owner-authenticated /assistant signed small-prompt then long-prompt round trip, compare job / model / lease timings (no customer data).
4. Review CHATI cloud provider, identity, folder grants, quotas and create-only API behavior. Obtain operator approval, implement behind default-off flags, add permission-denied and no-overwrite tests.
5. Only after isolated pass review gated rollout; no publication or deployment is implied by this document.

## Manual diagnostics
Run the additive `tools/windows/Test-GiniChati-ReadOnly.ps1` from the approved checkout. It never writes to local installation, reads keys or starts/stops processes.

## Source references
- `apps/local-ai/scripts/bridge-analyze.py`
- `apps/local-ai/backend/engine.py`
- Existing WerkZ handoff / workflow docs are separate and must be rechecked against live status.
