# WerkZ repository model

This repository owns WerkZ itself, not DeutschZ server configuration and not DeutschZ mod source.

## Boundaries

`src/` contains product-specific source.  
`packages/` contains reusable internal modules.  
`integrations/` contains external-system adapters and contracts.  
`docs/` contains architecture, knowledge, security and testing documentation.  
`templates/` contains secret-free reusable examples.  
`tools/` contains developer automation.

Customer-specific implementations must remain separable from reusable WerkZ core. Credentials and secrets are provisioned outside normal source control.
