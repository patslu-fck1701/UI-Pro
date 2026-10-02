# WerkZ Device Enrollment & Revocation Runbook

**Status:** operational reference for Issue #5  
**Scope:** non-secret device/connector enrollment process. Production key custody and hosting policy remain separate.

## Purpose

A copied Agent/Connector installation must not become a valid second deployment merely because files were copied. A valid local device must complete organisation-bound enrollment and prove possession of its own Ed25519 private key.

## Operational commands

Issue a short-lived enrollment token:

```bash
node tools/device-enrollment.js issue <state-file> <organisation-id> <requested-by> [ttl-minutes]
```

Enroll a device using its public key:

```bash
node tools/device-enrollment.js enroll <state-file> <token> <public-key-file> [label]
```

List enrolled devices:

```bash
node tools/device-enrollment.js list <state-file> [organisation-id] [status]
```

Revoke a device:

```bash
node tools/device-enrollment.js revoke <state-file> <device-id> <actor-id> <reason...>
```

Run the automated issue → enroll → authenticate → revoke → denial drill:

```bash
node tools/device-enrollment.js drill <state-file> <organisation-id> <actor-id>
```

## Rules

- Treat enrollment tokens as short-lived secrets; never commit or paste them into repository files.
- Device private keys are generated on the device and are never stored in the server enrollment state.
- Server state stores token digests, device public keys, status and revocation evidence.
- A copied installation without the enrolled private key must fail the challenge.
- Revoked devices must fail before receiving a new challenge.
- Re-enrollment requires a fresh owner/admin-approved token.
- Production state files need access control, backup and deployment-level durability.
- Production signing/licence keys are separate from device keys.

## Headless approval

`DeviceAuthorizationFlow` provides the browser approval path for connectors that cannot complete a normal browser flow:

Agent starts → short user code → admin opens HTTPS verification URI → admin approves in organisation context → Agent polls with rate limiting → one-time enrollment token returned → Agent enrolls its own public key.

The approval flow never requires a reusable master token to be pasted into the Agent.
