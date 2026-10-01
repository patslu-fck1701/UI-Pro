# Codex / WebsitePublisher Relationship

**Baseline:** KB-v1.34  
**Corrected:** 2026-10-01

## Correction

The earlier idea of merging Codex and WebsitePublisher into one common operational WerkZ runtime is superseded.

They have different responsibilities.

## Local Codex / GitHub product side

Owns:
- actual WerkZ product implementation;
- module/core architecture;
- business/data contracts;
- tests;
- deployment profiles;
- security/permission model;
- offline/sync;
- analytics/simulation;
- production app/PWA development.

The owner's actual local baseline is the real `WerkZ.zip` / local Codex workspace.

## WebsitePublisher side

Owns:
- public WerkZ website;
- customer-friendly information architecture;
- price/scope communication;
- pre-check/detail-check;
- technical/security explanation;
- public/practice references;
- private prototypes that are deliberately retained as references.

WebsitePublisher prototypes may inform Codex, but they are not the production product database/runtime.

## Migration rule

For each useful WebsitePublisher prototype:
1. identify reusable UX/logic;
2. document it;
3. implement/test it in the local WerkZ product;
4. only then archive/remove the prototype if desired.

## DeutschZ

DeutschZ is a live DayZ server, not a WerkZ product module.

Its public web pages remain because players and ongoing development need them. Reusable engineering lessons may inform WerkZ; DeutschZ operational code/settings remain in their own repositories/workspaces.

## Error prevention

Do not infer that “not part of WerkZ production” means “safe to delete from the website”. A page can be essential for another live purpose such as DeutschZ players, roadmap, changelog, support or story.
