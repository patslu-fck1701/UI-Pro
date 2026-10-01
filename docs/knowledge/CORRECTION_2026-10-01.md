# 2026-10-01 Correction — Website cleanup, DeutschZ role and governance

**Baseline:** KB-v1.34  
**Status:** corrected and persisted

## What went wrong

During a WebsitePublisher cleanup, the rule “the WerkZ website is not the WerkZ operational product” was applied too broadly.

That led to two wrong conclusions:
1. DeutschZ was described too strongly as only a technical reference/lab.
2. The public DeutschZ roadmap was deleted as if it were a disposable prototype.

DeutschZ is actually an **active DayZ community server with real players and ongoing mod/server development**. Its roadmap is operationally important because development is still active.

## Root cause

- classification by “WerkZ production vs. not WerkZ production” instead of by the real purpose of each page;
- pressure to reduce page count was allowed to influence content retention;
- no explicit preservation matrix before destructive changes;
- the dual role of DeutschZ was collapsed:
  - it is a practical origin/reference for WerkZ engineering;
  - it is also independently a real live server.

## Corrected architecture

### WerkZ
WerkZ is the main business/product focus.

Public website:
- customer-friendly first;
- technical depth on dedicated pages;
- no operational customer database in the marketing site.

Operational product:
- local/GitHub codebase;
- separate app/PWA/customer deployment;
- smartphone-only Solo must work;
- same core can scale to team/mid-size/enterprise.

### DeutschZ
DeutschZ remains a live server.

Public web:
- `/server.html` — consolidated live-server hub;
- `/roadmap.html` — active roadmap;
- `/deutschz-story.html` — separate spoiler-gated full story/noindex.

The server hub preserves:
- server/mod/project information;
- current development;
- changelog;
- ModZ learning/technical documentation;
- support/test feedback;
- vote;
- archive material.

## Preservation guardrail

Every destructive web/data change must first classify the target:

- **KEEP** — unique live purpose;
- **MERGE** — fully preserved in a verified target;
- **ARCHIVE** — historical value retained;
- **REMOVE** — proven duplicate/obsolete and no unique function/data.

Plan limits alone are never a sufficient deletion reason.

Default KEEP/MERGE:
- live server information;
- roadmap;
- changelog;
- support/test workflows;
- story canon;
- operational records/entities.

## Current WebsitePublisher snapshot after correction

- pages: 26 / 30
- assets: 51 / 300
- entities: 24 / 25
- broken internal page links detected: 0

## Deferred visual work

White/uneven image backgrounds, duplicate image variants and visual consistency are intentionally deferred to a separate visual asset review. No mass asset deletion should happen before a usage/reference scan.

## Local-source rule

The owner's real local WerkZ baseline is the original local `WerkZ.zip` / local Codex workspace derived from it.

Later handoff ZIPs or generated snapshots are deltas/references until Codex deliberately applies and verifies them.
