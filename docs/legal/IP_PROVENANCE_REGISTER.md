# WerkZ IP & Contribution Provenance Register

**Status:** initial register — must be maintained as material contributors/components are added.

This file records the rights/provenance basis for WerkZ-authored and AI-assisted material. It is not a substitute for signed contracts.

| Area / source | Contribution type | Relationship / source | Rights/provenance basis | Review status | Action |
|---|---|---|---|---|---|
| WerkZ core repository | Code, docs, architecture | Owner-controlled project + AI-assisted development | Detailed per-contributor/commit rights backfill required | OPEN | Build contributor map from Git history before paid production |
| OpenAI-assisted output | Code/docs/research assistance | ChatGPT/Codex | Provider terms currently allocate Output to user/customer as between parties, subject to law; output may not be unique | REVIEWED BASELINE | Keep human review + third-party/IP scanning |
| WebsitePublisher-generated/public web material | Pages/assets/config | Connected platform/tooling | Provider/platform terms + owner inputs; generated artifacts must be reviewed before proprietary redistribution | OPEN | Record export/reuse terms for any bundled proprietary artifact |
| Issue #3 Node package | Code | WerkZ repository | `package.json` is `private:true`; currently no declared npm dependencies | VERIFIED 2026-10-01 | Re-scan after branch changes/merge |
| Manrope font reference | Font/CSS runtime dependency | Google Fonts remote reference in prototype pages | Upstream font distributed under SIL OFL 1.1 | IDENTIFIED | Self-host approved production copy + preserve OFL provenance |
| Future employees | Code/docs/design | Employment/service | §69b UrhG where conditions apply + employment confidentiality/IP clauses | FUTURE | Verify contract before access |
| Future freelancers/agencies | Code/docs/design | Contractor | Explicit written usage-rights/IP grant required | BLOCKING BEFORE WORK | Use approved contractor template |

## Minimum per-contributor record

For any new human contractor/agency contributor record:
- legal name/entity;
- engagement type;
- agreement date;
- rights clause/reference;
- confidentiality clause/reference;
- scope/repos;
- start/end dates;
- access granted/revoked;
- known third-party components;
- final handover/acceptance.

## AI-assisted contribution rule

For material AI-assisted code:
- human reviewer owns acceptance;
- never treat AI generation as a licence scan;
- retain external-source references when deliberately used;
- run the same tests/security/licence checks as human code.

## Source references

- §69b UrhG: https://www.gesetze-im-internet.de/urhg/__69b.html
- OpenAI EU Terms: https://openai.com/de-DE/policies/eu-terms-of-use/
- OpenAI Services Agreement: https://openai.com/policies/services-agreement/
