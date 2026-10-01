'use strict';

class CommercialCatalog {
  constructor(definition) { this.load(definition); }

  load(definition) {
    if(!definition || !definition.version) throw new Error('Invalid catalog');
    this.version=definition.version;
    this.currency=definition.currency || 'EUR';
    this.model=definition.model || 'legacy_items_and_presets';
    this.definition=structuredClone(definition);
    const v2=this.model==='scope_plus_operations_plus_deployment';
    const priceable=v2
      ? [
          ...(definition.implementation||[]).map(x=>({...x,category:'implementation'})),
          ...(definition.managedOperation||[]).map(x=>({...x,category:'managed_operation'})),
          ...(definition.deployment||[]).map(x=>({...x,category:'deployment'}))
        ]
      : (definition.items||[]).map(x=>({...x,category:'legacy'}));
    if(!priceable.length) throw new Error('Catalog contains no priceable offer lines');
    this.items=new Map(priceable.map(item=>[item.sku,structuredClone(item)]));
    this.presets=new Map((definition.presets||[]).map(preset=>[preset.id,structuredClone(preset)]));
    this.moduleEntitlementSkus=new Set(definition.modulePricing?.skus||[]);
    if(v2) this.assertV2CommercialGuard();
  }

  assertV2CommercialGuard() {
    if(this.definition.permanentFreeTier===true) throw new Error('Permanent free production tier forbidden');
    for(const item of this.items.values()) {
      if(String(item.billing).toLowerCase()==='free') throw new Error('Permanent free production tier forbidden');
    }
    for(const sku of this.moduleEntitlementSkus) {
      if(this.items.has(sku)) throw new Error('Module entitlement SKU must not be a v0.2 price line: '+sku);
    }
  }

  item(sku) {
    const item=this.items.get(sku);
    if(!item) throw new Error('Unknown priceable SKU: '+sku);
    return structuredClone(item);
  }

  expandPreset(id,selections={}) {
    const preset=this.presets.get(id);
    if(!preset) throw new Error('Unknown legacy preset: '+id);
    const skus=[...preset.skus];
    if(preset.chooseOne&&selections.chooseOne) skus.push(selections.chooseOne);
    return [...new Set(skus)].map(sku=>this.item(sku));
  }

  quote({id,organisationId,skus,entitlementSkus=[],quantities={},createdAt=new Date().toISOString()}) {
    const items=skus.map(sku=>{
      const source=this.item(sku),quantity=quantities[sku]||1;
      return {
        id:id+':'+sku,sku,category:source.category,description:source.name,quantity,
        billing:source.billing,unitAmountCents:source.amountCents,
        amountCents:source.amountCents===null?null:source.amountCents*quantity,
        currency:this.currency,catalogVersion:this.version,
        priceSnapshot:{amountCents:source.amountCents,billing:source.billing,currency:this.currency,category:source.category}
      };
    });
    return {
      id,organisationId,catalogVersion:this.version,catalogModel:this.model,
      currency:this.currency,createdAt,status:'draft',items,
      entitlementSkus:[...new Set(entitlementSkus)]
    };
  }

  composeOffer({id,organisationId,setupSku,managedOperationSku=null,deploymentSkus=[],extraSkus=[],entitlementSkus=[],createdAt}) {
    if(!setupSku) throw new Error('Setup offer line required');
    const skus=[setupSku,...(managedOperationSku?[managedOperationSku]:[]),...deploymentSkus,...extraSkus];
    return this.quote({id,organisationId,skus,entitlementSkus,createdAt});
  }

  entitlementsForContract(contract,registry) {
    return (contract.entitlementSkus||[]).map(sku=>{
      const module=registry.forSku(sku);
      return {
        organisationId:contract.organisationId,moduleId:module.id,status:'active',
        contractItemId:null,catalogVersion:contract.catalogVersion,sourceEntitlementSku:sku
      };
    });
  }
}

module.exports={CommercialCatalog};
