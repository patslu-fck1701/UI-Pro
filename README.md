# WerkZ

This repository is the **new canonical private-target repository structure for WerkZ**. The GitHub repository is still technically named `UI-Pro` because the connected GitHub actions cannot rename repositories. Rename target: **WerkZ**.

**Semantic baseline:** KB-v1.31  
**Rebuilt:** 2026-09-28  
**Legacy UI-Pro state:** `archive/legacy-ui-pro-before-werkz-2026-09-28`

## Purpose

WerkZ is the product/project layer for reusable business automation, integrations, technical architecture, documentation and controlled customer-specific implementations.

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
- `.github/` — GitHub workflows and contribution controls

## Knowledge roles

GitHub is canonical for source, commits, branches, pull requests and repository-local technical documentation. WebsitePublisher/WerkZ is canonical for structured reflection and architecture history. Google Drive holds the human-readable cross-system register. Chat/project context is the working layer, not the sole durable truth.

## Security

No passwords, tokens, webhooks, private keys, production secrets, unredacted customer credentials or unnecessary personal data belong in this repository.

The old UI-Pro content is historical only and is preserved on its archive branch.

## Current reusable reference module

`packages/time-tracking/` contains the WerkZ mobile time-tracking reference implementation: shift start/finish, multiple jobsite completions, GPS/address, speech/text, optional photo, daily summary, backup/restore and error logging. See `docs/architecture/TIME_TRACKING_MODULE.md`.


## Product boundary

WerkZ Time is one reusable module. It is not the complete WerkZ Solo offering. The broader Solo/Team/Business boundaries are documented in `docs/architecture/PRODUCT_MODULE_BOUNDARIES.md`.


## Pricing scope

Public starting prices stay at WerkZ Solo €490, Team €1,490 and Business €2,490. The reusable-module and scope rules are documented in `docs/operations/PRICING_SCOPE_PUBLIC.md`.
