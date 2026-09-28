# WerkZ Integration & Access Matrix

**Baseline:** KB-v1.25  
**Purpose:** turn the Business Operating Graph into an implementable integration plan without collecting secrets during discovery.

## For every external system record

Capture:
1. business capability / process role
2. system/provider name
3. authoritative data owned there
4. upstream/downstream relationships
5. available interface: API, OAuth, webhook, ICS, secure export/import, file bridge, manual fallback
6. authentication method (type only during discovery)
7. required scopes: read/write/delete/admin/payment/personnel/etc.
8. system owner / person authorized to grant access
9. environment: sandbox/test/customer-test/production
10. data sensitivity / privacy boundary
11. rate limits / failure behavior if known
12. retry/manual fallback
13. approval requirement
14. secret rotation/revocation route
15. evidence/test status
16. handover owner and post-handover developer rights

## Typical system families

| Family | Typical role | Preferred connection patterns |
|---|---|---|
| Email/messaging | inquiry, communication, notification | OAuth/API, webhook, structured forwarding |
| Calendar/scheduling | appointments, resources, deployments | calendar API, ICS, webhook |
| CRM/ERP/industry software | customers, jobs, master records | REST/Graph API, webhook, controlled export |
| Files/documents | photos, PDFs, forms, evidence | file API, gated upload/download, authorized folder |
| Accounting/invoicing | quote, invoice, bookkeeping | official API/export; financial actions server-side |
| Payments | payment state | provider-hosted auth/checkout + server-side API |
| Time/personnel | time, deployment, payroll handoff | scoped API/export with strict role/privacy boundaries |
| Inventory/procurement | stock, materials, purchasing | API/export; approval for cost-bearing actions |

## Development gates

**Discovery:** understand process, systems, data ownership and desired outcome. No secrets.

**Technical preflight:** verify docs, APIs, OAuth/key method, scopes, sandbox, webhook/export capability and limits.

**Internal development:** use authorized WerkZ test credentials/sandbox where practical; preserve separation from production.

**Customer test:** connect real customer-controlled accounts where required; test actual user roles and policy boundaries. Owner/admin success alone is insufficient evidence.

**Production/handover:** customer-owned credentials and authority become canonical. Inventory WerkZ/developer access and reduce/revoke it according to the agreed support model.

**Operation:** monitor token expiry, interface changes, failures and business-process changes; reopen validation only when semantic/technical state changes.

## Secret rule

Discovery records credential **type and owner**, never plaintext secrets. Secrets are provisioned through protected mechanisms and must not be stored in normal Git, logs, reflections, public pages or knowledge registers.

## Graph link

Every integration should link back to the Business Operating Graph nodes/processes it serves. This allows impact analysis: if a connector fails, WerkZ can identify the affected processes, jobs, roles and downstream actions instead of reporting only “API failed”.
