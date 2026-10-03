'use strict';

const ENTITLED = new Set(['active', 'trial']);
const STATUSES = new Set(['active', 'trial', 'suspended', 'expired']);

const MODULE_MANIFESTS = Object.freeze([
  ['werkz.time','WZ-TIME','WerkZ Zeit',['time.start','time.stop','time.correct'],['/api/time'],[],[]],
  ['werkz.customers','WZ-CUSTOMERS','Kunden',['customer.read','customer.write'],['/api/customers'],[],[]],
  ['werkz.orders','WZ-ORDERS','Auftrag',['order.read','order.create','order.assign','order.complete'],['/api/orders'],[],['werkz.customers']],
  ['werkz.materials','WZ-MATERIAL','Material',['material.write'],['/api/materials'],[],[]],
  ['werkz.documents','WZ-DOCS','Dokumente & Fotos',['document.upload'],['/api/documents'],[],[]],
  ['werkz.billing-prep','WZ-BILLINGPREP','Abrechnungsvorbereitung',['billing.prepare'],['/api/billing-prep'],[],[]],
  ['werkz.analytics','WZ-ANALYTICS','Analyse',['analytics.view'],['/api/analytics'],[],[]],
  ['werkz.simulation','WZ-SIM','Simulation',['simulation.run'],['/api/simulation'],[],[]],
  ['werkz.management','WZ-MANAGEMENT','Chefmodus',['management.view','time.read.all'],['/api/management'],[],[]],
  ['werkz.approvals','WZ-APPROVALS','Freigaben',['approval.decide'],['/api/approvals'],[],[]],
  ['werkz.channel.whatsapp','WZ-WHATSAPP','WhatsApp-Freigabekanal',[],[],[],['werkz.approvals']]
].map(([id,sku,displayName,capabilities,routes,hardDependencies,optionalIntegrations]) => Object.freeze({
  id, sku, displayName, version:'1.0.0', capabilities, routes,
  navigation: routes.length ? [{label:displayName,route:routes[0].replace('/api','')}] : [],
  migrations: [], configSchema:{type:'object',additionalProperties:true},
  hardDependencies, optionalIntegrations,
  compatibility:{core:'>=0.1.0 <1.0.0'},
  productionDependencies:['werkz-core'],
  websitePublisherDependencies:[]
})));

class ModuleRegistry {
  constructor(manifests = MODULE_MANIFESTS) {
    this.byId = new Map();
    this.bySku = new Map();
    for (const manifest of manifests) {
      this.validate(manifest);
      if (this.byId.has(manifest.id) || this.bySku.has(manifest.sku)) throw new Error('Duplicate module manifest');
      this.byId.set(manifest.id, structuredClone(manifest));
      this.bySku.set(manifest.sku, structuredClone(manifest));
    }
  }
  validate(m) {
    for (const field of ['id','sku','displayName','version','capabilities','routes','navigation','migrations','configSchema','hardDependencies','optionalIntegrations','compatibility']) {
      if (m[field] === undefined) throw new Error('Invalid module manifest: ' + field);
    }
    if ((m.websitePublisherDependencies || []).length) throw new Error('WebsitePublisher production dependency forbidden');
  }
  get(id) { const m=this.byId.get(id); if(!m) throw new Error('Unknown module: '+id); return structuredClone(m); }
  forSku(sku) { const m=this.bySku.get(sku); if(!m) throw new Error('Unknown module SKU: '+sku); return structuredClone(m); }
  list() { return [...this.byId.values()].map(value => structuredClone(value)); }
}

class EntitlementDeniedError extends Error {
  constructor(moduleId) { super('Organisation is not entitled to ' + moduleId); this.code='ENTITLEMENT_DENIED'; this.moduleId=moduleId; }
}

class EntitlementService {
  constructor({registry = new ModuleRegistry(), clock = () => new Date(), audit = () => {}} = {}) {
    this.registry=registry; this.clock=clock; this.audit=audit; this.records=new Map();
  }
  key(organisationId,moduleId){return organisationId+':'+moduleId}
  set({organisationId,moduleId,status='active',config={},expiresAt=null,contractItemId=null,catalogVersion}) {
    this.registry.get(moduleId);
    if(!STATUSES.has(status)) throw new Error('Invalid entitlement status');
    const key=this.key(organisationId,moduleId), previous=this.records.get(key);
    const record={
      organisationId,moduleId,status,config:structuredClone(config),
      activatedAt: previous?.activatedAt || this.clock().toISOString(),
      expiresAt,contractItemId,catalogVersion
    };
    this.records.set(key,record);
    this.audit({organisationId,eventType:'entitlement.changed',entityType:'entitlement',entityId:key,payload:{moduleId,from:previous?.status||null,to:status}});
    return structuredClone(record);
  }
  get(organisationId,moduleId){const value=this.records.get(this.key(organisationId,moduleId));return value?structuredClone(value):null}
  isActive(organisationId,moduleId,at=this.clock()){
    const e=this.get(organisationId,moduleId);
    return Boolean(e && ENTITLED.has(e.status) && (!e.expiresAt || new Date(e.expiresAt)>at));
  }
  require(organisationId,moduleId){if(!this.isActive(organisationId,moduleId)) throw new EntitlementDeniedError(moduleId);return this.get(organisationId,moduleId)}
  capabilities(organisationId){
    return [...new Set(this.registry.list().filter(m=>this.isActive(organisationId,m.id)).flatMap(m=>m.capabilities))];
  }
  execute(organisationId,moduleId,operation){this.require(organisationId,moduleId);return operation()}
}

module.exports={MODULE_MANIFESTS,ModuleRegistry,EntitlementService,EntitlementDeniedError};
