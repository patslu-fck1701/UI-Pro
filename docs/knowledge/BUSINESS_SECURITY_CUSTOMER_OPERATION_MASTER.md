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

## Licensing, source-code and copy-protection rule

WerkZ protects commercial use primarily through server-side tenant/entitlement enforcement, controlled connector enrollment and signed releases — not by pretending browser code can be made unreadable.

- PWA/browser code is considered inspectable.
- A copied frontend has no customer authority without a valid authenticated WerkZ backend context.
- A copied local Agent is not valid without organisation-bound device enrollment.
- On-Prem/offline licensing uses signed entitlement documents where required.
- Obfuscation is optional defence-in-depth only.
- The working product repository must be private or deliberately split before proprietary production source is treated as confidential.
- Never place customer/provider/signing secrets in source control.

Canonical decision: `docs/security/LICENSING_IP_PROTECTION_FOUNDATION.md`  
Implementation issue: https://github.com/patslu-fck1701/UI-Pro/issues/5

## Product-security lifecycle and compliance rule

WerkZ production readiness now includes a separate product-security lifecycle in addition to licensing/enrollment security.

Canonical detail:
`docs/security/PRODUCT_SECURITY_LIFECYCLE_COMPLIANCE_FOUNDATION.md`

Implementation issue:
https://github.com/patslu-fck1701/UI-Pro/issues/6

Mandatory directions:
- establish vulnerability reporting/triage/remediation;
- maintain product support/EOL metadata;
- classify CRA scope per product/deployment instead of blanket claims;
- retain a CRA reporting decision path for applicable vulnerabilities/incidents;
- implement AI Act transparency state where AI features require it;
- keep enterprise identity extensible to OIDC/SAML/SCIM;
- use controlled/time-limited support access;
- test backup/restore beyond full-system backup existence;
- publish only concrete implemented compliance controls.

## IP ownership, OSS and brand protection rule

WerkZ commercialization requires a clean rights chain, third-party licence compliance and a documented brand decision.

Canonical detail:
`docs/legal/IP_OSS_BRAND_FOUNDATION.md`

Implementation issue:
https://github.com/patslu-fck1701/UI-Pro/issues/7

Mandatory directions:
- document rights basis for owner/employee/freelancer/agency contributions;
- do not assume §69b solves freelancer rights;
- treat AI-assisted output as reviewed project input, not automatic proof of copyrightability/non-infringement;
- maintain OSS/font/media inventory and release notices;
- generate SBOM + third-party notices before production release;
- preserve reasonable secrecy measures for actual trade secrets;
- clear Werk Z/WerkZ variants before trademark filing/large brand spend;
- decide insurance coverage before regular paid production customers.

## Risk and concerns rule

WerkZ decisions must capture material downsides, uncertainties and stop-gates, not only the preferred solution.

Canonical register:
`docs/governance/RISK_CONCERNS_REGISTER.md`

For IP/product decisions in particular:
- patent/design filings require a value + novelty + disclosure review;
- public technical disclosure may remove patent options;
- data/database rights must not be assumed from hosting or processing alone;
- trade-secret protection requires actual secrecy measures;
- research-report claims must be checked against primary/current sources before becoming canonical.

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
- Licensing/IP protection: `docs/security/LICENSING_IP_PROTECTION_FOUNDATION.md`
- Product security lifecycle/compliance: `docs/security/PRODUCT_SECURITY_LIFECYCLE_COMPLIANCE_FOUNDATION.md`
- IP/OSS/brand: `docs/legal/IP_OSS_BRAND_FOUNDATION.md`
- Deployment/connector: `docs/architecture/DEPLOYMENT_CONNECTOR_FOUNDATION.md`
- Integrations: `docs/integrations/INTEGRATION_STRATEGY.md`
- Product/module boundaries: `docs/architecture/PRODUCT_MODULE_BOUNDARIES.md`
- Current work: `docs/operations/CURRENT_WORK.md`
- Public pricing: https://project23947.websitepublisher.ai/werkz.html
- Public pre-check: https://project23947.websitepublisher.ai/werkz-fragebogen.html
- Public technical overview: https://project23947.websitepublisher.ai/werkz-technik.html
- Public security overview: https://project23947.websitepublisher.ai/werkz-sicherheit.html


## Pricing model boundaries and market check

WerkZ intentionally has no permanent free/basic production plan.

Pricing mechanisms are used selectively:
- **Per-seat** is not the primary model; use it later only where user count materially drives value/cost/support.
- **Pay-per-use** is appropriate for real variable consumption such as provider messages, AI usage, transactions, storage or compute.
- **Time-limited demo/sandbox** may be introduced later, but it is not a free production tier.
- **Annual prepayment/discounts** should be introduced only after real churn/support/cash-flow data exists.

Current German handcraft-software market checks show standard SaaS products already ranging from roughly €60 to €300+ per month depending on tier and users, sometimes with separate implementation or paid add-ons. WerkZ therefore must not price bespoke analysis, integration and deployment below commodity SaaS.

## Pilot rule

A pilot is not automatically free. Prefer a paid or consciously discounted fixed-scope pilot with:
- one or two defined workflows;
- measurable success/acceptance criteria;
- controlled test window;
- explicit responsibilities;
- no automatic right to publish customer name/metrics/quotes;
- post-pilot cost/support/reuse review.

## Marketing-spend rule

Large research scenarios such as €20k–€100k+ monthly marketing budgets are not a 2026 start recommendation. First prove the offer, sales motion, onboarding and unit economics through direct outreach, demos and referrals; scale paid acquisition only after CAC and contribution margin can be measured.
