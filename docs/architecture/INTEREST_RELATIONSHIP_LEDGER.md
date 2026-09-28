# WerkZ Interest / Relationship Ledger

**Baseline:** KB-v1.26

WerkZ keeps a private, evidence-aware ledger for people or businesses that show meaningful interest in WerkZ.

## Purpose

The ledger is broader than a sales CRM. A contact can be a peer, learning contact, cooperation candidate, reference candidate, lead, prospective customer or another relevant relationship. Classification may change as evidence improves.

## Core fields

- identity/display name
- party type
- first meaningful signal and source
- type of interest
- understanding stage
- context summary
- potential fit
- next step
- current status
- evidence/uncertainty note
- privacy level
- timestamps

## Evidence rule

Interest is recorded from observable signals. Do not silently promote:
interest → lead → opportunity → customer.

Each transition requires new evidence. Distinguish what was directly observed from what Patrick reports about unavailable voice/in-person context.

## Privacy

This is private operational relationship data. It must not be exposed through public website routes or committed with personal contact details to public GitHub. GitHub documents the model only; records live in the private data layer.

## Current implementation

WebsitePublisher private entity: `werkzinterest`.

First record: ID 1, created 2026-09-28. The personal record itself is intentionally not duplicated into this public repository documentation.
