# WerkZ Deployment / Product Split — superseded

**Baseline:** KB-v1.33  
**Original decision:** KB-v1.32 / 2026-09-29  
**Status:** SUPERSEDED by `docs/architecture/DEPLOYMENT_TOPOLOGY.md`

The earlier three-project split was a temporary planning assumption. After reviewing the actual WebsitePublisher limits, the Codex package and the practical time-tracking implementations, the current architecture is:

1. **Project 23947** — canonical WerkZ live runtime.
2. **DeutschZ** — integrated technical origin/reference/lab inside that runtime.
3. **WerkZ Time** — reusable module inside WerkZ.
4. **Project 29212** — latest practical Gabriel time-app implementation; temporary source for feature harvesting and private archival, not a permanent separate product.

Once 29212 has been fully harvested, backed up and parity-checked, it may be removed by the owner, leaving two Starter project slots free for actual isolated customer/product deployments.

Do not use the old three-separate-project target for new work.