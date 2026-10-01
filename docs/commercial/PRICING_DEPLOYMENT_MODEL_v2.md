# WerkZ Pricing & Deployment Model v2

## Commercial decision

This model supersedes the small per-module monthly price seed as the canonical commercial direction.

Module SKUs and entitlements remain useful technical switches. They are **not** the public price list. WerkZ sells a configured operating workflow, the chosen operating model, and optional integrations/infrastructure.

## Axis A — solution scope

| Preset | Public entry | Typical one-time project range | Managed operation |
| --- | ---: | ---: | ---: |
| WerkZ Solo | from €490 | commonly ~€790–€1,490 | from €79/month |
| WerkZ Team | from €1,490 | commonly ~€1,990–€3,990 | from €179/month |
| WerkZ Business | from €2,490 | commonly ~€3,490–€7,500+ | from €349/month |
| Enterprise | quote | quote | quote/SLA |

The public entry price only applies to a sharply scoped configuration built mostly from existing WerkZ components.

## Axis B — deployment

### Managed Cloud
Default for many Solo/Team deployments. No customer-side server requirement. Shared hosting within the agreed fair-use envelope is part of managed operation.

### Dedicated Cloud
Isolated customer instance. Additional setup from €490, provider cost passed through separately, infrastructure management from €99/month.

### Hybrid + Connector
Hosted WerkZ plus an outbound-only local connector to explicitly approved customer systems. Setup from €690; connector monitoring/management from €49/month.

### Existing customer hardware
Reuse suitable customer-owned server/NAS/mini-PC/Mac hardware when it passes the infrastructure check. Price depends on assessment, provisioning and support scope.

### WerkZ Box
Prepared local appliance. Hardware is quoted at current cost, plus procurement/handling and provisioning from €990. Infrastructure management from €99/month.

### Dedicated / On-Premise
Customer-owned server or virtualisation environment. Additional project effort from €2,490; ongoing maintenance from €249/month or a separately defined self-managed model.

## Infrastructure-first rule

Before proposing hardware, inventory what the customer already owns. Check supported OS, patch status, CPU/RAM/storage, encryption, network, 24/7 suitability, backup, UPS/power resilience, remote administration and capacity headroom.

Prefer reuse when technically sound. Do not sell new hardware simply because a local deployment is possible.

## WerkZ Box procurement

1. **Reuse** — customer already owns suitable hardware; WerkZ assesses, provisions and documents it.
2. **Customer purchase** — WerkZ recommends a concrete device; customer buys it; WerkZ provisions it.
3. **WerkZ supply** — only after order; hardware is a separate quote/invoice line, with transparent procurement/handling, provisioning and support.
4. **Future OEM appliance** — true own-brand hardware should use OEM/white-label supply. Do not obscure the manufacturer/warranty identity of third-party hardware.

Internal starting rule for WerkZ-supplied hardware: current hardware cost + 15% procurement/handling (minimum €149), plus provisioning. Recalculate after real purchases.

## Offer formula

**One-time:** implementation + deployment setup + hardware + integrations/migration + custom work + fixed-price risk.

**Recurring:** managed-operation tier + deployment/infrastructure management + provider/consumption cost + agreed support/SLA.

A self-managed handover may have no artificial WerkZ subscription; updates, security work and support are then separately contracted.

## Pre-check flow

The pre-check must produce two recommendations:
1. Solo / Team / Business scope.
2. Cloud / Hybrid / existing hardware / WerkZ Box / On-Prem deployment.

The detail check must capture existing infrastructure, local systems, 24/7 availability, technical owner and procurement preference before a binding quote.

## Catalog migration rule

The v0.1 catalog contains an earlier price seed and is no longer the commercial source of truth.

Before PR #4 is merged, Codex must migrate pricing to v0.2:
- keep module entitlements and capability guards;
- stop treating €9/€19/€29 module amounts as canonical public prices;
- add managed-operation products;
- add deployment/infrastructure products;
- keep quote snapshots versioned;
- preserve one-time setup SKUs;
- make modules included/scoped within a configured offer unless a future commercial decision explicitly gives a module its own line price.
