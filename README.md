# WerkZ

This repository is the **new canonical private-target repository structure for WerkZ**. The GitHub repository is still technically named `UI-Pro` because the connected GitHub actions cannot rename repositories. Rename target: **WerkZ**.

**Semantic baseline:** KB-v1.20  
**Rebuilt:** 2026-09-28  
**Legacy UI-Pro state:** `archive/legacy-ui-pro-before-werkz-2026-09-28`

## Purpose

WerkZ is the product/project layer for reusable business automation, integrations, technical architecture, documentation and controlled customer-specific implementations.

## Repository layout

- `src/` — WerkZ-owned application/integration source
- `packages/` — reusable WerkZ modules
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
