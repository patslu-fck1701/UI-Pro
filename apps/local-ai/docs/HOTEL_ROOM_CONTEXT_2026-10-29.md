# Hotel AI room selection regression

Observed on 29 October 2026 in the isolated development checkout.
The room-context parser recognized only demo-style 100–399 numbers.
An actual authorized room named SYN-101 was wrongly narrowed to identifier101,
so the new HTTP regression failed before the fix with no selected room.
Numbers outside the fixed range did not trigger narrowing at all; the code
could therefore return a general hotel context for an explicit unknown room.

The parser now matches complete actual authorized room identifiers and explicitly
requested numeric/alphanumeric identifiers after Zimmer/Room. Matching is case
insensitive and respects word/hyphen boundaries. Explicit unknown identifiers
produce an empty selection, not all rooms. Existing snapshot role/tenant filters
run first, so recognizing an identifier does not authorize access to it.

Evidence:
- Before: synthetic HTTP request for Zimmer SYN-101 failed the exact-room assertion.
- After: SYN-101 alone, combined401-A/B7 (including lowercase b7), and unknown999
  passed against real temporary Hotel DB/API. Focused context excludes aggregate
  metrics and unrelated room records.
- Hotel program/operator scenarios passed, including actual role withdrawal
  during streaming and denied subsequent Hotel context access.
- Existing branch workflows and context-budget regression: **12 passed**,45.17s.

No UI/inference implementation, production data or installed Hotel files changed.
No new model call was needed for this deterministic context-filter correction.

Independent infrastructure check: Render database listing returned no selected
workspace. Available workspace was listed; owner selection was requested while
local work continued. No workspace was selected automatically, no DB read/backup,
expiry verification or restore was claimed. The historic06.11.2026 pilot expiry
therefore remains unverified pending that connector selection.
