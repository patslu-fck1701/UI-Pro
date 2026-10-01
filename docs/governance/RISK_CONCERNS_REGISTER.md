# WerkZ Risk & Concerns Register

**Date:** 2026-10-02  
**Status:** canonical cross-cutting risk/concerns register  
**Purpose:** preserve not only recommendations, but also counterarguments, uncertainties, legal/technical concerns and explicit stop-gates.

## Operating rule

Every material research or architecture decision should record:
- recommendation;
- concern / downside;
- uncertainty;
- evidence/source;
- mitigation;
- decision owner;
- status;
- next review trigger.

A “good idea” is not production-ready until its meaningful downside is recorded.

## Current priority concerns

| Concern | Why it matters | Current status | Required mitigation / decision |
|---|---|---|---|
| Public `UI-Pro` repository | Public disclosure weakens trade-secret claims and can destroy patent novelty for disclosed technical inventions | BLOCKER | Make proprietary product work private or split public/private; never rely on later obfuscation |
| Patent self-disclosure | Public docs/code/demos before filing can become prior art and prevent patent protection | HIGH | Before publishing a potentially patentable technical invention: stop, document, patent-attorney review, then file-or-publish decision |
| Patent value/cost uncertainty | Typical WerkZ SaaS/business workflows may not meet technical-invention threshold and may not justify cost | HIGH | No default patent spend; require concrete technical problem, novelty case, commercial value and budget |
| Gebrauchsmuster overconfidence | German utility model does not protect methods and excludes computer programs as such; it is unexamined | HIGH | Use only after specialist review for a suitable technical product subject matter; never call it “quick software patent” |
| Design right overconfidence | German registered design is unexamined for novelty/individual character and can later be invalidated | MEDIUM | Search prior designs; document exact screenshots/views; file before wide disclosure where strategically important |
| Design disclosure clock | Own publication can affect novelty; German design law has a 12-month grace period, but relying on grace can complicate international strategy | MEDIUM | If design protection matters, prefer filing before public launch; do not assume a global grace period |
| Database-right assumption | Large/customer databases are not automatically protected by sui-generis database right | MEDIUM | Record substantial investment in obtaining/verifying/presenting independent materials; do not count mere creation of the underlying data as sufficient |
| “Customer owns the data” shorthand | Data can involve copyright, database rights, trade secrets, personal-data rights and third-party rights; “ownership” is often legally imprecise | HIGH | Contracts should define customer-provided data, processing rights, export/return, licences and statutory rights rather than use blanket property language |
| GUI/copyright overstatement | Code can be protected, but ideas/principles underlying software are not; UI/design protection depends on the concrete expression and legal threshold | MEDIUM | Protect concrete code/assets/designs; do not market architecture/ideas as automatically copyrighted monopolies |
| Employee invention process | Patentable employee inventions trigger separate ArbnErfG processes in addition to software copyright rules | FUTURE/HIGH | Before first technical employee: invention-reporting workflow and contract/process review |
| Freelancer rights gap | §69b UrhG does not automatically solve contractor rights | BLOCKER BEFORE CONTRACTOR WORK | Explicit rights grant + third-party component disclosure + confidentiality + handover clauses |
| OSS/copyleft misclassification | Blanket GPL/AGPL fear can block useful software; under-analysis can create licence breach | HIGH | Component-by-component licence review, SBOM, notices, CI policy, legal review for copyleft/unusual licences |
| AI-output rights uncertainty | Provider terms allocate rights contractually, but output may not be unique, copyrightable or free of third-party rights | MEDIUM | Human review, source/provenance record, licence/security scans, no proprietary third-party input without authority |
| Defensive publication timing | Publishing to block others from patenting may simultaneously destroy WerkZ’s own patent option | HIGH | Patent-or-publish gate before any defensive publication |
| Trade-secret reverse engineering | Public or lawfully possessed products may in some circumstances be observed/tested/reverse engineered absent restricting duties; secrecy requires actual measures | HIGH | NDAs/licence terms where lawful + technical/access controls + do not expose the secret unnecessarily |
| Trademark collision | Domain/company-name availability does not equal trademark clearance | HIGH | DPMA/EUIPO/WIPO + similar-mark search before filing/major spend |
| Brand spelling drift | `Werk Z` / `WerkZ` variation can fragment filings/contracts/domains | MEDIUM | Fix canonical spelling before trademark filing and broad launch |
| Compliance overclaim | “GDPR/NIS2/CRA/ISO/TISAX compliant” can be misleading without scoped evidence | HIGH | Publish concrete implemented controls only; claims require scope/evidence |
| CRA scope uncertainty | Not every SaaS function is automatically a CRA product, while local Agent/On-Prem/backend dependencies may bring scope | HIGH | Product-by-product CRA classification; legal review where borderline |
| Support/EOL burden | Distributed software creates long-term vulnerability/support obligations and operational cost | HIGH | Supported-until metadata, version policy, release channels and security-update capacity |
| Backup confidence gap | A backup existing does not prove tenant-safe restore | HIGH | Restore drills covering DB + objects + entitlements + audit and cross-tenant isolation |
| Permanent support access | Convenient remote access can become a major security/liability risk | HIGH | Time-limited, customer-approved, capability-scoped audited support grants only |
| Insurance mismatch | IT/cyber policies can exclude contractual liability, known vulnerabilities or missing MFA/backups | MEDIUM | Compare actual policy wording before paid production; document exclusions/security conditions |
| Research-report reliability | Deep-research reports can contain outdated, overbroad or jurisdiction-mixed statements | HIGH | Primary-source verification before converting research into canonical rules |

## Patent / publication stop-gate

Before publicly releasing a new technical architecture/mechanism that might plausibly be a patent candidate:

1. identify the concrete technical problem and technical means;
2. check whether it is already public in GitHub/site/demo/docs;
3. record inventors and date;
4. perform initial prior-art search;
5. decide with patent counsel: file, keep secret, or publish defensively;
6. only then make the deliberate public disclosure.

If already publicly disclosed, do not assume patent rights remain available.

Official reference:
https://www.dpma.de/service/presse/pressemitteilungen/10042026/

## Database-right caution

German §87a UrhG requires a qualitatively or quantitatively substantial investment in obtaining, verifying or presenting database contents.

EU case law distinguishes this from resources used merely to create the underlying data.

References:
- https://www.gesetze-im-internet.de/urhg/__87a.html
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:62002CJ0444

## Employee invention caution

If WerkZ later employs technical staff and a patentable service invention arises, §5 ArbnErfG requires a separate invention notification process.

Reference:
https://www.gesetze-im-internet.de/arbnerfg/__5.html

## Design caution

German registered designs require novelty and individual character, but the DPMA does not substantively examine those requirements during registration. The German system provides a 12-month grace period for an inventor/designer's own disclosure, but filing before launch is safer for broader international strategy.

Reference:
https://www.dpma.de/designs/schutz/schutzvoraussetzungen/

## Review cadence

Review this register:
- before every normal paid production launch;
- before new contributor/contractor access;
- before public disclosure of a potentially patentable technical invention;
- before trademark/design/patent filing;
- after a material security incident;
- after major provider/licence/deployment changes;
- at least once per major release cycle.
