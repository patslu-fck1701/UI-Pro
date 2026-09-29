# Domain and Runtime Plan

**Baseline:** KB-v1.33
**Date:** 2026-09-30

## Intended domain

Primary public domain: **werkz-digital.eu**

Status: reported purchased, not yet connected. Verify exact spelling in the registrar account before DNS changes.

Registrar/provider context currently points to INWX, but credentials and registrar account data are not stored here.

## WebsitePublisher target

Canonical project: **23947**

Fallback URL: https://project23947.websitepublisher.ai/

WebsitePublisher custom-domain connection is owner-controlled in the dashboard. It is not performed by an AI/MCP write.

After domain confirmation, the documented WebsitePublisher DNS target is:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | @ | 206.189.242.68 | 3600 / Auto |
| A | www | 206.189.242.68 | 3600 / Auto |

Dashboard path: Project 23947 -> Publish -> Connect your own domain -> Validate & Save

WebsitePublisher provisions SSL after a valid connection.

Before changing DNS, check for conflicting A, AAAA or CNAME records on @ and www.

## URL strategy

Keep working public URLs stable during consolidation. Do not delete or rename existing WerkZ/DeutschZ routes without a migration/redirect plan.

Recommended roles:

- / — WerkZ main entry
- /werkz-funktionen.html — capabilities and workflows
- /werkz-technik.html — technology and integrations
- /werkz-sicherheit.html — security
- /werkz-fragebogen.html — intake/pre-check
- /werkz-zeiterfassung.html — WerkZ Time module
- /server.html — DeutschZ technical reference
- /deutschz-feedback.html — DeutschZ feedback
- /roadmap.html — DeutschZ roadmap

Project 29212 must not receive new canonical product development. Archive first; remove later when the owner has confirmed the backup.