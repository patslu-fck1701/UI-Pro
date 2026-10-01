# WerkZ Deployment / Product Split — historical decisions

**Baseline:** KB-v1.34  
**Status:** SUPERSEDED

This document preserves the evolution of the deployment decision.

## Historical assumptions

Earlier planning first considered multiple WebsitePublisher projects and later one WebsitePublisher project as a common runtime for WerkZ, DeutschZ and WerkZ Time.

Both are superseded as product-runtime architecture.

## Current decision — 2026-10-01

1. **WebsitePublisher 23947** — WerkZ public company website and selected reference/internal pages.
2. **WerkZ operational product** — separate app/PWA/customer deployment built from the local/GitHub product codebase.
3. **WerkZ Time** — reusable product module derived from a private practical pilot; prototype/reference pages may remain temporarily.
4. **DeutschZ** — independent active DayZ live server with its own ongoing development; public web content remains on the same company web project for convenience, but DeutschZ is not a WerkZ module.
5. **Project 29212 / older pilots** — reference/migration sources only; no new canonical product development.

Do not use an older topology statement to justify moving operational customer data into WebsitePublisher.
