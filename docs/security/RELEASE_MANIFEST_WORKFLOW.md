# Release manifest signing workflow

**Owner decision — 2026-10-02**

- The WerkZ source repository is intended to be **private**.
- The production licence/update signing private key is under **owner custody**.
- If GitHub is used to hold the production signing material, it must be stored as a **GitHub Actions/Repository Secret**, never as a tracked repository file.
- The public verification key may be stored/distributed with the product.

The repository contains verification code and signing tooling, never a tracked production private key. `.gitignore` already excludes common private-key/secret paths, and `npm run verify` runs a tracked-private-key audit that fails if PEM/SSH/PGP private key material is committed.

## Local/owner-custody signing

Keep the Ed25519 private key outside the checkout and pass its explicit path:

```sh
node tools/release-manifest.js sign release-payload.json dist /secure/key.pem release-key-1 dist/release.json
node tools/release-manifest.js verify dist/release.json /secure/public.pem dist
```

## GitHub Secret signing

Preferred secret name:

`WERKZ_RELEASE_PRIVATE_KEY_PEM`

A Base64-encoded alternative is also supported:

`WERKZ_RELEASE_PRIVATE_KEY_B64`

Set **only one** of those. The release tool reads the secret from the process environment and creates a KeyObject in memory:

```sh
node tools/release-manifest.js sign-env release-payload.json dist release-key-1 dist/release.json
```

The private key is not written by the release tool, not included in the signed manifest and not printed to stdout/stderr.

Prepare a payload JSON with productId, version, channel, releasedAt, supportedUntil, compatibility, rollback, SBOM and notice references, and an `artifacts` array of basename-only names. The signer computes SHA-256 from the actual artifact bytes before signing.

The verifier fails closed on an unknown key, altered signed payload or changed package digest. Publish only the public verification key and signed manifest with artifacts.

## Production key rules

- Never commit the production private key, even after repository visibility is changed to private.
- Never put the private key in source files, configuration committed to Git, release manifests, tickets, issue comments or customer packages.
- Limit secret access to the owner/release path that actually needs signing.
- Keep a separate offline recovery copy under owner control.
- Rotate the key if repository/account compromise or accidental exposure is suspected.
- Key IDs must allow future rotation; verification may trust multiple public keys during a controlled transition.
- Package/OS code signing, trusted timestamping and platform-specific signing remain separate release gates where applicable.
