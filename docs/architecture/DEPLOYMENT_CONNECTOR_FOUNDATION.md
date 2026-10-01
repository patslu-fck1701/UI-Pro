# WerkZ Deployment, Connector & Enrollment Foundation

**Date:** 2026-10-01  
**Status:** cross-cutting deployment baseline  
**Source:** Deployment/install/onboarding research, 2026-10-01

## Core decision

WerkZ is **cloud-first and agent-optional**.

The product is not one monolithic installer that every customer must run locally.

The target has three layers:

1. **WerkZ Cloud/Core** — web/PWA UI, organisation/identity, APIs, central automation, OAuth connections, queue/workers and shared product services.
2. **WerkZ Agent/Connector** — optional customer-side service only when local systems must be reached.
3. **WerkZ Clients** — browser/PWA first; native desktop/mobile clients only when device/native requirements justify them.

A smartphone-only Solo customer must work without owning a PC.

## Deployment profiles

### Hosted cloud / PWA
Default for customers whose required systems are reachable via cloud APIs.

### Windows local agent
- signed MSI as canonical package;
- optional signed EXE bootstrapper for easy interactive setup;
- silent install/uninstall supported from the beginning;
- Windows Service for background operation;
- Intune package as an enterprise distribution derivative.

### macOS
- signed and notarised PKG for system agent/daemon;
- DMG primarily for interactive desktop application;
- launchd/LaunchDaemon for background service.

### Linux
- signed DEB/RPM packages;
- APT/DNF repositories when stable distribution exists;
- systemd service.

### On-prem server
Docker Compose is the preferred early appliance profile for a single customer VM/server.

### Enterprise container platform
Kubernetes/Helm is optional when the customer already operates Kubernetes. Do not require it for small businesses.

### MDM / managed endpoints
Support packaging/guidance for Intune, Jamf, Apple Business Manager/MDM and Managed Google Play where customer scale justifies it.

### Offline / air-gapped
A future signed offline bundle may contain installers/images, public verification keys, checksums and documentation. It must not embed customer secrets.

## Agent trust boundary

The local Agent is a constrained connector, not remote-control software.

Requirements:
- outbound connection preferred, normally TLS 443;
- no generic remote shell;
- no arbitrary command execution from cloud;
- allowlisted connector capabilities;
- tenant/device identity;
- least-privilege service account;
- explicit local system permissions;
- health/status reporting;
- local log redaction;
- signed updates only;
- revocation and uninstall path.

## Enrollment model

All installer/distribution paths converge on one logical Enrollment API.

Conceptual flow:

install package -> create/read device identity -> one-time enrollment token -> register connector -> issue device credential/certificate -> bind to organisation -> fetch allowed connector config -> health check.

Enrollment tokens are one-time/short-lived, are not long-term credentials, may be revoked, are scoped to organisation/device purpose and must not expose customer provider secrets.

Device credentials are distinct from human sessions and customer-provider credentials.

## Secret placement

The installer is never a secret store.

- global WerkZ application secrets live in central secret management;
- customer/provider secrets live in tenant-isolated secret management;
- device secrets live in device-appropriate secure storage and server registration;
- configuration files contain references/identifiers, not reusable plaintext secrets where avoidable.

## Local-system integration pattern

Prefer standard protocols and adapters such as WebDAV/Nextcloud, SFTP, database/ERP connectors, file shares and local print/machine interfaces when justified.

Do not build a giant Nextcloud-specific WerkZ plugin when a stable WebDAV connector is sufficient.

## Webhook relay for closed customer networks

External provider webhooks terminate in WerkZ Cloud:

provider webhook -> cloud verification/gateway -> tenant-scoped event -> queue -> worker -> optional outbound delivery/poll over the existing Agent connection -> local customer system.

This avoids requiring inbound internet ports into a customer LAN.

## Release pipeline

Every release is generated from one central pipeline and versioned manifest. Target release contents include platform packages, container artifacts, optional offline bundle, SBOM, signatures, SHA256SUMS, signed checksum metadata and release.json.

The pipeline must support reproducible versioning, build/test before packaging, code/package/image signing, timestamping where applicable, checksums/digests, SBOM, release notes, upgrade/downgrade compatibility metadata and rollback strategy.

Signing credentials are held separately from normal developer credentials.

## Update policy

- update metadata is signed/trusted;
- the Agent validates update origin and integrity;
- staged rollout/rollback must be possible before broad customer rollout;
- update failure must not silently corrupt tenant configuration;
- customer-controlled maintenance windows should be possible for managed/enterprise deployments.

## Configuration management

Enterprise automation may use Terraform for infrastructure and Ansible/PowerShell/Bash/MDM tooling for software distribution, but all paths should converge on the same WerkZ enrollment/configuration model.

Customer-specific hand configuration must be minimised.

## Runtime topology

The same core should support shared hosted multi-tenant, isolated hosted customer instance, customer-controlled on-prem deployment and optional local Agent connected to a hosted core.

Business modules must not know which deployment profile they run under. They depend on stable persistence, storage, identity, secret and integration ports.

## Customer onboarding flow

Target onboarding:

1. create organisation/contract/entitlements;
2. choose deployment profile;
3. configure identity/admins;
4. authorise cloud providers via OAuth where possible;
5. install/enroll Agent only if local systems require it;
6. map external objects/fields;
7. run connectivity/permission checks;
8. perform test sync;
9. produce onboarding/security summary;
10. mark production-ready only after release/security gates pass.

A new customer should become primarily configuration, authorisation and mapping — not custom reimplementation.

## Domain and endpoint naming

Do not hard-code an unverified public domain into product logic. Use configuration for app, API, webhook, download/package and OAuth redirect base URLs.

Marketing/site domains and operational API/app domains remain separate deployment concerns.

## Source references

Current connected deployment research:
- Files Library id libfile_8c6fd3baef60819185d165fd09a2e051

Read together with:
- docs/security/SECURITY_PRIVACY_FOUNDATION.md
- docs/integrations/INTEGRATION_STRATEGY.md
- docs/architecture/DEPLOYMENT_TOPOLOGY.md
