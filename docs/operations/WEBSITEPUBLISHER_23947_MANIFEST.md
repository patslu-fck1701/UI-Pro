# WebsitePublisher Project 23947 Manifest

**Baseline:** KB-v1.33
**Date:** 2026-09-30

## Canonical runtime

- Project: **23947**
- Fallback: https://project23947.websitepublisher.ai/
- Planned main domain: **werkz-digital.eu** (reported purchased, not connected yet)
- WerkZ is the main brand.
- DeutschZ is the integrated technical reference/lab.
- WerkZ Time is a reusable module.

## Canonical public WerkZ routes

- `/` — main WerkZ entry
- `/werkz.html` — overview/pricing
- `/werkz-funktionen.html` — functions/workflows
- `/werkz-technik.html` — technology/integrations
- `/werkz-sicherheit.html` — security
- `/werkz-fragebogen.html` — intake/pre-check
- `/werkz-detailcheck.html` — deeper discovery
- `/werkz-zeiterfassung.html` — WerkZ Time module
- `/werkz-en.html` and matching EN subpages — English public set
- `/impressum.html`, `/datenschutz.html` — legal pages; re-check before commercial launch

## DeutschZ routes

- `/server.html` — project/reference overview
- `/deutschz-punkte.html` — points/black market reference
- `/deutschz-feedback.html` — feedback/test area
- `/roadmap.html` — roadmap/community

## Internal / development routes

- `/login.html`, `/forgot-password.html`, `/reset-password.html` — auth
- `/deutschz-admin.html`, `/werkz-admin.html` — admin/internal
- `/werkz-zeit.html`, `/werkz-zeit-einsatz.html`, `/werkz-zeit-tag.html` — internal WerkZ Time prototype flow

## Shared fragments

- `site-header`, `site-footer`
- `werkz-header`, `werkz-header-en`, `werkz-footer`
- `werkz-security-ribbon`

## Core assets

WerkZ: `css/werkz.css`, `css/werkz-time.css`, `js/werkz-time-core.js`, WerkZ logo/security images.
DeutschZ: DeutschZ CSS/JS bundles and `images/deutschz-logo-golden.webp`.
Historical time prototype: `private/arbeitszeit.html` is not the canonical public product source.

## Historical project 29212

Project 29212 is a Gabriel-specific historical test build. It should receive no new canonical product development. Archive privately before owner-side deletion. After removal, two Starter project slots remain available for real isolated customer/product deployments.

## Domain switch

After registrar confirmation, use WebsitePublisher's documented A records for root and `www`, connect the domain to project 23947 in the owner dashboard, validate HTTPS, then update canonical/SEO URLs. Do not claim the domain is live before verification.

## Production boundary for WerkZ Time

Reusable module logic exists, but customer/employee production use still requires server persistence, Tenant Auth, explicit data policies, multi-device testing, private file delivery, backup/restore, cross-tenant negative tests and documented support/deletion rules.