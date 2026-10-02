# Release manifest signing workflow

The public repository contains verification code and this command, never a private signing key. Keep the Ed25519 private key in a controlled signer environment outside the checkout; pass its explicit file path at release time. Package and OS code signing remain separate production gates.

Prepare a payload JSON with productId, version, channel, releasedAt, supportedUntil, compatibility, rollback, SBOM and notice references, and an `artifacts` array of basename-only names. The signer computes SHA-256 from the actual artifact bytes before signing.

```sh
node tools/release-manifest.js sign release-payload.json dist /secure/key.pem release-key-1 dist/release.json
node tools/release-manifest.js verify dist/release.json /secure/public.pem dist
```

The verifier fails closed on an unknown key, altered signed payload or changed package digest. Publish only the public verification key and signed manifest with artifacts. A production CI signer, trusted timestamp, platform package signature and key rotation policy still need owner infrastructure and release process.
