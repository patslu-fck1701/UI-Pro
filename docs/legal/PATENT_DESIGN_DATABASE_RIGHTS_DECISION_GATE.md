# WerkZ Patent, Design & Database Rights Decision Gate

**Date:** 2026-10-02  
**Status:** decision gate — no automatic filing strategy  
**Related issue:** https://github.com/patslu-fck1701/UI-Pro/issues/7

## 1. Patent default

WerkZ does **not** pursue software patents by default.

A patent review is justified only when all of these are plausible:
- concrete technical problem;
- solution using technical means;
- novelty over known/public prior art;
- inventive step;
- commercial value large enough to justify filing/enforcement cost;
- controlled disclosure timing.

Computer programs “as such” are excluded, but computer-implemented inventions can be patentable when they solve a concrete technical problem with technical means.

Reference:
https://www.dpma.de/patente/patentschutz/schutzvoraussetzungen/schutz_computerprogramme/

## 2. Publication risk

Public disclosure before filing can destroy novelty.

Because `patslu-fck1701/UI-Pro` is public, any patent strategy must first check whether the relevant technical teaching is already available there or in public demos/docs.

Rule:
**file/decide first, publish second** when patent protection is seriously contemplated.

Reference:
https://www.dpma.de/service/presse/pressemitteilungen/10042026/

## 3. Gebrauchsmuster caution

Do not use a German Gebrauchsmuster as a shorthand “fast software patent”.

DPMA states:
- computer programs as such are not protectable;
- methods/processes are excluded;
- the right is registered without substantive examination of protectability;
- later deletion challenges remain possible.

References:
- https://www.dpma.de/gebrauchsmuster/gebrauchsmusterschutz/schutzfaehigkeit/
- https://www.dpma.de/digitaler_jahresbericht/2025/jb25_de/gebrauchsmuster.html

Only escalate if there is suitable technical product subject matter.

## 4. Design protection

Potential candidates:
- distinctive GUI screen designs;
- icon sets;
- visual product surfaces;
- logo/graphic elements where design protection makes strategic sense.

German registered design:
- requires novelty and individual character;
- is not substantively examined for those conditions during registration;
- can later be invalidated;
- has a 12-month grace period for certain own disclosures.

Operational rule:
- save dated source files/screenshots;
- search prior designs;
- if protection matters, prefer filing before broad public launch;
- do not assume the German grace period solves every international filing strategy.

Reference:
https://www.dpma.de/designs/schutz/schutzvoraussetzungen/

## 5. Copyright boundary

§69a UrhG protects expression of a computer program, including qualifying program/design material, but not ideas/principles underlying program elements/interfaces.

Therefore:
- protect actual code/documentation/assets;
- do not claim monopoly over abstract workflows, architecture ideas or business logic merely because documented first;
- use trade-secret, contract, trademark/design and patent tools only where their separate conditions are met.

Reference:
https://www.gesetze-im-internet.de/urhg/__69a.html

## 6. Database rights

Do not label every tenant/customer database as a WerkZ-owned protected database.

Assess separately:
- who made the relevant investment;
- whether investment was substantial;
- whether it concerned obtaining, verifying or presenting existing independent materials;
- whether the material itself belongs to or is controlled by the customer/third parties;
- privacy/confidentiality/contractual restrictions.

References:
- https://www.gesetze-im-internet.de/urhg/__87a.html
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:62002CJ0444

## 7. Customer data wording

Avoid:
“all customer data is owned by the customer”  
or  
“WerkZ owns processed/derived customer data”

unless a lawyer has confirmed the exact subject matter and context.

Preferred contract architecture:
- define Customer Data;
- customer warrants authority to provide/process it;
- underlying rights remain with the respective right holder;
- WerkZ receives only rights necessary to perform the contract;
- define generated service metadata separately;
- define export/return/deletion;
- preserve statutory data-protection rights and third-party rights.

## 8. Employee inventions

Software copyright and patentable employee inventions are different regimes.

Before employing technical inventors:
- prepare ArbnErfG invention-reporting process;
- document inventors/contributions;
- route patentable service inventions for specialist review;
- keep remuneration/claiming duties separate from ordinary software-IP clauses.

Reference:
https://www.gesetze-im-internet.de/arbnerfg/__5.html

## 9. Defensive publication

Defensive publication can create prior art against later patent attempts by others.

Concern:
It can also destroy WerkZ's own patent option.

Therefore defensive publication is a deliberate **patent-or-publish decision**, never a default anti-copy measure.

## 10. Decision record

For each candidate protection:
- subject matter;
- current public-disclosure status;
- inventors/designers;
- commercial value;
- likely legal vehicle: copyright / trade secret / trademark / design / patent / none;
- search performed;
- estimated cost/benefit;
- external counsel required?;
- decision and date.
