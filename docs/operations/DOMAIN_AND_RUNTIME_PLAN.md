# Domain and Runtime Plan

**Baseline:** KB-v1.39  
**Date:** 2026-10-01

## Public company domain

Primary intended public domain: **werkz-digital.eu**.

Status: reported purchased; WebsitePublisher project status still uses its project subdomain until a custom-domain connection is actually verified.

Do not claim DNS/SSL is live without verification.

## Company website

WebsitePublisher project **23947** is the public WerkZ company website.

Fallback:
https://project23947.websitepublisher.ai/

Public site responsibilities:
- WerkZ marketing/customer explanation;
- modules/workflows;
- pricing guidance;
- pre-check/detail-check;
- technical/security detail;
- selected references;
- DeutschZ public server pages.

## Operational WerkZ app

The product runtime is separate from the company website.

Target examples:
- `app.werkz-digital.eu`;
- customer-specific subdomain;
- isolated customer domain/instance;
- later on-prem deployment where required.

A solo customer must be able to use the hosted app with only a smartphone.

## Public URL strategy

WerkZ:
- `/`
- `/werkz.html`
- `/werkz-funktionen.html`
- `/werkz-technik.html`
- `/werkz-sicherheit.html`
- `/werkz-fragebogen.html`
- `/werkz-detailcheck.html`
- `/werkz-zeiterfassung.html`

DeutschZ:
- `/server.html` — active live-server hub
- `/roadmap.html` — active roadmap
- `/deutschz-story.html` — spoiler-gated story

Do not delete or rename live routes without KEEP/MERGE/ARCHIVE/REMOVE review and a redirect/migration plan where appropriate.

## DNS

Any existing A/AAAA/CNAME state must be rechecked immediately before changes. Historical DNS notes are not proof of current live routing.
