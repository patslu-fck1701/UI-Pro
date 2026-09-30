# Codex / WebsitePublisher Merge Rule

**Baseline:** KB-v1.33  
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

Project 23947 remains the canonical WebsitePublisher runtime. Merge both sources into that common WerkZ/DeutschZ/WerkZ-Time system. Do not blindly replace the live public structure with the Codex website, and do not discard the stronger Codex governance/engineering model.

## Exclusions

Do not migrate:

- temporary audit/vendor directories;
- private cost or margin assumptions;
- customer/private test data;
- outdated NOT_SET pricing rules;
- historical test claims as current production evidence;
- DeutschZ-specific public assets into the separate WerkZ product unless deliberately used as a technical reference.

## Time tracking

Three related time-tracking lines currently exist and must not be treated as one identical codebase until deliberately consolidated. Project 29212 is the latest and most advanced practical implementation and therefore leads on proven UX/behavior; the reusable WerkZ Time core leads on generic product architecture/state contracts; the Codex-audited single-file asset remains an additional technical/evidence source.

## Founding-package boundary

The private founding-package artifact is a separate document lifecycle. Shared architecture and positioning knowledge can inform future revisions, but deployment metadata alone does not automatically create a new funding-package revision.
