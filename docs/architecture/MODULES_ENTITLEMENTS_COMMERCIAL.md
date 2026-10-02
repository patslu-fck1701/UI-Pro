# Module, entitlement and commercial boundary

**Issue:** #3  
**Implemented code:** `5302e0ac96a33c87b0bdcd2df14a14abb91608d7`

## Decision

WerkZ business modules declare technical and commercial identity in one validated manifest. Organisation access is controlled by entitlement records; UI visibility alone never authorises an API operation.

Suspension changes access state, not operational data. Re-activation restores access to retained data.

Catalog prices and presets are versioned configuration under `config/catalog/`. Quotes copy price and catalog-version snapshots. Solo, Team and Business remain editable sales presets whose SKUs become independent quote/contract items.

Management is a projection of decisions and exceptions. It is optional and does not own operational records.

Notification and approval channels are ports. The local adapter proves correlation/idempotency without claiming a live WhatsApp connection. Provider-backed WhatsApp remains future adapter work.

## Production boundaries

- no WebsitePublisher authentication, entity or asset dependency;
- analytics is not an operational-module dependency;
- simulation has an isolated route/contract and no operational write dependency;
- entitlement and capability checks remain server responsibilities;
- the in-memory implementation is a tested domain slice, not production persistence.
