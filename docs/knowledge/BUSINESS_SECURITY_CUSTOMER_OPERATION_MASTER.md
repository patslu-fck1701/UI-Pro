# WerkZ Business, Security & Customer-Operation Master

**Baseline:** KB-v1.41  
**Date:** 2026-10-01

This file is the public-safe repository anchor for the consolidated commercial and operational model. The detailed private master document lives in Google Drive under the title:

`WerkZ – Masterplan Geschäftsmodell, Preise, Sicherheit, Vertrieb & Kundenbetrieb`

Do not copy private financial, founding or customer information into this public repository.

## Canonical commercial decisions

- No permanent free/basic production tier.
- Solo, Team and Business are sales presets of the same technical core, not separate products.
- Modules remain technical entitlements; the old small €9/€19/€29 per-module price seed is not the canonical commercial model.
- Public setup entries remain Solo from €490, Team from €1,490, Business from €2,490.
- Managed operation starts at €79/month, €179/month and €349/month respectively.
- Actual projects may be materially higher depending on scope, integration, migration, infrastructure and support.
- Pricing has two independent axes: solution scope and deployment/operations.

## Deployment choices

- Managed Cloud
- Dedicated Cloud
- Hybrid + local Connector
- Suitable existing customer hardware
- WerkZ Box
- Dedicated / On-Premise

Existing customer infrastructure is assessed before proposing new hardware. A WerkZ-supplied device is procured only after order. Hardware, handling, provisioning and ongoing management stay separate quote items.

## Customer installation model

Cloud-first, agent-optional.

The local connector must:
- use least privilege;
- prefer outbound encrypted connectivity;
- expose no generic remote shell;
- use device enrollment rather than embedded customer credentials;
- resolve secrets from protected secret storage;
- support signed update/revocation paths;
- audit security-relevant actions.

Windows enterprise packaging targets signed MSI plus optional bootstrapper and Intune packaging. macOS packaging targets Developer-ID-signed/notarized PKG for local agents. Single-server On-Premise targets Docker Compose first; Kubernetes is only for customers that already operate it.

## Legal/privacy/security gate

Before a normal paid production customer, align implementation with:
- B2B contractual basis / SaaS terms;
- service description and price/term/cancellation rules;
- DPA/AVV where Art. 28 GDPR applies;
- documented TOMs;
- subprocessors and transfer information;
- retention/export/exit;
- backup/restore and incident response;
- privileged MFA, tenant isolation, audit and secret management;
- connector/software licensing and update rules.

Corrections:
- C5 is not a BSI certification; it is a criteria catalogue used with independent assurance/test reports.
- A data protection officer is not automatically required merely because WerkZ is founded; German BDSG §38 and GDPR Art. 37 triggers must be checked against the actual organisation and processing.
- NIS2 scope is fact-specific; do not advertise blanket “NIS2 compliant”.
- Do not advertise blanket “GDPR compliant”; state concrete implemented controls.
- Do not invent ROI, time-saving or customer-success figures.

## Go-to-market

Initial sales motion:
website / network / targeted outbound -> pre-check -> qualification -> detail check -> workflow demo -> infrastructure/integration check -> scoped quote -> contracts -> onboarding -> acceptance -> managed operation -> expansion.

Do not build a large paid-marketing machine before the offer, demo, onboarding and first-customer economics work in practice.

## 2026 objective

October–December 2026 is the customer-readiness phase:
- finish Issue #3 production foundations;
- migrate commercial behavior to pricing catalog v0.2;
- complete auth/persistence/private storage/PWA/multi-device tests;
- implement security/recovery/backup gates;
- prepare contract/DPA/TOM/subprocessor drafts for legal review;
- define quoting, acceptance, support and onboarding;
- build a controlled demo;
- run end-to-end onboarding dry-runs;
- only sell scopes that can be technically and legally supported.

## Cross-links

- Pricing/deployment: `docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md`
- Security/privacy: `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- Deployment/connector: `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- Integrations: `docs/integrations/INTEGRATION_STRATEGY.md`
- Product/module boundaries: `docs/architecture/PRODUCT_MODULE_BOUNDARIES.md`
- Current work: `docs/operations/CURRENT_WORK.md`
- Public pricing: https://project23947.websitepublisher.ai/werkz.html
- Public pre-check: https://project23947.websitepublisher.ai/werkz-fragebogen.html
- Public technical overview: https://project23947.websitepublisher.ai/werkz-technik.html
- Public security overview: https://project23947.websitepublisher.ai/werkz-sicherheit.html
