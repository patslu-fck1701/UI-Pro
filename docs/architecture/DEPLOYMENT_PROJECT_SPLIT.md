# WerkZ Deployment / Product Split

**Baseline:** KB-v1.32  
**Date:** 2026-09-29

## Target

Product boundaries and WebsitePublisher deployment boundaries should match.

1. **DeutschZ** — project 23947 remains the existing DeutschZ deployment target after the migration is complete.
2. **WerkZ** — receives a separate WebsitePublisher project.
3. **Time tracking** — project 29212 remains a separate product/project.

## Interim state

Project 23947 is currently mixed and still contains WerkZ and DeutschZ material. This is an interim migration state, not the intended final topology.

## Migration guardrail

Do not delete current WerkZ pages from project 23947 and do not repurpose the existing DeutschZ address until the separate WerkZ project has been built, tested and accepted.

## Order

1. compare Codex and WebsitePublisher content;
2. mark canonical sections;
3. define the separate WerkZ project structure;
4. build and test the separate WerkZ project;
5. validate links, forms, assets, legal pages, languages and rollback path;
6. only then remove/archive WerkZ material from project 23947;
7. separately consolidate the time-tracking product in project 29212.

Domains are assigned after the product/project split is stable.
