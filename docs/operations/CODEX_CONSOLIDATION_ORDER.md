# Codex Consolidation Order — WerkZ

**Baseline:** KB-v1.34  
**Date:** 2026-10-01  
**Scope:** owner's actual local Codex workspace + GitHub technical alignment.

## Starting rule

The actual local `WerkZ.zip` / local Codex workspace is the only accepted local implementation baseline.

WebsitePublisher, GitHub docs and later handoff archives are deltas/references until Codex applies and verifies them.

## Goal

Build the real WerkZ product as a separate operational web app/PWA using the existing local WerkZ structure rather than turning the company website into the product runtime.

## Phase 0 — protect and inventory

- create a fresh backup of the actual local workspace;
- inventory current folders, code, tests and working flows;
- do not overwrite working code blindly;
- record exact starting revision/hash where possible.

## Phase 1 — Core boundaries

Establish or align:
- organisation/tenant context;
- identity;
- capability-based permissions;
- configuration/feature flags;
- structured events/history and audit;
- persistence abstraction;
- offline/sync contracts;
- integration adapter boundary.

Prefer a modular monolith initially.

## Phase 2 — first end-to-end business path

Build one coherent flow:

`customer -> order -> time -> field/job evidence -> completion -> approval`

Requirements:
- time can link to an order but must not require the order module;
- smartphone-first UX;
- solo user can hold every capability;
- team users can receive reduced task views;
- audit records who did what and when.

## Phase 3 — offline/PWA

- home-screen capable PWA;
- local queue for relevant offline work;
- stable local IDs;
- queued photo/document upload;
- conflict detection;
- sync recovery on reconnect/app reopen;
- no dependency on permanent iOS background execution.

## Phase 4 — analytics

Derive metrics from real tenant-scoped events/history.

## Phase 5 — simulation

Separate scenario/simulation data from production data. Version rules/scenarios. No mutation of real operational records. Avoid look-ahead in historical simulation.

## Phase 6 — approvals/messaging

Implement a generic approval interface first. WhatsApp/email/etc. are adapters. The core validates, de-duplicates, links, timestamps and audits the actual action.

## Phase 7 — deployment profiles

Support:
- hosted smartphone-only Solo;
- small team;
- mid-size;
- later enterprise/on-prem extensions without forcing that complexity into small deployments.

## Website boundary

Do not build new production modules as WebsitePublisher pages.

WebsitePublisher project 23947 remains company/public website and reference surface.

## DeutschZ boundary

DeutschZ remains an active DayZ live server and separate development project. Do not absorb DeutschZ operational code/config into the WerkZ product repository. Reusable engineering lessons may be documented as references.

## Acceptance tests

- Solo and multi-user use the same core;
- optional modules can be enabled/disabled;
- smartphone flow is usable;
- offline -> sync is observable;
- tenant/capability rules are tested;
- audit captures critical actions;
- analytics respects tenant/org scope;
- simulation never mutates real data;
- backup/restore is tested;
- no secrets/private fixtures committed.

## Deliverable

A tested local WerkZ Core v1 revision plus migration/change report that states exactly which 2026-10-01 deltas were applied.
