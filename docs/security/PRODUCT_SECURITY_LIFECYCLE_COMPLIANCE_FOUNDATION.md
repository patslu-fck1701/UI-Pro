# WerkZ Product Security Lifecycle & Compliance Foundation

**Date:** 2026-10-01  
**Status:** canonical cross-cutting product-security baseline  
**Implementation issue:** https://github.com/patslu-fck1701/UI-Pro/issues/6

## 1. Purpose

WerkZ security is a lifecycle obligation, not a one-time release gate.

This foundation defines how WerkZ handles:
- vulnerability intake and remediation;
- release/support/EOL metadata;
- Cyber Resilience Act (CRA) readiness;
- AI Act transparency state;
- enterprise identity direction;
- connector/device authorisation UX;
- release channels and rollback;
- controlled support access;
- tenant-aware backup/restore testing.

It must be read together with:
- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/security/LICENSING_IP_PROTECTION_FOUNDATION.md`
- `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- `docs/knowledge/BUSINESS_SECURITY_CUSTOMER_OPERATION_MASTER.md`

## 2. Cyber Resilience Act readiness

CRA applicability must be classified per product/deployment. Do not market blanket “CRA compliant”.

Current official baseline:
- from **11 September 2026**, manufacturers must report actively exploited vulnerabilities and severe incidents affecting the security of products with digital elements where the CRA reporting duty applies;
- the operational reporting sequence includes an early warning within 24 hours of awareness and a main notification within 72 hours;
- final reports follow the CRA timelines for exploited vulnerabilities and severe incidents;
- the CRA establishes support-period and vulnerability-handling obligations for products with digital elements;
- the baseline support period is at least five years unless the expected product use time is shorter;
- manufacturers must maintain processes for coordinated vulnerability disclosure and vulnerability handling.

Official references:
- https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- https://digital-strategy.ec.europa.eu/en/policies/cra-summary
- https://eur-lex.europa.eu/eli/reg/2024/2847/2024-11-20/eng

### 2.1 CRA classification record

For each distributable WerkZ product/profile keep a compliance record with at least:
- product/deployment identifier;
- whether it is made available on the EU market;
- manufacturer/provider role;
- whether CRA scope is likely, excluded, or requires legal review;
- product/support owner;
- support-period rationale;
- vulnerability-reporting decision owner;
- technical documentation location;
- current supported versions;
- date of last classification review.

### 2.2 Reporting decision path

When a vulnerability or security incident is discovered:

```
intake
-> validate
-> severity / exploitability
-> affected products/versions
-> active exploitation / severe-incident assessment
-> legal/privacy/security reporting assessment
-> containment/fix
-> signed release
-> customer communication
-> CRA / GDPR / other reporting if applicable
-> final report / postmortem
```

Do not wait for a polished postmortem before the applicable statutory early-notification deadline.

## 3. Product support lifecycle

Every distributed product/release line must be able to represent:

- `product_id`
- `version`
- `released_at`
- `support_started_at`
- `supported_until`
- `security_status`
- `minimum_supported_version`
- `superseded_by`
- `release_channel`
- `eol_notice_at`
- `eol_effective_at`
- `support_contact`
- `security_advisory_refs`

Do not promise indefinite support.

Customer-facing product information must eventually make the relevant support end date clear where required.

## 4. Vulnerability management / PSIRT-lite

WerkZ needs a lightweight but explicit product-security response process.

### 4.1 Intake
Accepted channels should include:
- a dedicated security contact when available;
- until then, the published WerkZ contact with a clear SECURITY subject convention;
- private reports, not public issue disclosure for unpatched vulnerabilities.

Public-safe repository policy:
`SECURITY.md`

Production-domain target:
`/.well-known/security.txt`

### 4.2 Triage record

Each vulnerability record should capture:
- identifier;
- discovery/source;
- affected product/version;
- tenant/customer impact scope;
- confidentiality/integrity/availability impact;
- exploitability / known exploitation;
- severity and rationale;
- owner;
- containment status;
- fix version;
- disclosure status;
- customer-notification status;
- regulatory-reporting assessment;
- postmortem/remediation actions.

### 4.3 Security advisory path

Preferred sequence:
report -> validate -> contain -> fix -> test -> sign -> staged release -> customer advisory -> public advisory where appropriate.

Never publish exploit-enabling details before a mitigation/fix is reasonably available unless legal/safety duties require otherwise.

## 5. Release channels and security release metadata

WerkZ release channels:

1. **canary** — internal/very limited technical validation;
2. **pilot** — controlled customer/test cohort;
3. **stable** — normal supported release;
4. **LTS** — optional later channel for customers needing longer change windows.

Every release should carry:
- version and build id;
- channel;
- supported-from / supported-until;
- compatible server/client/agent versions;
- schema/data migration requirements;
- rollback compatibility;
- security-fix indicator;
- release notes;
- SBOM reference;
- artifact hashes/signatures;
- minimum supported predecessor where relevant.

Emergency security releases may bypass normal feature cadence but not signature/integrity verification.

## 6. AI Act transparency baseline

AI Act Article 50 transparency obligations apply from **2 August 2026** for certain AI systems/providers/deployers.

Official references:
- https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations
- https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems

WerkZ must not treat AI as an invisible implementation detail where transparency duties apply.

### 6.1 AI interaction/output metadata

Where technically relevant, preserve:
- `ai_assisted`
- `provider`
- `model_family`
- `model_version_or_reference`
- `generated_at`
- `human_review_required`
- `human_reviewed_at`
- `human_approved_by`
- `source_context_refs`
- `content_marking_state`

### 6.2 UX rules

- Users must be clearly informed when they directly interact with an AI system where required.
- Generated/manipulated content must support the applicable marking/labelling duties.
- “AI suggestion” must not visually masquerade as a verified human decision.
- Legally/financially/personnel-relevant actions must retain the existing human-approval boundary.
- AI-generated content must not silently become immutable business truth.

### 6.3 Product classification

Before shipping a new AI feature, record:
- provider vs deployer role;
- intended purpose;
- user population;
- whether Article 50 transparency duties apply;
- whether any high-risk or prohibited-practice analysis is required;
- human oversight requirement;
- retention/logging policy.

## 7. Enterprise identity direction

WerkZ remains provider-neutral but must support enterprise identity growth without redesigning the core.

Target capabilities:
- OIDC;
- SAML where enterprise customers require it;
- SCIM user/group provisioning;
- MFA / WebAuthn support;
- role/group mapping;
- joiner/mover/leaver automation;
- deprovisioning and entitlement audit.

SCIM reference:
https://www.rfc-editor.org/info/rfc7643/

A large customer should be able to automate employee lifecycle without WerkZ manually maintaining every user.

## 8. Connector/device authorisation UX

For headless or browser-limited connectors, prefer standards-based device approval.

OAuth 2.0 Device Authorization Grant reference:
https://www.rfc-editor.org/info/rfc8628/

Conceptual flow:

```
Agent starts enrollment
-> server returns verification URI + short user code / QR
-> customer admin authenticates in normal browser
-> customer approves device/organisation binding
-> Agent polls over outbound HTTPS
-> server issues device credential
-> device enters health/config stage
```

Rules:
- rate-limit user-code attempts;
- codes are short-lived;
- device approval shows organisation/device context;
- no long-term master token is pasted manually;
- commercial licensing is not bound solely to CPU/BIOS fingerprints;
- TPM-backed keys may later strengthen local private-key protection but are optional.

## 9. Windows packaging policy

Keep **signed MSI** as the canonical first Windows Agent/Connector package for broad server/enterprise compatibility.

MSIX may be added where useful.

Microsoft currently documents:
- MSIX generally supports Windows 10 1709+ and Windows Server 2019+;
- packaged Windows-service support requires Windows 10 2004+;
- Windows Server 2019 does **not** support MSIX Windows services;
- Windows Server 2022 does support MSIX Windows services.

Reference:
https://learn.microsoft.com/en-us/windows/msix/supported-platforms

Therefore:
- do not replace MSI with MSIX as the only Agent package;
- evaluate MSIX per target customer estate;
- preserve silent install/uninstall and enterprise deployment support.

## 10. Linux packaging corrections

Do not carry forward outdated `apt-key` patterns into the production design.

Use current repository-specific signing/keyring patterns with `Signed-By` or the distribution's current supported mechanism.

Linux package trust uses package/repository signatures; do not describe it as S/MIME.

## 11. Update confidentiality vs integrity

Protected production update transport requires:
- TLS for transport;
- cryptographic signature/trust verification;
- digest/hash verification;
- authenticated release metadata.

The update payload itself does not always require separate encryption if it is not confidential.

Do not confuse confidentiality with authenticity/integrity.

## 12. Controlled support access

WerkZ support access is explicit, scoped and temporary.

Target flow:

```
customer requests/approves support
-> support grant created
-> named WerkZ support actor
-> ticket/reason
-> allowed capabilities/resources
-> start time
-> automatic expiry
-> audit trail
-> optional customer-visible revocation
```

Rules:
- no permanent hidden support account;
- no shared customer password;
- no generic remote shell as standard product access;
- least privilege;
- privileged actions require stronger confirmation where risk justifies it.

## 13. Tenant-aware backup and restore

“Backups exist” is not enough.

Production recovery must test:
- database records;
- private object/file storage;
- entitlements/configuration;
- identity references;
- audit/history;
- version/schema compatibility.

Where architecture permits, prove tenant-scoped recovery without restoring unrelated tenants.

Recovery tests must detect:
- cross-tenant leakage;
- mismatched DB/file snapshots;
- stale entitlement state;
- orphaned evidence/files;
- incompatible application/schema version.

Do not publish RPO/RTO promises until measured and operationally supported.

## 14. On-Premise privacy-role correction

On-Premise does **not** automatically mean WerkZ is never a processor.

Assess actual data flows:
- remote support;
- telemetry;
- cloud backup;
- monitoring;
- licensing telemetry;
- hosted identity;
- update diagnostics;
- managed operations.

If WerkZ processes personal data on behalf of the customer through any of those paths, Art. 28 GDPR analysis may still be required.

## 15. NIS2 positioning

NIS2/Bundesrecht applicability is fact-specific.

WerkZ should implement strong supplier/security controls that make it suitable for regulated customers, but must not advertise blanket “NIS2 compliant” status without a scope-specific legal and technical assessment.

Customer security questionnaires should be answered with concrete implemented controls.

## 16. Security testing baseline

Continuous/recurring checks should include as applicable:
- dependency scanning;
- SAST;
- secret scanning;
- container/package scanning;
- DAST for deployed web/API surfaces;
- cross-tenant negative tests;
- authentication/authorisation regression tests;
- update-signature/tamper tests;
- restore drills;
- vulnerability-response tabletop exercise.

SBOM format should remain standards-based, e.g. CycloneDX or SPDX.

## 17. Compliance claims rule

Never publish unsupported blanket claims such as:
- “GDPR compliant”;
- “NIS2 compliant”;
- “CRA certified”;
- “ISO 27001 certified”;
- “TISAX certified”;
- “all data stays in Germany”;
- “AES-256 everywhere”;
- “zero-trust certified”.

State concrete controls and audited/certified scope only when evidence exists.

## 18. Immediate implementation order

1. finish current Issue #3 correctness/device-test gates;
2. keep Issue #5 licensing/enrollment/release trust mandatory;
3. implement Issue #6 product-security lifecycle/compliance controls;
4. then permit normal paid production rollout for scopes whose controls are demonstrably complete;
5. live provider integrations must obey both Issue #5 and #6 foundations.

Issue #6:
https://github.com/patslu-fck1701/UI-Pro/issues/6

## 18A. OSS/IP release dependency

Security release evidence must include legal provenance for shipped components.

Also read:
`docs/legal/IP_OSS_BRAND_FOUNDATION.md`

Issue #7:
https://github.com/patslu-fck1701/UI-Pro/issues/7

Release evidence should include:
- dependency/licence inventory;
- SBOM;
- required third-party notices/licence texts;
- provenance for bundled fonts/assets;
- rights basis for material proprietary contributions.

## 19. Definition of done

This foundation is operational when:
- each distributed product has support/EOL metadata;
- a vulnerability reporting channel/process exists;
- CRA reporting decision path exists;
- security releases can be produced and tracked;
- AI features carry transparency/review state;
- enterprise identity ports can accommodate OIDC/SAML/SCIM;
- connector enrollment can support a secure device-authorisation UX;
- support access is temporary/scoped/audited;
- restore testing covers data + private files + entitlements + audit;
- unsupported compliance claims are blocked;
- release/security evidence is retained.

## Source note

This foundation incorporates the 2026-10-01 WerkZ deployment/security research but corrects outdated or overbroad recommendations, including:
- no `apt-key` future design;
- no S/MIME claim for Linux package signing;
- no hardware fingerprint as the default licensing boundary;
- no assumption that On-Premise removes all processor roles;
- no blanket NIS2/CRA/GDPR compliance marketing;
- no confusion between update encryption and signature/integrity;
- no generic remote administration backdoor.
