# WerkZ Time PWA — Windows and smartphone test

Status: reference PWA shell with verified source contracts. This is not a production deployment claim.

## Start on Windows

Requirements: Node.js 20 or newer.

From the repository root:

```powershell
npm run verify
npm run pwa:serve
```

Open `http://127.0.0.1:4173` on the same Windows computer.

To choose another port:

```powershell
$env:WERKZ_PWA_PORT = "4180"
npm run pwa:serve
```

The bundled server deliberately serves only the static PWA. It does not invent users, time records, successful uploads, or a production backend.

## Smartphone test

A service worker requires HTTPS, except on the same device at `localhost`. For testing on a physical smartphone, serve `apps/time-pwa` through an authorized HTTPS development URL or deploy it to a non-production test environment connected to a WerkZ API.

Verify:

1. The page fits without horizontal scrolling.
2. Start/stop and quick-action buttons are comfortably touchable.
3. Installation to the home screen is offered where the browser supports it.
4. Reload after installation still opens the static shell while offline.
5. API responses and operational records are not returned from the service-worker cache.
6. With an authenticated test API, Time works without an order.
7. Disable network, start or correct a record, reload, and confirm the queue remains visible.
8. Restore network and confirm the command is applied once.
9. Produce a stale revision from a second device and confirm a visible conflict; no silent overwrite.
10. Capture a photo offline and confirm IndexedDB stores a Blob, not a data URL/Base64 string.
11. Restore network and confirm multipart upload, SHA-256/size validation, tenant-scoped gallery access, and removal of Blob bytes from the completed queue entry.
12. Verify another tenant cannot read the record or evidence.

## Current test boundary

Automated CI verifies syntax, manifest/static-shell completeness, no API caching, no embedded credentials, binary Blob/multipart usage, SHA-256, size limit, server-side binary-size validation, private storage, tenant isolation and idempotency.

Still manual/not verified by CI:

- actual install prompts across Safari/Chrome/Edge;
- camera permission and capture behavior on physical devices;
- a deployed HTTPS API route mapping multipart input into `TimeApplication.uploadEvidence`;
- real network loss and recovery timing.

Record browser, OS, device, API build SHA and result when performing the manual run.


## Smartphone test available now on project 29212

Open:
https://project29212.websitepublisher.ai/werkz-time-test.html

While `apiBase` is still null, safely test only local device behavior with non-sensitive dummy data:

1. Confirm “HTTPS bereit” and “IndexedDB bereit”.
2. Start a dummy time entry without an order.
3. Add a note and mileage correction.
4. Capture a disposable photo.
5. Stop the entry.
6. Reload Safari/Chrome and confirm history plus the ordered queue remain.
7. Turn flight mode on, repeat a short start/change/photo/stop chain, reload, then turn flight mode off.
8. Confirm the page does not claim server synchronization; it must say the backend is not connected.
9. Delete all local test data with “Testdaten löschen”.

After a verified HTTPS API is connected, repeat the flow after opening the API host's `/test-login` page. Then “Sync prüfen” must end in “Synchronisiert”, each queue item must be synced once, and a stale two-device change must become a visible conflict.

Do not enter real customer, employee, time or photo data in this non-production device test.
