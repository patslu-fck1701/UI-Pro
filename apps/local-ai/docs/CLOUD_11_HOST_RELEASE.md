# GINI Cloud 1.1 host integration

Source: WerkZ PR #125, d3b7392e852baba51d405e61093082df4e42ee77.
The source's voice planning document is stale; code/tests implement 1.1. No
upstream merge or conflict resolution is performed by Codex. Claude owns that PR.

Privacy adaptation: voice.py receives the private V10 identifier from protected
host configuration instead of publishing it. Model remains eleven_multilingual_v2.
No audio, local voice profile, private pictures, local GINI/AiZ or keys are copied.

POST /api/gini/v1/voice/tts accepts a server-issued reply_id and optional matching
text. It can speak only the completed reply held for that same tenant, principal
and OIDC session for at most ten minutes. Arbitrary text/foreign/expired replies
are denied. No audio persisted. At most 64 replies and 32 MiB audio per process.
Serializing the same reply avoids double-click duplicate charges within a process;
cross-process cache replay is not guaranteed, so release remains single-instance.
Durable monthly per-tenant character reservations and per-principal rate checks
apply before the call. Failed calls retain reservation conservatively. Characters
are local budget units, NOT actual ElevenLabs credits or a monetary cost measure.

KundenZ must explicitly grant tts:synthesize for elevenlabs:tts and consent
assistant_voice. Session/cloud grants are rechecked before cache and after
provider response. Logout/role changes/revocation clear cached replies/audio.
Provider redirects are refused. OWNER_PRIVATE is not sent to external providers.
TEST_CUSTOMER has no voice grant by default. Cloud UI provides manual play/replay,
stop, clear failure status and abort/blob cleanup; no autoplay or microphone.
Response is audio/mpeg, private no-store, Vary Cookie, X-GINI-Voice provider/cache.

Activation requires ALL of the following, none configured or enabled here:

- WERKZ_GINI_CLOUD_VOICE_ENABLED=1
- WERKZ_GINI_CLOUD_VOICE_COST_APPROVED=1 after separate explicit Owner approval
- WERKZ_GINI_CLOUD_VOICE_CHAR_LIMIT positive, monthly UTC local character budget
- WERKZ_GINI_CLOUD_ELEVENLABS_KEY from an approved dedicated secret channel
- WERKZ_GINI_CLOUD_V10_VOICE_ID privately confirmed V10 identifier
- Persistent tenant/principal cloud grant, consent and unexpired OIDC session

hotel_007 is additive reservation storage, no text/audio. Readiness requires 007.
Migration, actual encrypted Hotel DB backup, isolated restore/rehearsal, exact SHA
and explicit Owner release approval remain gates from RELEASE_AND_SURFACE_CLEANUP.
No live migration, deployment, provider request, voice copy or additional cost.

Synthetic MP3 envelope tests are not a real decoder/hearing test. Actual Render
browser playback, mobile audio, Owner-confirmed hearing with Owner-PC offline,
IdP/Owner/two real customers and actual provider balance remain OPEN.
