# WerkZ Product and Module Boundaries

**Baseline:** KB-v1.30  
**Date:** 2026-09-29

## Principle

WerkZ is not a collection of isolated single-purpose apps. Reusable modules provide stable capabilities; Solo, Team and Business connect those capabilities into operating workflows.

## Reusable module example: WerkZ Time

WerkZ Time covers:

- shift start/finish;
- employer/assignment selection;
- multiple work-unit/jobsite completions during one shift;
- GPS/address;
- speech/text work notes;
- optional photo evidence;
- daily summary;
- backup/error evidence.

This module can be sold or tested separately, but it is **not** the complete WerkZ Solo product.

## WerkZ Solo

WerkZ Solo is an end-to-end operating flow for one-person or very small businesses. A representative trace is:

`phone/email/form inquiry -> customer -> job/order -> scheduling -> mobile work/time/evidence -> supplier/order/confirmation -> material and performed service -> invoice preparation -> review/approval -> customer notification/delivery -> print/archive/history`

The exact modules depend on the real business. Existing software should be integrated where practical instead of replaced automatically.

## WerkZ Team

WerkZ Team connects the same business objects across multiple people and roles. Examples:

- office intake and scheduling;
- field workers/mobile execution;
- workshop or production;
- purchasing/material;
- accounting/invoice preparation;
- management approvals.

Each role sees only the fields/actions it needs.

## WerkZ Business

WerkZ Business extends the model to multiple departments, stronger rights boundaries, management views, integration ownership, monitoring and cross-process impact analysis. Example chains may involve a production unit manufacturing a component, another role installing it, accounting processing the commercial documents and management seeing only exceptions/decisions.

## Architecture rule

Prefer:

`reusable module -> typed business objects -> explicit relationships -> role-specific views -> integration/adapters -> evidence/history`

Avoid:

`one customer -> one bespoke disconnected app -> rebuild from zero for the next customer`

The Gabriel test build is therefore treated as the first practical reference for a reusable time/evidence module, while the broader WerkZ product remains an end-to-end business operating model.
