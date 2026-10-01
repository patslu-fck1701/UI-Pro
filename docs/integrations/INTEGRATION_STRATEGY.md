# WerkZ Integration Strategy

**Date:** 2026-10-01  
**Status:** architecture/research input for the next implementation package  
**Source:** Files Library `/WerkZ/Research/Werk_Z_Integrationsbericht_Oktober_2026.txt`  
**Library file id:** `libfile_c5e86a5960208191874decec75d09404`

## Goal

WerkZ should not hard-code one-off customer integrations into business modules.

The integration layer must make a new customer primarily a matter of:

`authorize -> connect -> map -> synchronize`

rather than a new software project.

## Core boundary

Business modules depend on stable provider-neutral ports/events.

Provider-specific code lives in adapters.

Do not put Microsoft/Google/Meta/DATEV/SAP conditionals into the WerkZ Core.

## Connector contract

The integration architecture should support a connector contract equivalent to:

- connect/authenticate
- refresh credentials
- pull
- push
- handle webhook
- health check
- disconnect
- map/normalize

Exact method names may follow the repository's language/conventions.

## Provider-neutral integration models

Prepare stable contracts/models for:

- IntegrationAccount
- CredentialReference
- WebhookSubscription
- SyncJob
- SyncCursor
- IntegrationEvent
- ConnectorHealth
- MappingProfile

Provider-specific fields belong in typed provider config, not generic business records.

## Credentials and secrets

Separate:

### Global WerkZ application credentials
Examples:
- OAuth application client id/secret/certificate
- webhook signing secret
- provider application id

### Per-organisation/customer credentials
Examples:
- tenant/account id
- access/refresh token metadata
- API key reference
- WABA/phone id
- remote server credential reference

Rules:
- no customer passwords unless the protocol genuinely requires customer-managed credentials;
- no plaintext secrets in normal relational business tables;
- use a SecretStore abstraction / credential reference;
- encryption and rotation strategy must be replaceable;
- audit connect/disconnect/credential-rotation actions without logging secret values.

## Webhook gateway

Target shape:

`/api/webhooks/{provider}/{tenant-or-connection-key}`

Processing boundary:

1. receive webhook;
2. verify provider signature/authenticity;
3. resolve integration account/tenant;
4. persist event metadata/idempotency key;
5. acknowledge quickly;
6. queue processing;
7. process through connector/domain mapping;
8. audit result.

Do not let provider webhooks directly mutate business tables without the normal domain/capability/event path.

## Queue, retry and idempotency

Every external sync/event job should support:

- idempotency key
- external event id
- attempt count
- last error
- next retry time
- status
- correlation id
- organisation/integration-account scope

Retry policy is configuration, not provider-specific business logic.

Duplicate external events must not create duplicate invoices, messages, payments or approvals.

## Mapping / normalization

External systems map into stable WerkZ domain objects.

Candidate cross-provider objects include:

- Organisation/Tenant
- User/Employee
- Company/Customer/Supplier/Contact
- Project/Job/WorkSite/Task
- TimeEntry/WorkSession
- Document/Photo/Attachment
- Quote/Order/Delivery/Invoice/Payment
- Message/Conversation
- CalendarEvent

Do not force provider-native object shapes into the core domain.

## Integration categories / priorities

### Foundation first
- tenant/organisation scope
- capabilities/permissions
- secret management
- OAuth service
- webhook gateway
- queue/worker/retry
- idempotency
- audit
- normalized integration contracts
- import/export framework

### High-reuse adapters after foundation
- Microsoft 365 / Graph
- Google Workspace
- WhatsApp Business
- XRechnung / ZUGFeRD
- DATEV
- Lexware Office
- SFTP
- WebDAV / Nextcloud

### Later
- sevdesk
- HubSpot
- Dropbox
- Slack
- Dynamics 365
- Salesforce
- Peppol provider
- SAP / EDI / EDIFACT
- branch-specific systems
- industrial MQTT/OPC UA where justified

Priority is a practical implementation proposal, not a market-share ranking.

## E-invoice direction

Invoices should be structured domain data, not PDF-only.

The architecture should be able to support:
- XRechnung import/export
- ZUGFeRD import/export
- EN-16931 validation
- original XML/document retention
- PDF rendering
- DATEV/provider export
- Peppol via external certified provider adapter

Do not operate a Peppol Access Point unless a future business case explicitly justifies it.

## Messaging / approvals

WhatsApp, email, Teams, Slack, SMS and similar systems are channels.

They do not own approval state.

Approval/notification actions must route back through WerkZ core commands with:
- actor
- organisation
- entity id/type
- command
- provider/message id
- correlation/idempotency
- audit event

## Current implementation boundary

Issue #3 may add the generic connector/secret/webhook/queue contracts needed by current modules.

It should **not** attempt live provider implementations yet.

The first real provider package should only begin after:
- Time production ports/offline scope is complete;
- entitlement/module boundaries are stable;
- secret store/webhook/queue primitives exist;
- provider-specific current documentation is freshly verified.

## Freshness rule

Provider API details change.

Before any real production integration, re-check current:
- OAuth scopes
- API versions
- app review/verification
- pricing/usage limits
- webhook signature rules
- token lifetime/rotation requirements
- sandbox/production approval requirements

This applies especially to Meta/WhatsApp, Microsoft, Google, DATEV, Salesforce, SAP, HubSpot, Slack, Lexware, sevdesk and Peppol providers.
