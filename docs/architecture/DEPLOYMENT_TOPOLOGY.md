# WerkZ Deployment Topology

**Baseline:** KB-v1.33
**Date:** 2026-09-30

## Decision

WerkZ, DeutschZ and WerkZ Time are not three separate WebsitePublisher products.

They belong to one core web property:

- **WerkZ** is the main business/product brand.
- **DeutschZ** remains the technical origin, lab and reference area.
- **WerkZ Time** is a reusable WerkZ module, not a separate core brand.
- **WebsitePublisher project 23947** is the canonical live runtime.
- **WebsitePublisher project 29212** is the most advanced practical Gabriel-specific time-tracking implementation. It is a source for feature/UX harvesting, but not the long-term canonical deployment target.

The goal is one active core project so two WebsitePublisher Starter project slots remain available for future real customer or isolated product deployments after project 29212 has been fully harvested, privately archived and only then removed by the owner.

## Planned public domain

The intended main domain is **werkz-digital.eu**.

Current state:
- reported as purchased by the owner;
- no existing reference to the exact domain was found in the current public GitHub or Drive knowledge before this update;
- it is not connected to WebsitePublisher yet;
- exact spelling/ownership should be confirmed in the registrar account before changing DNS.

The technical fallback remains: https://project23947.websitepublisher.ai/

## WebsitePublisher role

Project 23947 hosts:

- WerkZ public site;
- WerkZ functions, technology, security and intake;
- WerkZ Time module/reference;
- DeutschZ technical reference pages;
- shared auth, forms, assets and runtime integrations where appropriate.

A new WebsitePublisher project is justified only for a real isolation boundary: a customer-owned runtime, separate product/domain/release lifecycle, security/compliance isolation, or explicit staging requirement.

A reusable module by itself is not a reason for a new project.

## System-of-record split

- **GitHub:** public-safe code, architecture, standards, templates and tests.
- **Google Drive:** private commercial strategy, decisions, knowledge and operational records.
- **WebsitePublisher:** live pages, runtime configuration, forms, auth, entities and integrations.
- **Local Codex workspace:** working copy for larger refactors; changes must be reconciled back into GitHub/Drive.

## Time-tracking consolidation

Three time-tracking lines exist:
1. **Project 29212** — latest and most advanced practical implementation; primary source for proven UX/features and the real mobile workflow.
2. **Audited single-file/private app in project 23947** — technical/audit reference with additional local-vault/reporting ideas.
3. **Generic WerkZ Time core/module in project 23947** — the abstraction target and reusable product architecture.

Merge precedence is deliberate: harvest the mature practical behavior from 29212, keep the stronger generic state/backup/error contracts from the WerkZ core, and use the audited single-file build as an evidence/reference source. The target is one generic WerkZ Time module in project 23947. Personal test-specific names and employer data stay in private fixtures only.

## Safety

Do not publish private cost models, customer data, passwords, tokens, or personal test fixtures in this repository or public WebsitePublisher assets.