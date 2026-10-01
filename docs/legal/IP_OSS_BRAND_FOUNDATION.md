# WerkZ IP Ownership, OSS Compliance & Brand Protection Foundation

**Date:** 2026-10-01  
**Status:** canonical cross-cutting legal/product baseline  
**Implementation issue:** https://github.com/patslu-fck1701/UI-Pro/issues/7

## 1. Purpose

WerkZ must be able to prove that it has the rights needed to commercialise its own work while also respecting third-party software, font, media and AI-provider terms.

This foundation covers:
- chain of title / rights provenance;
- employees, freelancers, agencies and contributors;
- AI-assisted development provenance;
- open-source and third-party licence compliance;
- SBOM and notice generation;
- trade-secret protection;
- proprietary repository notices;
- trademark/brand clearance;
- patent escalation;
- insurance readiness.

Read together with:
- `docs/security/LICENSING_IP_PROTECTION_FOUNDATION.md`
- `docs/security/PRODUCT_SECURITY_LIFECYCLE_COMPLIANCE_FOUNDATION.md`
- `docs/security/SECURITY_PRIVACY_FOUNDATION.md`
- `docs/operations/CURRENT_WORK.md`

## 2. Chain of title

WerkZ does not use the shorthand “the company automatically owns everything”.

For each material contribution, record:
- contributor/author;
- relationship: owner, employee, freelancer, agency, vendor, AI-assisted;
- contribution type: code, docs, design, asset, dataset, configuration;
- agreement/right basis;
- date/version/commit range where practical;
- third-party inputs;
- reviewer/acceptance state.

The goal is a traceable commercial-rights chain, not an attempt to transfer authorship where German law does not provide for that.

### Employees / service relationships

For computer programs created by employees in performance of their duties or according to employer instructions, § 69b UrhG allocates the exercise of economic rights to the employer unless otherwise agreed.

Official reference:
https://www.gesetze-im-internet.de/urhg/__69b.html

### Freelancers / contractors / agencies

Do not assume § 69b automatically solves freelancer ownership.

Before accepting material contractor work, the written agreement should expressly grant the rights WerkZ needs, covering as appropriate:
- source and object code;
- modifications/adaptations;
- documentation/tests/build scripts/configuration;
- commercial operation and distribution;
- SaaS/hosting;
- sublicensing to customers/service providers where required;
- maintenance/further development;
- transfer to a legal successor/business purchaser where required;
- known third-party components and their licences.

The precise legal wording requires contract review; this repository defines the operational requirement.

## 3. AI-assisted development provenance

WerkZ uses AI-assisted development and must distinguish:
- rights allocated by the AI provider’s contract;
- copyrightability under applicable law;
- possible third-party rights;
- human review and engineering responsibility.

Current OpenAI terms state, as between the user/customer and OpenAI and to the extent permitted by law, that the user/customer owns Output and OpenAI assigns any rights it has in Output. The same terms warn that Output may not be unique and require the user/customer to have rights to Inputs.

References:
- https://openai.com/de-DE/policies/eu-terms-of-use/
- https://openai.com/policies/services-agreement/

Operational rules:
- do not paste third-party proprietary code/data into AI tools without authority;
- record material external source references used to prompt or validate code;
- AI output enters production only after human review/testing;
- AI-provider output assignment is not proof that every output is independently copyrightable or non-infringing;
- security/licence scans still apply to AI-generated code.

## 4. OSS / third-party licence policy

Do not use a simplistic “permissive good, GPL bad” rule.

Every third-party component must be classified by:
- component + version/source;
- licence/SPDX id;
- runtime/bundled/build/dev/separate-service role;
- modified/unmodified;
- distributed to customer or SaaS-only;
- required attribution/NOTICE/source obligations;
- approval state.

### Default policy

Usually low-friction after recording obligations:
- MIT;
- BSD family;
- Apache-2.0;
- ISC;
- SIL OFL for fonts;
- other clearly permissive licences after review.

Mandatory manual review before adoption:
- GPL family;
- LGPL;
- AGPL;
- MPL;
- SSPL/source-available/non-OSI licences;
- dual/commercial licences;
- custom licences;
- licences with field-of-use or unusual patent/trademark clauses.

Copyleft effect depends on the exact licence, technical combination, modification and distribution/network model. Do not automatically assume that every GPL component forces unrelated software to be relicensed.

Reference:
https://www.gnu.org/licenses/gpl-faq.en.html
https://opensource.org/osd

### Apache 2.0

Where Apache-2.0 applies:
- preserve the licence;
- preserve relevant notices/attribution;
- include NOTICE material when the upstream work includes a NOTICE file and redistribution triggers the obligation;
- preserve required modification notices.

Reference:
https://www.apache.org/licenses/LICENSE-2.0.html

## 5. Automated licence/SBOM gate

Before normal paid production releases, CI/release should generate or verify:
- dependency inventory;
- licence inventory;
- SBOM (CycloneDX or SPDX);
- review-required/prohibited-licence policy;
- third-party notices;
- bundled licence texts;
- source/source-offer obligations where applicable;
- font/media provenance.

A new dependency must not silently enter production.

## 6. Current repository baseline

Verified 2026-10-01:
- `patslu-fck1701/UI-Pro` is public;
- `main` had no top-level LICENSE or NOTICE file before this foundation;
- the Issue #3 branch `codex/issue-3-commercial` has `package.json` with `"private": true`;
- that package currently declares no external npm dependencies;
- prototype Time HTML pages reference Manrope through Google Fonts.

This is a snapshot, not a permanent licence inventory.

## 7. Repository legal clarity

GitHub’s documentation states that without a licence, default copyright applies; a public repository is not automatically open source. GitHub users may still view/fork public repositories under GitHub’s platform terms.

Reference:
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository

WerkZ repository rule:
- no blanket open-source licence is granted unless explicitly approved;
- a proprietary notice may clarify WerkZ-authored material;
- third-party components remain under their own licences;
- do not use the proprietary notice to overwrite third-party rights;
- if a component is intentionally open-sourced, place it in a clearly scoped repository/directory with an explicit licence.

## 8. Trade-secret protection

German Trade Secrets Act protection requires, among other things, reasonable secrecy measures.

Official reference:
https://www.gesetze-im-internet.de/geschgehg/__2.html

Therefore:
- public source cannot sensibly be treated as confidential secret source merely by adding “confidential” text later;
- proprietary confidential production code belongs in private/access-controlled repositories;
- use least privilege, NDA/confidentiality where appropriate, access review and offboarding;
- never commit customer secrets, provider tokens, signing keys or private production credentials;
- document which information is actually classified confidential.

This reinforces the existing repository-visibility blocker.

## 9. Fonts and assets

Current prototype pages load Manrope remotely through Google Fonts.

Production direction:
- self-host approved fonts/assets where practical;
- record origin/version/license;
- preserve required font licence texts when redistributing font files;
- avoid unnecessary third-party runtime calls;
- include font/media components in THIRD_PARTY_NOTICES/SBOM-style inventory.

Google Fonts currently distributes accepted font projects under open-source font licences; Manrope is distributed under SIL OFL 1.1.

References:
https://googlefonts.github.io/gf-guide/license-file.html
https://openfontlicense.org/

## 10. Brand and trademark clearance

Do not assume that company-name/domain availability equals trademark clearance.

Before major brand spend or filing:
1. search exact and similar forms of `Werk Z`, `WerkZ` and relevant logos;
2. search DPMAregister;
3. search EUIPO;
4. search WIPO where relevant;
5. assess conflicting business identifiers/domain use where material;
6. review Nice classes and exact goods/services wording;
7. document date, search terms, results and decision.

The DPMA explicitly states that it does not check whether identical/similar earlier marks already exist; earlier right holders may oppose.

Reference:
https://www.dpma.de/marken/faq/

Current official filing fees:
- German electronic trademark application: EUR 290 including up to three classes;
- EU trade mark electronic basic fee: EUR 850 for one class, plus class fees.

References:
https://www.dpma.de/service/gebuehren/marken/
https://www.euipo.europa.eu/de/trade-marks/before-applying/fees-payments

No filing should be triggered merely from a quick web search.

## 11. Canonical brand spelling

Before trademark filing and broad launch, fix and document:
- legal/business designation;
- main commercial mark: `Werk Z` or `WerkZ`;
- module names;
- logo wordmark spelling;
- domain spelling;
- invoice/contract spelling.

Avoid accidental fragmentation of the brand.

## 12. Patent escalation rule

Do not pursue “software patents” as a default startup task.

Escalate to a patent attorney only when:
- there is a concrete technical invention;
- novelty/inventive-step review is plausible;
- disclosure timing is controlled;
- commercial value justifies cost.

Do not publicly disclose a potentially patentable technical invention before patent advice if patent protection is seriously contemplated.

## 13. Insurance readiness

Before regular paid production customers, obtain and compare actual quotes/terms for:
- Betriebshaftpflicht / Berufshaftpflicht / IT-Haftpflicht as appropriate;
- cyber incident cover;
- data-loss/incident-response costs;
- third-party claims;
- subcontractor/cloud exclusions;
- contractual liability exclusions;
- minimum security obligations/conditions.

Do not advertise insurance that has not been bound.

## 14. Legal corrections to research

Do not carry forward these overbroad claims:
- “all GPL use opens the whole application”;
- “reverse engineering is simply prohibited by AGB”;
- “§ 28 DSGVO” instead of Art. 28 GDPR/DSGVO;
- blanket “as-is/no warranty” language for WerkZ customer contracts;
- blanket liability only for intent/gross negligence;
- generic strong-crypto/export disclaimer without an actual export-control case.

Mandatory software-user rights in §§69d/69e cannot be contracted away where §69g(2) invalidates conflicting terms.

References:
https://www.gesetze-im-internet.de/urhg/__69d.html
https://www.gesetze-im-internet.de/urhg/__69e.html
https://www.gesetze-im-internet.de/urhg/__69g.html

## 15. Required registers/artifacts

Canonical supporting files:
- `docs/legal/IP_PROVENANCE_REGISTER.md`
- `THIRD_PARTY_NOTICES.md`
- `COPYRIGHT_AND_PROPRIETARY_NOTICE.md`
- `docs/legal/BRAND_CLEARANCE_REGISTER.md`
- `docs/legal/INSURANCE_READINESS_CHECKLIST.md`

Implementation:
https://github.com/patslu-fck1701/UI-Pro/issues/7

## 16. Production gate

Before normal paid production rollout:
- material contributor rights basis documented;
- contractor rights clauses ready;
- OSS policy enforced;
- release SBOM/notices reproducible;
- review-required licences approved;
- production assets/fonts have provenance;
- confidential source repository policy resolved;
- trademark clearance performed before filing/major brand spend;
- insurance decision documented;
- customer licensing wording remains aligned with mandatory rights.
