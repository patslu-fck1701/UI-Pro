# WerkZ

This repository is the canonical GitHub-side product/engineering base for **WerkZ**. The repository is still technically named `UI-Pro`; logical product name: **WerkZ**.

**Semantic baseline:** KB-v1.40  
**Corrected:** 2026-10-01  
**Legacy UI-Pro state:** `archive/legacy-ui-pro-before-werkz-2026-09-28`

## Purpose

WerkZ is the main business/product focus: a modular operational platform for solo self-employed users through small/mid-sized businesses and later enterprise-scale organisations.

The product must not assume that a customer has an office PC. A solo user may have only a smartphone. WerkZ therefore targets a responsive hosted web app/PWA with optional offline-first behaviour, while larger organisations can add teams, locations, permissions, integrations, approvals and enterprise deployment requirements.

## Critical source-of-truth rule

The owner's real local baseline is **the original local `WerkZ.zip` / local Codex workspace derived from it**.

Later archives, WebsitePublisher prototypes, ChatGPT handoffs and generated working ZIPs are **deltas, references or migration inputs**, not proof of the owner's current local Codex state unless Codex has deliberately applied and verified them.

## Website boundary

**WebsitePublisher project 23947 is the company/public website and reference surface, not the canonical WerkZ product runtime or operational database.**

It is used for:
- customer-friendly WerkZ marketing and explanations;
- pricing/scope guidance;
- pre-check/detail-check;
- technical/security documentation;
- selected practice references;
- internal/private reference prototypes where explicitly retained.

Production customer solutions are built from the WerkZ codebase and deployed separately as an app/PWA/customer instance.

## DeutschZ boundary

DeutschZ is **not merely a lab/reference page**. It is an active DayZ community server with real players and ongoing mod/server development. It is also the practical origin of many WerkZ engineering methods.

Current public web model:
- `/server.html` — consolidated live-server hub, current development, workshop/mod context, changelog, ModZ learning content, support/test feedback, vote and archives;
- `/roadmap.html` — active public development roadmap;
- `/deutschz-story.html` — spoiler-gated full story, noindex.

WerkZ remains the main business/product brand; DeutschZ remains an independent live server and an origin/reference project.

## Repository layout

- `src/` — WerkZ-owned application/integration source
- `packages/` — reusable WerkZ modules, including `time-tracking/`
- `integrations/` — adapters/contracts for external systems
- `docs/architecture/` — technical architecture and decisions
- `docs/knowledge/` — GitHub-side knowledge baseline and cross-system links
- `docs/security/` — security and rights lifecycle
- `docs/testing/` — test strategy and evidence contracts
- `templates/` — sanitized templates
- `tools/` — validation/build/deployment helpers

## Product direction

Preferred early shape: **modular monolith** with clear internal module boundaries.

Core concerns:
- organisation/tenant context;
- identity and capability-based permissions;
- configuration/feature flags;
- events/history and audit;
- offline/sync contracts;
- persistence abstraction;
- integration adapters.

Optional business modules include customers, orders, time, materials, documents, billing preparation, analysis, simulation and approvals.

## Security

No passwords, tokens, webhooks, private keys, production secrets, unredacted customer credentials or unnecessary personal data belong in this public repository.

## Reusable reference module

`packages/time-tracking/` contains the WerkZ mobile time-tracking reference implementation derived from the private Gabriel pilot. The pilot remains a reference; production development belongs in the WerkZ core.

## Public price guidance

Current public starting guidance:
- WerkZ Solo: from €490
- WerkZ Team: from €1,490
- WerkZ Business: from €2,490
- larger/enterprise requirements: individually scoped

See `docs/operations/PRICING_SCOPE_PUBLIC.md`.

## Important correction record

See `docs/knowledge/CORRECTION_2026-10-01.md` for the 2026-10-01 Website/DeutschZ error analysis, corrected architecture and deletion guardrail.
