# WerkZ Founding Package Index

**Shared semantic baseline:** KB-v1.41  
**Current founding-package artifact revision:** KB-v1.41  
**Status:** private artifact, cross-system linked  
**Current private update date:** 2026-10-01

The private WerkZ business-formation package has been updated against the current commercial, technical, security, deployment and customer-operation state.

Public GitHub stores only this semantic handoff. Personal case data, authority identifiers, private financial details, actual application documents and private work-hour records remain outside this public repository.

## Current private artifact

Current successor:
- `WerkZ_Gruendungspaket_Aktualisierung_KB-v1.41_2026-10-01.docx`
- `WerkZ_Gruendungspaket_Aktualisierung_KB-v1.41_2026-10-01.pdf`

Private Library location:
- `/WerkZ/Gründungspaket/`

The earlier KB-v1.29 main package and KB-v1.35 update remain historical predecessors and must not be silently overwritten.

## Public-safe KB-v1.41 delta

### Commercial model

The founding package now reflects the current commercial v2 direction:

- no permanent Free/Basic production tier;
- WerkZ Solo: setup from EUR 490, typical project range approx. EUR 790–1,490, managed operation from EUR 79/month;
- WerkZ Team: setup from EUR 1,490, typical project range approx. EUR 1,990–3,990, managed operation from EUR 179/month;
- WerkZ Business: setup from EUR 2,490, typical project range approx. EUR 3,490–7,500+, managed operation from EUR 349/month;
- Enterprise: individual project/SLA model;
- deployment/infrastructure is a separate pricing axis from solution scope.

Deployment options now explicitly include Managed Cloud, Dedicated Cloud, Hybrid + Connector, suitable existing customer hardware, WerkZ Box and Dedicated/On-Premise.

The old EUR 9/19/29-style public module-pricing seed is historical only. Modules remain technical entitlements.

### Technical progress

The founding package now records the verified development maturity without claiming production readiness.

Latest verified Issue #3 implementation checkpoint at the update:
- commit `953a625e312bd3e6b60653c2a065eac857cb57c4`;
- GitHub Actions run `36920881329`: success;
- 52/52 tests passed;
- lint/type/runtime checks passed;
- npm audit: 0 known vulnerabilities.

Implemented foundations include:
- module/entitlement contracts;
- commercial catalog v0.2;
- durable Time reference persistence;
- private binary evidence storage;
- transport-neutral Time application boundary;
- tenant/revision/conflict/idempotency tests;
- IndexedDB offline queue;
- generic mobile Time PWA;
- binary photo Blob handling;
- provider-neutral SecretStore/Connector/Webhook/Mapping contracts.

The package also records that final PWA correctness/device gates and a real non-production HTTPS Time API remain open before Issue #3 is complete.

### Live HTTPS test surface

A separate noindex/no-follow device-test frontend now exists in WebsitePublisher project 29212:

`https://project29212.websitepublisher.ai/werkz-time-test.html`

It is a test/reference surface only, not the production WerkZ backend or source of record.

### Security, privacy and customer operation

The current package now references the established foundations for:
- tenant/capability enforcement;
- secret/credential separation;
- audit;
- backup/restore;
- retention/exit;
- incident response;
- cloud-first / connector-optional deployment;
- signed/revocable local connector paths;
- B2B contractual basis;
- AVV where Art. 28 GDPR applies;
- TOMs and subprocessors;
- controlled customer onboarding and support.

It does not claim blanket GDPR/NIS2 compliance or a C5 certification.

### Go-to-market / founding readiness

The package now reflects:
- website + pre-check/detail-check;
- Solo/Team/Business public positioning;
- direct/relationship-led first-customer acquisition;
- paid or deliberately discounted pilots instead of a permanent free tier;
- reusable modules and integrations as the margin mechanism;
- customer-readiness work for October–December 2026.

### Internal maturity estimate

For internal planning only, not as a formal certification or external performance promise:
- technical foundation: approx. 70–80%;
- first genuinely sellable WerkZ scope: approx. 60–70%;
- full broad target product including larger integration/enterprise capability: approx. 40–50%.

## Financial-plan note

The existing 2027–2029 revenue tables in the earlier full business plan were built around older project-average assumptions.

They are not silently rewritten in this update. Before formal submission, they should be recalculated using the current v2 price structure and a clear split between:
- one-time implementation/project revenue;
- managed recurring revenue;
- deployment/infrastructure revenue;
- integrations/migration;
- direct provider/hardware costs.

The EUR 4,999 investment/funding framework is not automatically changed by this product/pricing update.

## Boundary

Private biographical data, authority-specific identifiers, private work-hour records, personal hardware details and the actual funding/application documents are not copied into this public repository.

Work-hour evidence is kept in the private WerkZ worklog and may be used in private founding/evidence documentation only where appropriate.

## Source-of-truth links

- commercial/customer-operation master: `docs/knowledge/BUSINESS_SECURITY_CUSTOMER_OPERATION_MASTER.md`
- pricing/deployment v2: `docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md`
- security/privacy: `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- deployment/connector: `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- integrations: `docs/integrations/INTEGRATION_STRATEGY.md`
- current implementation work: `docs/operations/CURRENT_WORK.md`
- WebsitePublisher Time test handoff: `docs/testing/WEBSITEPUBLISHER_TIME_TEST_HOST.md`

Later founding-package revisions must be linked as successors rather than silently replacing KB-v1.41 history.
