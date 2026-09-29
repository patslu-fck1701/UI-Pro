# WerkZ Public Pricing & Scope Rules

**Baseline:** KB-v1.31  
**Date:** 2026-09-29

This document contains only the public-safe pricing and scope logic. Internal hourly-cost assumptions, margins, private cost pools and customer-specific calculations stay outside the public repository.

## Public starting prices

- **WerkZ Solo:** from **€490**
- **WerkZ Team:** from **€1,490**
- **WerkZ Business:** from **€2,490**

These are starting prices for clearly scoped configurations assembled from existing WerkZ modules. They are not promises of unlimited bespoke development from zero.

## Why reuse matters

WerkZ is built as a library of reusable capabilities: time/evidence capture, intake, customer/order objects, notifications, document handling, role-specific views, integrations, logging, backup and other modules.

A proven module should be configured and connected for the next customer instead of rebuilt from scratch. This is how WerkZ can keep entry pricing accessible while preserving implementation quality.

## Scope boundaries

The starting price can include the agreed baseline configuration. Additional scope is quoted separately when it materially increases work or risk, for example:

- custom integrations or APIs;
- data migration and cleanup;
- additional roles, departments or approval flows;
- unusual security/governance requirements;
- customer-specific software or licensed services;
- custom domains;
- ongoing operations, monitoring or support.

## Recurring fees

A recurring WerkZ fee should exist only when WerkZ provides a recurring service such as hosting, monitoring, maintenance or support.

Where practical, customer-specific third-party accounts and usage-based services should be owned and paid by the customer directly.

## Product boundaries

WerkZ Time is one reusable module and is not equivalent to the complete WerkZ Solo product.

WerkZ Solo, Team and Business combine multiple modules into broader operating workflows. See:
- `docs/architecture/PRODUCT_MODULE_BOUNDARIES.md`
- `docs/architecture/TIME_TRACKING_MODULE.md`

## Public communication rule

Public pages should explain:
- what the starting price covers;
- that reuse keeps delivery efficient;
- that additional custom scope is quoted separately;
- that third-party/runtime costs are transparent;
- that recurring fees correspond to actual recurring service.

Internal cost rates, private margins and customer-specific calculations must not be published.
