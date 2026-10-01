# WebsitePublisher Project 23947 Manifest

**Baseline:** KB-v1.40  
**Date:** 2026-10-01

## Role

Project **23947** is the **WerkZ company/public website plus selected reference/internal pages**.

It is **not** the canonical operational WerkZ product runtime/database.

Fallback domain:
https://project23947.websitepublisher.ai/

Planned main public domain: **werkz-digital.eu** — do not claim it live until verified.

## Public WerkZ routes

- `/` — main WerkZ entry
- `/werkz.html` — services/pricing guidance
- `/werkz-funktionen.html` — modules/workflows
- `/werkz-technik.html` — technical architecture/integrations
- `/werkz-sicherheit.html` — security/permissions
- `/werkz-fragebogen.html` — pre-check
- `/werkz-detailcheck.html` — deeper discovery
- `/werkz-zeiterfassung.html` — public WerkZ Time reference
- matching English WerkZ pages
- `/impressum.html`, `/datenschutz.html`

## DeutschZ public routes

DeutschZ is a real active DayZ live server, not merely a reference.

- `/server.html` — public live-server hub; also bundles current development, workshop/mod context, changelog, ModZ learning content, support/test feedback, vote and archive material
- `/roadmap.html` — public active roadmap; KEEP
- `/deutschz-story.html` — complete story behind spoiler gate; noindex

## Private/internal retained routes

- `/login.html`, `/forgot-password.html`, `/reset-password.html`
- `/deutschz-admin.html`
- `/werkz-zeit.html`, `/werkz-zeit-einsatz.html`, `/werkz-zeit-tag.html`
- `/crypto-lab.html`
- `/werkz-analyse-simulation.html`

These private pages are references/tools, not proof that the final product runtime should remain in WebsitePublisher.

## Removed / merged routes

Current cleanup removed pages only where their role was considered duplicate/prototype. Important correction:
- `roadmap.html` was initially removed incorrectly and has been restored.
- unique DeutschZ content must be preserved through KEEP/MERGE/ARCHIVE logic before any future deletion.

## Shared fragments

- `site-header`, `site-footer`
- `werkz-header`, `werkz-header-en`, `werkz-footer`, `werkz-footer-en`

Navigation now labels DeutschZ as live server/development, not only a technical lab.

## Resource snapshot

After the 2026-10-01 correction:
- pages: **26 / 30** (4 free)
- assets: **51 / 300** (249 free)
- entities: **17 / 25** (8 free)
- internal page-link audit: **0 broken internal page links detected**

Do not create a new page/entity merely because a new product feature exists. Product features belong in the WerkZ codebase. Public explanations can usually live inside the existing marketing/technical information architecture.

## Deferred visual cleanup

Some images/variants have undesirable white backgrounds or inconsistent presentation. This is a separate visual cleanup task. Do not mass-delete assets; first scan actual references and preserve necessary originals.

## DeutschZ reporting / removed test database — KB-v1.40

Removed as obsolete test infrastructure:
- `dzlogreport`, `dzconfigsnapshot`, `dzconfigchunk`, `dzconfigchange`, `dzconfigvalidation`, `dzfeedbackstate`, `dzserverpackage`.

Removed specialized test/report forms:
- `deutschz_testmeldung`, `deutschz_lootmeldung`, `deutschz_discord_alert`.

Retained player-facing error path:
- `bug_report` -> WebsitePublisher lead capture + internal server-side notification.

No webhook secret or other credential is documented in GitHub.
