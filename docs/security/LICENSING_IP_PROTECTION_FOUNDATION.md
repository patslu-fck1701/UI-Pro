# WerkZ Licensing, IP Protection, Enrollment & Release Security Foundation

**Date:** 2026-10-01  
**Status:** canonical cross-cutting security/deployment decision  
**Implementation issue:** https://github.com/patslu-fck1701/UI-Pro/issues/5  
**Applies to:** WerkZ Cloud/Core, browser/PWA clients, local Agent/Connector, Dedicated/On-Premise and offline distribution

## 1. Core decision

WerkZ does **not** attempt to protect the product primarily by making customer-delivered files unreadable.

Browser/PWA code is assumed to be inspectable and copyable. Local binaries can be reverse engineered to some degree. Therefore the security and commercial protection boundary is:

```
authenticated identity
-> server-derived organisation/tenant
-> contract + entitlements/capabilities
-> authorised API/resource
-> optional enrolled device identity
-> signed/trusted release or offline licence
```

A copied UI, copied JavaScript bundle or copied Agent directory must not be enough to create a valid second customer deployment.

This foundation extends, and does not replace:
- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- `docs/integrations/INTEGRATION_STRATEGY.md`
- `docs/knowledge/BUSINESS_SECURITY_CUSTOMER_OPERATION_MASTER.md`

## 2. Protection model by deployment type

### 2.1 Managed Cloud / PWA

Default protection:
- authenticated server session;
- organisation derived server-side from authenticated identity;
- tenant isolation at repository/application boundaries;
- server-side entitlement/capability checks on protected operations;
- customer data and central secrets never embedded in browser bundles;
- PWA/service worker never becomes the system of record;
- no security decision based only on hidden UI, JavaScript flags or localStorage.

Copying HTML/CSS/JavaScript may reproduce appearance, but must not grant a valid WerkZ customer identity, tenant, data access or paid module entitlement.

### 2.2 Hybrid + local Agent/Connector

The local Agent is separately enrolled.

Logical flow:

```
install trusted package
-> create/read local device identity
-> present short-lived one-time enrollment material
-> register device
-> bind device to organisation
-> issue device credential/certificate
-> fetch allowlisted connector configuration
-> health check
```

Rules:
- enrollment material is short-lived and one-time;
- long-lived device credentials are not human sessions;
- device credentials are not provider/customer API credentials;
- installer/config never contains a reusable WerkZ master secret;
- copied Agent files on another machine do not automatically create another enrolled device;
- revocation and re-enrollment are supported;
- local secrets use OS/device-appropriate protected storage;
- outbound TLS/443 is preferred;
- no generic remote shell;
- no arbitrary cloud-triggered CMD/PowerShell execution.

### 2.3 Dedicated / On-Premise / offline

Where the deployment cannot rely on continuous WerkZ Cloud licence checks, use a signed licence/entitlement document.

Conceptual fields:
- licence schema/version;
- customer/organisation identifier;
- deployment identifier;
- entitled modules/capabilities;
- contractual limits where technically relevant;
- issue/validity/renewal metadata where the purchased model requires it;
- licence serial/key id;
- optional offline-policy metadata.

The licence is signed by WerkZ with private signing material that is **never shipped**. The customer installation receives only the public verification key needed to verify authenticity and integrity.

Do not embed a reusable symmetric master licensing secret into customer software.

Self-managed On-Premise remains a legitimate deployment option. Do not invent an always-online requirement solely for licence enforcement when the purchased deployment is supposed to operate independently.

## 3. Entitlements are the licensing core

WerkZ already models organisation-level entitlements. Reuse that model.

Do **not** create a parallel product-licence database that can disagree with commercial entitlements.

Canonical relationship:

```
contract/order
-> organisation
-> entitlement set
-> modules/capabilities
-> user/device permissions
-> authorised operations
```

Requirements:
- organisation context is server-derived;
- client-supplied tenant/org identifiers are never sufficient authority;
- absent/suspended/expired entitlement denies protected use;
- entitlement changes are auditable;
- denial must not corrupt or delete customer data;
- export/exit rights remain handled according to contract and law.

## 4. Release and update trust

Every distributed local production release should converge on one release pipeline.

Target release evidence:
- versioned `release.json` or equivalent manifest;
- SHA-256 or stronger current digest for artifacts;
- code/package/container signature as applicable;
- trusted timestamp where applicable;
- SBOM / third-party notices;
- build/test status;
- compatibility metadata;
- upgrade/downgrade/rollback metadata;
- release notes.

Signing rules:
- signing credentials are separated from normal developer credentials;
- signing private keys are never included in repository, installer, browser code or customer configuration;
- installation/update verifies origin and integrity before execution;
- tampered packages/manifests fail closed;
- rollout can be staged and revoked/rolled back where operationally possible.

Windows production packages should use signed MSI as the canonical enterprise package, with an optional signed bootstrapper when useful. macOS/Linux/container signing follows the deployment foundation.

## 5. Obfuscation and anti-tamper

Obfuscation is allowed only as defence-in-depth for compiled local components where it gives practical value.

It is **not**:
- authentication;
- authorisation;
- tenant isolation;
- entitlement enforcement;
- secret storage;
- licence authenticity.

Minification or obfuscation must never be documented as making browser code confidential.

Do not delay core server-side protection in order to add obfuscation.

## 6. Secret and key placement

Use the existing three-class secret model:

1. WerkZ-global credentials/signing material;
2. organisation/customer provider credentials;
3. device/Agent enrollment and device credentials.

Additional licensing rule:
4. offline licence signing private keys are WerkZ-global high-value signing material.

Rules:
- no plaintext secrets in business records or logs;
- browser receives user/device-appropriate sessions only;
- customer package contains public verification material, not private signing material;
- key storage must be replaceable by managed KMS/HSM/vault when operational maturity justifies it.

A dedicated HSM per customer is **not** an MVP requirement.

## 7. Repository and source-code policy

At the time this foundation was created, `patslu-fck1701/UI-Pro` was verified as **public**.

That is incompatible with treating proprietary source already committed there as confidential.

Required owner decision before proprietary production:
- either make the working product repository private;
- or split deliberately public-safe documentation/reference code from private proprietary product repositories.

Never commit:
- customer data;
- provider tokens;
- OAuth client secrets where confidential;
- signing private keys;
- licence-signing private keys;
- production database credentials;
- private customer configuration;
- secrets in test fixtures.

If a credential is ever committed publicly, removing the file is not enough: rotate/revoke the credential.

Repository visibility is an operational blocker, not something obfuscation can repair after disclosure.

## 8. Networking defaults

Default local connector network posture:
- outbound TLS, normally HTTPS/443;
- explicit proxy support where needed;
- no HTTP fallback for protected production traffic;
- no inbound SSH/RDP/general remote shell as a product requirement;
- SFTP/SSH only when a specific customer integration genuinely requires that protocol and then with least privilege;
- no self-signed trust shortcut unless a controlled customer environment explicitly requires and manages its own trust chain.

Remote support must be a separate controlled operational procedure, not an always-on product backdoor.

## 9. Advanced protections — deferred unless justified

Not baseline MVP requirements:
- CodeMeter/USB licence dongles;
- per-customer hardware HSM;
- TPM attestation;
- Secure Enclave / SGX-style execution;
- complex TUF deployment;
- Kubernetes solely for security;
- blanket FIPS claims;
- blanket AES-256 marketing claims.

These may be evaluated later for specific enterprise, air-gapped or high-assurance customers.

Use the simplest control that satisfies the real threat model and contract.

## 10. Legal/contract boundary

Technical protection is supported by contracts, not replaced by them.

The current B2B AGB is published at:
https://project23947.websitepublisher.ai/agb.html

Local software/Connector delivery additionally requires a dedicated software/Connector licence or contract annex before regular paid production delivery.

The licence terms should cover:
- permitted internal business use;
- user/device/deployment scope where applicable;
- no sublicensing/redistribution outside agreed rights;
- no source-code delivery unless explicitly agreed;
- confidentiality and protection of credentials;
- update/support lifecycle;
- termination/exit consequences;
- OSS/third-party notices;
- statutory rights remain unaffected.

Do **not** rely on a blanket contractual ban on all observation, testing, decompilation or interoperability work. Mandatory statutory software rights must remain preserved.

## 11. Required acceptance tests

A production protection boundary is not complete without tests proving at least:

### Cloud/PWA
- a user cannot select another tenant by changing a request parameter;
- absent entitlement denies protected API functionality;
- suspended entitlement denies use without deleting customer data;
- browser bundle contains no central/provider/signing secrets;
- copying the frontend to another environment does not grant customer access.

### Agent/Connector
- copied Agent files on another machine are not a second enrolled deployment;
- one-time enrollment material cannot be reused;
- revoked device credential is denied;
- wrong-tenant device cannot reach another tenant;
- arbitrary command execution is not available.

### Offline/On-Prem licence
- valid signed licence verifies;
- modified entitlement/limit fails signature validation;
- wrong public verification key fails;
- expired/revoked state behaves according to contract;
- private signing key is absent from shipped artifacts.

### Release/update
- digest mismatch fails;
- signature mismatch fails;
- unsupported downgrade/rollback is handled explicitly;
- build artifacts contain no secret values.

## 12. Implementation sequence

### Immediate governance
1. resolve public-repository policy before confidential proprietary production development;
2. keep secrets out of current public repository regardless of future visibility;
3. keep Issue #3 focused on its current PWA/API correctness gates.

### Next implementation package
Issue #5 — **WerkZ Licensing, Enrollment & Release Security**:
https://github.com/patslu-fck1701/UI-Pro/issues/5

After Issue #3 completes, implement:
1. entitlement/licence verification boundary on top of existing organisation entitlements;
2. connector enrollment/device identity/revocation contracts;
3. signed release manifest and verification contracts;
4. signed offline/On-Prem licence model;
5. negative security and copy-resistance acceptance tests;
6. production packaging/signing implementation only after the contracts/tests are stable.

### Later
Evaluate HSM/KMS provider, commercial code-signing certificate/provider, enterprise attestation/dongles and advanced update framework based on actual deployment/customer need.

## IP ownership, OSS and brand dependency

Commercial protection also depends on a clean rights chain and third-party licence compliance.

Canonical detail:
`docs/legal/IP_OSS_BRAND_FOUNDATION.md`

Implementation issue:
https://github.com/patslu-fck1701/UI-Pro/issues/7

Before normal paid production rollout:
- material contributors must have a documented rights basis;
- freelancer/agency work requires explicit rights clauses;
- third-party/OSS/font licences must be inventoried and release obligations preserved;
- SBOM/third-party notices must be reproducible;
- confidential source must not rely on a public repository for secrecy;
- trademark clearance must precede filing/major brand spend;
- mandatory software-user rights remain preserved.

## Product-security lifecycle dependency

Licensing/enrollment controls are not sufficient by themselves for a production rollout.

Also read:
`docs/security/PRODUCT_SECURITY_LIFECYCLE_COMPLIANCE_FOUNDATION.md`

Issue #6:
https://github.com/patslu-fck1701/UI-Pro/issues/6

Before normal paid production rollout, distributed product profiles must also have:
- vulnerability intake/remediation process;
- support/EOL metadata;
- CRA reporting assessment path where applicable;
- security release/channel metadata;
- AI transparency state where AI features are shipped;
- temporary/scoped support access;
- tested recovery expectations.

Issue #5 and Issue #6 may share an implementation branch if responsibilities remain explicit, but neither foundation may be silently omitted.

## 13. Definition of done

This foundation is implemented only when:
- the repository/source visibility policy is resolved for proprietary work;
- protected product authority is server-side;
- tenant and entitlement checks are release-gated;
- a copied frontend cannot become another valid tenant;
- a copied Agent cannot become another valid enrolled device;
- On-Prem/offline entitlement authenticity uses asymmetric signatures;
- distributed production packages have a defined signing/verification path;
- signing/private licence keys are never shipped;
- security tests cover tampering, copy/re-enrollment and cross-tenant denial;
- contract/licence wording matches the implemented deployment model.

## Source rationale

This decision incorporates the 2026-10-01 WerkZ research on copy protection, licensing, code signing, key management, deployment and anti-tamper measures, but narrows it to the actual WerkZ architecture:

- cloud-first and agent-optional;
- browser/PWA first;
- organisation entitlements already exist;
- local Agent is optional and constrained;
- On-Premise remains supported;
- advanced enterprise controls are deferred until justified.

The architecture deliberately prefers enforceable identity/tenant/entitlement boundaries over cosmetic attempts to make delivered code unreadable.
