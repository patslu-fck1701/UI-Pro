# WerkZ Time Tracking Test Plan

**Baseline:** KB-v1.29

## Definition of done for the reference module

A test is only positive for the concrete path observed. A working timer does not prove GPS, speech, storage or the day summary.

### Required happy path

1. Open protected internal page.
2. Select a configured employer.
3. Start shift.
4. Verify counter increases and original start time stays stable.
5. Open jobsite completion.
6. Verify shift timer continues.
7. Allow GPS and confirm coordinates/address are shown or a clear fallback is displayed.
8. Use speech input where supported; otherwise verify typed input works.
9. Save a jobsite with at least one meaningful field.
10. Return to main screen and confirm the same shift is still active.
11. Add a second jobsite.
12. Finish the shift.
13. Confirm redirect to daily summary.
14. Confirm employer, start, finish, total duration and both jobsites.
15. Export JSON backup and CSV summary.

### Negative / failure paths

- Start without employer -> blocked with understandable message.
- Second start while shift active -> blocked.
- Jobsite page without active shift -> returns to main page.
- GPS denied -> entry remains saveable and error journal records the failure.
- Reverse geocoder unavailable -> coordinates remain visible.
- Speech API unavailable/denied -> typed text remains available.
- Photo conversion fails -> error journal records failure; user can retry without photo.
- Storage quota failure -> error journal records save failure and previous backup remains available.
- Summary opened with only small query fallback values -> still renders start/end/employer.
- Refresh main/jobsite/summary pages -> active state/daily state remains coherent.
- Stale admin session -> no private server data is exposed by the current local prototype.

## Regression tests derived from Gabriel test build

- Never put a complete day JSON payload into the URL.
- Never rely on two competing finish click handlers.
- Never clear the authoritative shift before the destination has enough information to render.
- Avoid literal closing page tags inside JavaScript-generated document strings on published pages.
- Confirm destination rendering independently from source-page event order.
- Confirm multiple saved jobsites do not duplicate after refresh.
- Confirm a previous local backup can be restored.

## Future production authorization tests

Before employee/tenant rollout:

- tenant A cannot list/read/update/delete tenant B shifts;
- employee cannot access management-only fields;
- manager scope is explicit and tested with a real tenant/member session, not only owner/admin;
- photo access follows the same tenant/record boundary;
- no private time data is SSR-rendered into a shared cache.
