# WerkZ Enterprise Relationship Model

**Baseline:** KB-v1.26
**Source:** privacy-safe generic business-network visual supplied by Patrick, 2026-09-28.

## Scope
WerkZ models business domains plus the enabling systems, governance, information layers and operating controls around them.

Business domains include strategy/objectives; procurement/inventory; marketing/sales; projects/orders; contracts/subcontractors; customer management; processes/quality; communication; finance/controlling; personnel/organization; resource planning; compliance/privacy; documents/knowledge; analysis/reporting; service/support; asset/device/license management.

Enabling/control layers include API gateway; integration platform; ETL/data flows; master data; operational databases; analytical store/data warehouse; portals/apps; mail/telephony/collaboration; server/cloud/network; monitoring/logging; backup/recovery; IAM; automation/workflow.

## Canonical relationship chain
Business goal → process → responsible role → business object/data → authoritative system → interface → credential/token type → permission scopes → environment → automation/rule → evidence/monitoring → KPI/impact → history.

Missing links are explicit rather than silently assumed.

## Token and identity graph
Credential metadata: owner; provider/system; type (OAuth grant, service account, API key, certificate, webhook secret, session/token); environment; scopes; resource boundary; issuing/rotation/revocation authority; expiry/rotation state; consuming connector/service; affected downstream processes; last validation/evidence.

Never store plaintext secret values in this graph. Store references/metadata only; actual secrets belong in protected secret storage.

## Master-data rule
For shared objects such as customer, employee, supplier, product/article, location/resource and project/order, define an authoritative source or explicit conflict-resolution rule. Integrations must not create uncontrolled competing master records.

## Control-plane rule
IAM, monitoring, audit, backup/recovery, compliance, workflow automation, knowledge and reporting are cross-cutting control planes, not isolated side modules.

## Integration patterns
Prefer the least complex reliable pattern that preserves ownership/evidence:
1. native API + OAuth/delegated authorization
2. API + service credential
3. webhook/event
4. scheduled sync/ETL
5. controlled import/export bridge
6. human approval/manual handoff where automation is unsafe or unjustified

Avoid point-to-point sprawl; repeated connections should converge through defined integration services/contracts.

## Lifecycle
Analyse → Modellierung → Integrationsdesign → Test & Validierung → Produktivbetrieb → kontinuierliche Verbesserung.

## Impact analysis
Technical failures map to business impact, e.g. expired OAuth grant → calendar connector unavailable → deployment schedule not synchronized → affected appointments/orders → management/support alert.

## UX rule
Do not expose the full enterprise graph to ordinary users. Render role/task-specific perspectives over the shared relationship model.
