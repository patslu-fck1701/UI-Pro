'use strict';

class CommercialCatalog {
  constructor(definition) {
    this.load(definition);
  }
  load(definition) {
    if(!definition || !definition.version || !Array.isArray(definition.items) || !Array.isArray(definition.presets)) throw new Error('Invalid catalog');
    this.version=definition.version;
    this.currency=definition.currency || 'EUR';
    this.items=new Map(definition.items.map(item=>[item.sku,structuredClone(item)]));
    this.presets=new Map(definition.presets.map(preset=>[preset.id,structuredClone(preset)]));
  }
  item(sku){const item=this.items.get(sku);if(!item)throw new Error('Unknown SKU: '+sku);return structuredClone(item)}
  expandPreset(id, selections={}){
    const preset=this.presets.get(id);if(!preset)throw new Error('Unknown preset: '+id);
    const skus=[...preset.skus];
    if(preset.chooseOne && selections.chooseOne) skus.push(selections.chooseOne);
    return [...new Set(skus)].map(sku=>this.item(sku));
  }
  quote({id,organisationId,skus,quantities={},createdAt=new Date().toISOString()}){
    const items=skus.map(sku=>{
      const source=this.item(sku), quantity=quantities[sku] || 1;
      return {
        id:id+':'+sku,sku,description:source.name,quantity,
        billing:source.billing,unitAmountCents:source.amountCents,
        amountCents:source.amountCents===null?null:source.amountCents*quantity,
        currency:this.currency,catalogVersion:this.version,
        priceSnapshot:{amountCents:source.amountCents,billing:source.billing,currency:this.currency}
      };
    });
    return {id,organisationId,catalogVersion:this.version,currency:this.currency,createdAt,status:'draft',items};
  }
  entitlementsForContract(contract, registry){
    return contract.items.flatMap(item=>{
      try {
        const module=registry.forSku(item.sku);
        return [{organisationId:contract.organisationId,moduleId:module.id,status:'active',contractItemId:item.id,catalogVersion:item.catalogVersion}];
      } catch (_) { return []; }
    });
  }
}

module.exports={CommercialCatalog};
