# Codex / WebsitePublisher Merge Rule

**Baseline:** KB-v1.32  
**Date:** 2026-09-29

## Finding

The current Codex package and WebsitePublisher live state are not competing whole-system versions.

### Codex is currently stronger for

- engineering and governance structure;
- business/project templates;
- scope/change/handover process;
- testing, security, backup, restore and rollback rules;
- generator/validator and internal tooling;
- capability evidence and demo structure.

### WebsitePublisher is currently stronger for

- the live public WerkZ information architecture;
- product/function/technology/security explanations;
- pre-check and detail-check flows;
- current visual presentation and public pricing/scope communication;
- the current structured reflection/operational data layer.

## Canonical rule

The separate WerkZ WebsitePublisher project must merge both sources. Do not blindly replace the live public structure with the Codex website, and do not discard the stronger Codex governance/engineering model.

## Exclusions

Do not migrate:

- temporary audit/vendor directories;
- private cost or margin assumptions;
- customer/private test data;
- outdated NOT_SET pricing rules;
- historical test claims as current production evidence;
- DeutschZ-specific public assets into the separate WerkZ product unless deliberately used as a technical reference.

## Time tracking

Three related time-tracking lines currently exist and must not be treated as one identical codebase until deliberately consolidated: a Codex-audited single-file asset, the Gabriel-specific project 29212, and the reusable WerkZ time module.

## Founding-package boundary

The private founding-package artifact is a separate document lifecycle. Shared architecture and positioning knowledge can inform future revisions, but deployment metadata alone does not automatically create a new funding-package revision.
