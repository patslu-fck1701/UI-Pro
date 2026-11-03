# Owner quota dashboard MVP under master issue #126

Stacked after PR #15; separate branch/PR. One Owner tab in the existing app, no
new service. Requires pinned issuer/subject AND persistent OWNER grant on every
request. All customer roles and unpinned/expired/revoked Owner sessions are denied.

Four cards: OpenAI API, ElevenLabs V10, Codex, Claude/Claude Code. The current
MVP intentionally has NO live billing connection: unknown values remain unknown.
Owner can manually enter dated measured/exported/estimated values through a form.
The server never accepts a client-supplied LIVE_PROVIDER label. Export entries
remain MANUELL; estimates additionally show SCHÄTZUNG. After 24 hours or reset,
VERALTET overrides the visible source and hides the active percentage bar. Original
source/timestamps remain available. Missing denominator/zero denominator means no
bar; 100% means fully remaining, 0% exhausted, negative availability means overdrawn.
No cross-currency conversions or subtraction of costs from alleged prepaid credit.

Every snapshot replaces the whole measure: unit, period, account_ref/model/plan,
amounts, reset and observation time. Account changes do not reuse old denominators.
Optimistic version and durable idempotency prevent lost updates/duplicate imports.
Snapshots are scoped to the verified Owner user, never globally shared with a
customer. No keys, cookies, raw provider exports, prompts or audio are accepted.
hotel_008 adds private snapshots/import results. No live migration performed.

Known Owner context (original top-up and reported subscription percentage) is
NOT seeded as a current provider balance or live remaining quota. No invented
reset timestamp. Codex free resets/extra credits are separate, never automatically
redeemed. Claude subscription limits are separate from Anthropic API costs.
ElevenLabs local characters, reported provider character units and credits remain
different units; no 1:1 conversion is assumed. Actual Overage status is unknown
unless explicitly entered; the form never changes provider settings.

## Official references checked 2026-11-03

- OpenAI usage/cost reporting:
  https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage
- OpenAI public API pricing: https://developers.openai.com/api/docs/pricing
- ElevenLabs subscription: https://elevenlabs.io/docs/api-reference/user/subscription/get
- ElevenLabs public pricing: https://elevenlabs.io/pricing/api
- Codex plan usage: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
- Claude plan limits: https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work

No existing authorized billing key or officially permitted plan-usage read interface
is available through this runtime's connectors. No key created/copied, no local
auth.json/cookie scraping. Actual OpenAI RESTBALANCE and ElevenLabs plan/credits
remain BLOCKED_PROVIDER_BILLING_ACCESS. Admin usage/costs are not treated as prepaid
balance. Existing ElevenLabs /v1/user/subscription may be added with explicit
existing read authorization; no provider call is made by this MVP.

## P2 synthetic preparation, not an executable paid benchmark

Owner-only cost-preview endpoint and buttons calculate synthetic request sizes
with dated public list prices, never network access. gpt-6-luna standard short
context: USD 0.10 input / 0.50 output / 0.01 cached input per million tokens.
Public ElevenLabs v2 Multilingual list equivalent: USD 0.08 per thousand characters.
Actual plan allocation/credits/taxes/FX may differ. Counts use test data only.
600 and 1600 output caps and 1200 TTS characters have explicit tests. Current
upstream production chat cap is 800; benchmark variants do not silently change it.
Preview always returns paid_call_allowed=false. No EUR estimate without a verified
dated exchange rate. Original EUR top-up is not a current USD balance.

Required BEFORE any paid benchmark:
1. Real authoritative account balance and subscription/Overage/autorecharge readback.
2. Exact model, tariff, USD/EUR/credit unit, actual usage fields and tax/FX treatment.
3. Transaction-safe monetary reservations integrated into real provider paths,
   conservative worst-case input/output, pending billing reserve and hard stop.
   Current token/character reservations are NOT that monetary gate.
4. Specific Owner approval, for example <= USD 0.10 only if it fits verified actual
   funds, scope and currency. No activation implied by master issue or preview.
5. One short request, one longer variant, translation test and separately approved
   TTS/replay; log only request metadata/actual usage, no private content.
6. Reconcile request/day/project costs with provider billing; cache replay must not
   call TTS again. Investigate discrepancies before any larger workload. Never
   enable autorecharge, extra usage, new subscriptions or automatic resets.

Open: automatic authorized provider imports, genuine balances, detailed per-request
usage/cost reconciliation and integrated monetary gate. This PR provides a tested,
truthful manual MVP plus free synthetic preview, not complete live cost telemetry.
