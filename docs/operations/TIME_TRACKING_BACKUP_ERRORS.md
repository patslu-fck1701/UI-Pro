# WerkZ Time Tracking — Backup, Error and Recovery Model

**Baseline:** KB-v1.29

## Principle

Operational failures must remain visible. A bug that is fixed without recording the cause and guardrail is likely to be rebuilt later.

## Current local reference layer

Before every state write the previous valid JSON state is copied to `werkz_time_backup_v1`.

The module also keeps an error journal in `werkz_time_errorlog_v1` with:

- timestamp;
- stage;
- human-readable error message;
- optional technical context.

Global JavaScript errors and unhandled promise rejections are captured in addition to explicit GPS, speech and storage failures.

A user with access to the internal prototype can:

- download a complete JSON snapshot;
- restore the previous local state;
- export the day's jobsite data as CSV.

## Cross-system safety

- **GitHub:** canonical code, architecture, tests and reusable guardrails.
- **WebsitePublisher:** live implementation, page/asset version history and structured WerkZ reflections.
- **Google Drive:** human-readable cross-system knowledge register.
- **Chat/project context:** working layer only; not sole durable truth.

A backup is not considered verified merely because it exists. Recovery needs a readback/test path.

## Change discipline

Before a material time-module change:

1. preserve a recoverable repository/page state;
2. identify affected data keys/contracts;
3. implement the smallest coherent change;
4. verify the happy path;
5. run the relevant negative/regression checks;
6. record failure/correction/lesson when a new class of bug is discovered;
7. synchronize only the semantic delta to Drive/WebsitePublisher/GitHub;
8. stop once the systems agree semantically.

## Known pilot failures retained as lessons

### Empty daily summary after finish

Cause classes observed during the Gabriel pilot included duplicate finish handling, fragile source/destination state transfer and published-script parsing problems.

Guardrail: one finish path, synchronous durable state first, small URL fallback second, independent destination reconstruction third.

### 414 Request-URI Too Large

Cause: a full serialized day summary was placed in the navigation query string.

Correction: keep the full record in storage; URL contains only bounded fallback values such as start, end and employer.

Guardrail: never transport arbitrary jobsite/photo/day payloads in query parameters.

### Published JavaScript rendered as page text / summary script not running

Cause: literal closing page tags embedded in generated document strings interacted badly with publication/optimization parsing.

Correction: avoid literal page-closing sequences inside script strings.

Guardrail: syntax-check every script after publication and visually verify the live page.
