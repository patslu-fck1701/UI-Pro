# WerkZ Time Feature-Parity Matrix

**Baseline:** KB-v1.33  
**Date:** 2026-09-30

This matrix is a source-comparison aid, not a production-readiness claim.

| Capability | Project 29212 (latest practical) | Generic 23947 WerkZ Time | private/arbeitszeit.html | Target |
|---|---|---|---|---|
| employer/assignment selection | yes | yes | no/other location model | keep generic |
| custom employer/assignment | yes | yes | partial | keep |
| running timer | yes | yes | yes | keep |
| multiple jobsite completions during shift | yes | yes | limited/different model | keep |
| GPS capture | yes | yes | yes | keep |
| reverse-geocoded address | yes | yes | not clearly present | keep |
| speech input | yes | yes | no | keep |
| optional photo capture | yes | yes | yes | keep |
| photo gallery | **yes** | **missing** | yes | merge from 29212/reference |
| day summary | yes | yes | different reporting model | keep |
| week/month/year reporting | yes | yes | yes | normalize |
| booking/history correction UI | **yes** | **missing** | missing | merge from 29212 |
| odometer / mileage note | **yes** | **missing** | missing | optional generic field/module |
| IndexedDB local vault | **yes** | **missing** | yes | evaluate/merge where useful |
| local encryption logic | **yes** | **missing** | yes | evaluate as offline cache, not server-auth replacement |
| backup/restore/export | yes | yes | yes | keep strongest implementation |
| error journal/global error capture | missing/limited | **yes** | missing | retain from generic core |
| tenant-auth integration path | **present/attempted** | **missing** | missing | rebuild correctly using platform Tenant Auth |
| localStorage fallback/state | yes | yes | yes | keep only as cache/fallback where appropriate |
| export | yes | yes | yes | normalize |
| server-side persistence | no | no | no | **required for production** |
| tenant row policies | no proven member test | no | no | **required for production** |
| private/gated photo storage | no | no | no | **required for production** |
| multi-device synchronization | no | no | no | **required for production** |
| cross-tenant negative tests | no | no | no | **required for production** |

## Interpretation

Project 29212 is the leading source for practical functionality and user experience. The generic WerkZ Time code in project 23947 is the leading source for reusable state contracts, backup/restore and error handling. The audited private single-file app contributes additional evidence for IndexedDB/encryption/gallery/reporting.

The merge must be additive: do not regress a useful 29212 capability merely because the current generic prototype is smaller.

## Production boundary

Local encryption and local authentication are not substitutes for real tenant authorization. Production customer/employee deployment requires WerkZ-owned authentication/session ports, server persistence, explicit tenant/row policies, private file storage and real cross-tenant tests. WebsitePublisher remains reference/UX only.


## Issue #3 implementation status

The generic Core now proves standalone Time, entitlement suspension without data deletion and later module activation. Still open: gallery, correction UI, odometer, IndexedDB/offline queue, server repository, private photo storage and multi-device conflict tests. These are not claimed complete.
