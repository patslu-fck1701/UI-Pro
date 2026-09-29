# Gabriel mobile time tracking — WerkZ reference

**Baseline:** KB-v1.29  
**Classification:** practical UX/process reference, not a paid customer reference.

## Reference workflow

The Gabriel test build established a simple worker-facing pattern:

1. login with a personal user;
2. choose employer/assignment;
3. start a running work-time counter;
4. close individual jobsites/tasks while the main shift keeps running;
5. capture GPS coordinates and a readable address;
6. dictate or type the completed work;
7. optionally add customer/place/photo;
8. save and continue working;
9. repeat for multiple jobsites;
10. press finish only at real end of day;
11. open an automatic day summary;
12. review total time, employer, start/end and all jobsite records chronologically.

The supplied mobile screenshots were used as a visual/interaction reference. They are not treated as canonical source code.

## What transfers into WerkZ

- thumb-friendly mobile controls;
- visible running timer;
- configurable employer/assignment shortcuts plus free-text other assignment;
- work-unit completion separate from shift completion;
- GPS/address capture with retry;
- speech/text fallback;
- optional photo evidence;
- automatic return to active shift;
- resilient finish/daily-summary flow;
- backup/export/error journal;
- later role-specific office/management views.

## What does not transfer as product truth

- Gabriel-specific credentials;
- private addresses;
- test phrases or photos;
- browser-local storage as the final production database;
- any assumption that one employer list fits another business.

The production module is parameterized per tenant/business.
