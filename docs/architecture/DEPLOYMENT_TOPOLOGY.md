# WerkZ Deployment Topology

**Baseline:** KB-v1.39  
**Date:** 2026-10-01

## Core decision

WerkZ has two clearly separated web concerns:

1. **Company/public website** — WebsitePublisher project 23947.
2. **Operational WerkZ product** — built in the local/GitHub codebase and deployed separately as an app/PWA/customer instance.

WebsitePublisher is not the product database and not the long-term operational runtime for customer modules.

## Public company website — project 23947

Project 23947 hosts:
- WerkZ public marketing and explanation;
- modules/workflows;
- pricing/scope guidance;
- pre-check/detail-check;
- technical/security depth;
- public reference material;
- selected private/internal prototypes explicitly retained.

The public site may link to a future app endpoint such as an app subdomain, but the operational application remains a separate deployment boundary.

## Smartphone-only Solo

A customer may own no office PC.

Supported target:
- hosted responsive web app/PWA;
- smartphone browser as the only required client;
- home-screen installation;
- offline-first buffering where appropriate;
- sync when connectivity returns / app is reopened.

Do not design the product around localhost or a customer's desktop machine as a mandatory runtime.

## Small team / mid-size / enterprise path

Use the same core:
- Solo: one organisation, one person, few modules;
- Team: multiple users and shared jobs;
- Mid-size: teams, sites, integrations, more granular rights;
- Enterprise: optional SSO, organisation units, stronger isolation, queues, HA/on-prem only when genuinely needed.

## Recommended early technical shape

Prefer a **modular monolith**:
- clear internal module contracts;
- one deployable application initially;
- persistence abstraction;
- avoid premature microservices.

Core:
- organisation/tenant;
- identity;
- capability-based permissions;
- events/history/audit;
- configuration;
- offline/sync;
- persistence;
- integration adapters.

Optional modules:
- customers;
- orders;
- time;
- materials;
- documents;
- billing preparation;
- approvals;
- analytics;
- simulation.

## DeutschZ

DeutschZ is an **independent active DayZ live server** with real players and ongoing development.

It is also a practical origin/reference for WerkZ engineering, but not merely a lab.

Public web structure:
- `/server.html` — consolidated live-server hub;
- `/roadmap.html` — active public roadmap;
- `/deutschz-story.html` — spoiler-gated full story, noindex.

Changelog, ModZ learning content, support/test feedback, vote, project/server context and archive material are bundled into the server hub to reduce page sprawl without deleting unique content.

## WerkZ Time

The Gabriel-specific/private implementation remains a UX/behaviour reference. The generic production module belongs in the WerkZ core, not as a permanent WebsitePublisher product runtime.

## System-of-record split

- **GitHub:** source, technical docs, architecture, tests, standards.
- **Local Codex workspace:** actual working implementation state; original `WerkZ.zip` is the owner-defined baseline.
- **Google Drive:** human-readable cross-system register, handoff and error/correction records.
- **WebsitePublisher:** public website, live marketing/reference pages, structured task/history records.
- **Customer runtime:** separate deployed app/PWA/customer instance.

## Safety

Do not publish private cost models, customer data, passwords, tokens or personal test fixtures. Do not delete live/unique web functions merely to save plan slots; merge first and verify preservation.
