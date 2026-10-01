# KB-v1.40 Cross-System Sync

**Date:** 2026-10-01  
**Status:** synchronized

## Delta from KB-v1.39

The former WebsitePublisher-based DeutschZ log/config/server-package verification stack was confirmed to be a temporary test and has been removed.

Deleted entities:
- `dzlogreport`
- `dzconfigsnapshot`
- `dzconfigchunk`
- `dzconfigchange`
- `dzconfigvalidation`
- `dzfeedbackstate`
- `dzserverpackage`

Record counts immediately before deletion were 2, 3, 29, 2, 30, 7 and 1 respectively.

Deleted specialized forms:
- `deutschz_testmeldung`
- `deutschz_lootmeldung`
- `deutschz_discord_alert`

## Retained player reporting

The existing `bug_report` route remains the operational player-facing error channel.

It now:
1. stores the report as a WebsitePublisher lead;
2. sends an internal server-side notification;
3. does not depend on any permanent log/config verification entity.

Deep technical analysis is performed on demand against the real files/logs and then documented in the appropriate engineering systems, rather than mirrored into a WebsitePublisher database.

## Explicitly retained

- `mediaasset`
- `werkzreflection`
- public DeutschZ roadmap/content entities that still serve live pages
- WerkZ Time / Crypto / Simulation entities pending their own separate review

## WebsitePublisher resource snapshot

- pages: 26 / 30
- assets: 51 / 300
- entities: 17 / 25
- free entity slots: 8

## Governance

This cleanup was an explicit REMOVE decision by the owner after confirming the verification stack was only a test. The simpler player reporting path was verified at configuration/code-reference level. No dummy live bug report was submitted, to avoid polluting real leads/notifications.
