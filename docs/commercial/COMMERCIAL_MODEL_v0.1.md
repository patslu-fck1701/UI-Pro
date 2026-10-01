> **SUPERSEDED COMMERCIAL SEED — DO NOT USE AS CURRENT PRICE AUTHORITY**
>
> This v0.1 document is retained for history/migration tests only. Current commercial direction is `docs/commercial/PRICING_DEPLOYMENT_MODEL_v2.md` and `config/catalog/werkz-v0.2.json`.
> The 9/19/29-EUR-style per-module monthly values below are not the current canonical/public WerkZ pricing model. No permanent Free/Basic production tier exists.

# WerkZ Commercial Model v0.1

**Date:** 2026-10-01  
**Status:** internal proposal / development seed — not yet public price approval

## Positioning

WerkZ should sell a reusable product, not rebuild every customer from scratch.

Commercial price = reusable platform + selected modules + organisation/user scale + integrations + setup/custom work + external provider costs.

Technical architecture and commercial packaging remain separate.

## Market benchmark snapshot — 2026-10-01

Current public competitor pricing shows a broad range:

- ToolTime: public regular package prices around 79 €/month Solo, 149 €/month Team and 299 €/month Max; DATEV is listed as a paid add-on.
- HERO: public regular entry levels around 69 €/month Select, 119 €/month OS and 299 €/month OS Plus, with additional user/app licences and an implementation service for the top plan.
- openHandwerk: role/user pricing varies by contract term and user type, roughly from the mid-teens to around 60 € per user/month in the published tables.
- Clockodo: narrowly focused time/project tracking is much cheaper, around 4–12 € per user/month.
- Papershift uses a base fee plus package/user logic.


Official pricing pages checked for this snapshot:
- https://www.tooltime.app/preise
- https://hero-software.de/preise
- https://openhandwerk.de/preise/
- https://www.clockodo.com/de/preise/
- https://www.papershift.com/preise

Implication:
- pure time tracking is a commodity and must not carry the entire WerkZ margin;
- integrated operational workflow/automation can credibly sit in the ~70–300+ €/month market band;
- one-time setup/customization is normal and should be separated from recurring software value;
- integrations/AI/messaging can be priced as add-ons or usage-backed services.

## Price architecture

### 1. One-time setup / implementation

Existing public starting points remain suitable as setup/implementation anchors:

- WerkZ Solo setup: from 490 €
- WerkZ Team setup: from 1,490 €
- WerkZ Business setup: from 2,490 €
- larger/custom: scoped quote

Setup may include:
- onboarding
- configuration
- module selection
- data import
- role setup
- initial workflow configuration
- training
- customer-specific integration work

### 2. Monthly Core

Proposal seed:

- `WZ-CORE` — WerkZ Core / Betrieb — 29 €/month per organisation

Core contains shared infrastructure only, not every business function.

### 3. Monthly modules

Proposal seed:

- `WZ-TIME` — Zeit — 19 €/month
- `WZ-CUSTOMERS` — Kunden — 9 €/month
- `WZ-ORDERS` — Auftrag — 19 €/month
- `WZ-MATERIAL` — Material — 12 €/month
- `WZ-DOCS` — Dokumente & Fotos — 9 €/month
- `WZ-BILLINGPREP` — Abrechnungsvorbereitung — 14 €/month
- `WZ-ANALYTICS` — Analyse — 19 €/month
- `WZ-SIM` — Simulation — 29 €/month
- `WZ-MANAGEMENT` — Chefmodus / Entscheider — 19 €/month
- `WZ-APPROVALS` — Freigaben — 12 €/month
- `WZ-WHATSAPP` — WhatsApp/Freigabekanal — 29 €/month plus provider/message costs

### 4. Team/user scaling

Proposal seed:

- one active user included with organisation/Core
- Team pack up to 5 active users: +39 €/month
- further active users: initial seed 7 €/user/month

This is intentionally cheaper per mobile user than large full-office licences because rights/views may be strongly reduced.

### 5. Integrations

Separate catalog items.

Example commercial pattern:

- standard adapter setup: one-time
- ongoing adapter/monitoring fee: monthly where justified
- provider/API costs: pass-through or usage line

Do not bury third-party provider costs inside fixed software margin if they can vary materially.

### 6. Custom development

Prefer fixed scoped offers externally.

Internally track:
- estimated hours
- effective internal target rate
- risk buffer
- support/maintenance impact

Do not hard-code custom development price into product code.

## Package presets

Packages are sales shortcuts, not technical editions.

### Solo Start
Core + Customers + one main operational module.

### Solo Complete
Core + Customers + Orders + Time + Documents.

### Team Field
Solo Complete + Team pack.

### Team Control
Team Field + Management + Approvals + Analytics.

### Business
Configurable mix with Materials, Billing Prep, Simulation, integrations, larger seat packs.

Each quote still expands into independent SKUs/entitlements.

## Customer-facing naming

Internal nickname "fauler Chef Modus" should not be used publicly.

Good public labels:
- Chefmodus
- Entscheider
- Leitungsansicht
- Management Cockpit

The product promise is: only exceptions, approvals and decisions — not another full office screen.

## Quote examples

### Solo mobile operations
Core 29 + Customers 9 + Orders 19 + Time 19 = **76 €/month**
plus setup from 490 €.

### 5-person field team
Core 29 + Customers 9 + Orders 19 + Time 19 + Docs 9 + Team pack 39 = **124 €/month**
plus setup from 1,490 €.

### Controlled team
Previous 124 + Management 19 + Approvals 12 + Analytics 19 = **174 €/month**
plus setup.

These examples are internal planning, not yet public promises.

## Rules

- no hidden technical edition locks;
- entitlement checks server-side;
- prices versioned;
- quotes snapshot prices;
- data survives module suspension;
- external usage/provider charges transparent;
- recurring catalog and one-time implementation remain separate.
