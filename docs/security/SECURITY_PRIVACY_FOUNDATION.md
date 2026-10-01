# WerkZ Security, Privacy & Commercial Readiness Foundation

**Date:** 2026-10-01  
**Status:** cross-cutting product baseline — applies to every production module, deployment profile and integration  
**Source:** Werk Z legal/privacy/security research, 2026-10-01

## Why this is a product requirement

WerkZ security and privacy are not a later legal wrapper. The technical implementation must be able to support the promises made in contracts, AVV/DPA, TOMs, support procedures and customer security documentation.

The implementation must therefore preserve these properties from the beginning rather than retrofit them after customer rollout.

## Identity and access

- Every human and machine actor has an explicit identity.
- Organisation/tenant scope is mandatory on production data and operations.
- Authorisation is capability-based and enforced server-side.
- Privileged WerkZ administration requires MFA when a real identity provider/admin surface is introduced.
- Least privilege applies to users, services, jobs and local agents.
- Joiner/mover/leaver and entitlement changes are auditable.
- Support must never require asking for a customer's password.

## Authentication and recovery

Prefer OAuth/OIDC or provider-native delegated authorisation over collecting customer passwords.

Recovery for tenant owners and privileged accounts must use verified channels and auditable recovery events. High-risk recovery may require additional confirmation or a four-eyes rule. Existing administrators should be notified where appropriate.

## Secret model

WerkZ separates secrets into three classes:

1. **WerkZ-global** — OAuth application credentials, signing material, infrastructure credentials.
2. **Organisation/customer** — provider tokens, API keys, app passwords, SFTP credentials.
3. **Device/agent** — enrollment credentials, device certificate/private key, rotation state.

Rules:

- business tables store credential references, not plaintext secret values;
- logs and audit events never contain secret values;
- secret storage must support encryption, rotation and revocation;
- browser/mobile clients receive sessions/tokens appropriate to the user/device, not central WerkZ application secrets;
- private signing keys are not distributed to developer laptops or customer installers.

The provider-neutral SecretStore abstraction belongs in the integration foundation.

## Data protection and tenant isolation

- Customer/employee operational data is private by default.
- Tenant isolation is enforced in repository/application boundaries, not just UI filtering.
- Cross-tenant negative tests are release-blocking for sensitive modules.
- Data minimisation applies to provider scopes, stored fields and logs.
- Public website/reference data and production customer data remain separate systems.
- Real and simulated data remain strictly separated.

## Encryption and transport

- TLS is required for network transport.
- Sensitive stored data and secrets require appropriate encryption at rest.
- Key management must be replaceable by a managed KMS/HSM/vault model.
- No unsupported claim such as “all data stays in Germany” may be made unless the actual provider/support chain proves it.

## Audit and automation safety

Critical actions produce structured audit/history events with actor, organisation, time, entity, action, correlation/idempotency and outcome.

Irreversible or legally relevant actions should not be executed solely from an LLM result. Human approval should be available for actions such as final invoice sending, payment/bank detail changes, privileged-user creation/deletion, rights changes, destructive bulk deletion, legally relevant outbound declarations and irreversible ERP actions.

Approval channels such as WhatsApp/email are adapters only; WerkZ Core owns the decision state.

## Backup, restore, retention and exit

Production persistence needs documented backup/restore, tested restoration, data-class-specific retention, export capability, controlled deletion after contract end, separate handling of legally required retention and documented treatment of backups after deletion.

Operational modules must not assume “delete immediately everywhere” or “retain forever”.

## Incident response

The operational model must support:

detect -> contain -> preserve evidence/logs -> assess impact -> determine affected tenants -> determine privacy role -> notify as required -> recover -> root-cause analysis -> document remediation.

WerkZ must be able to notify controllers/customers without undue delay when acting as processor. Customer contracts must not promise response times that the real operating process cannot meet.

## Subprocessors and provider registry

Every external provider that may process customer data must be representable in a maintained registry with provider, purpose, data categories, processing region, role/subprocessor status, transfer basis where relevant, retention/deletion notes and current contract/DPA status.

Provider choice must remain replaceable at the adapter layer.

## Local connector security

A customer-side WerkZ Agent/Connector must run with only required privileges, prefer outbound TLS connections, never expose a generic remote shell, never accept arbitrary cloud-triggered CMD/PowerShell execution, use device-bound identity/enrollment, store local secrets securely, produce auditable operational logs without secret leakage, accept only trusted/signed updates, support clean uninstall/revocation and have documented supported versions/update lifetime.

## Release and software supply chain

Before distributing local software, WerkZ must support signed release artifacts, checksums, versioned release manifests, SBOM/third-party notices, dependency/vulnerability scanning, controlled update/rollback channels and separation of build, signing and release credentials.

## Commercial/legal readiness gate

Before the first regular paying production customer, the business process must have a reviewed set of at least:

- B2B contract/AGB framework;
- concrete service description;
- pricing/term/cancellation rules;
- AVV/DPA where applicable;
- TOMs;
- privacy notices;
- subprocessor list;
- data-location/transfer information;
- support and recovery rules;
- retention/export/exit rules;
- incident/security policy;
- connector/software licence terms where local software is delivered;
- evidence of contract version/acceptance.

Final legal wording must be reviewed by qualified counsel; this repository baseline defines technical capabilities and release gates, not final legal advice.

## Engineering release gates

A production release is not “ready” if any of these are missing for the affected scope: tenant/capability enforcement, secret-safe logging, backup/restore path, privacy/retention classification, audit coverage for critical commands, negative authorisation tests, update/revocation path for local agents, and documented external providers/data flow.

## Source references

Current connected source files:
- Legal/security research: Files Library id libfile_5d136d2dad948191868284839d1e7cf5
- Executive security/deployment summary: Files Library id libfile_cbe8eb41c5e48191a9662acd5eb6e995

This foundation must be read together with:
- docs/integrations/INTEGRATION_STRATEGY.md
- docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md
- docs/architecture/DEPLOYMENT_TOPOLOGY.md
