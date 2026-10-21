'use strict';
const {CAPABILITIES}=require('../core/werkz-core');
const ALL=Object.freeze([...new Set([...Object.values(CAPABILITIES),'customer.read.all','order.read.all','order.plan','order.report','team.read','finance.read','invoice.draft','invoice.approve','invoice.send','integration.manage','user.manage','role.manage','automation.manage','assistant.use','operations.read','document.read','notification.read','notification.read.all','task.read','file.read'])]);
const ROLES=Object.freeze({
  owner:{label:'Chef / Inhaber',grants:ALL},
  office:{label:'Büroleitung / Verwaltung',grants:['customer.read','customer.read.all','customer.write','order.read','order.read.all','order.create','order.assign','order.plan','order.report','billing.prepare','invoice.draft','document.read','document.upload','file.read','team.read','notification.read','task.read','operations.read']},
  dispatch:{label:'Disposition',grants:['customer.read','customer.read.all','order.read','order.read.all','order.create','order.assign','order.plan','team.read','notification.read','task.read','operations.read']},
  technician:{label:'Monteur',grants:['customer.read','order.read','order.report','order.complete','time.start','time.stop','document.upload','material.write','document.read','file.read','notification.read','task.read']},
  teamlead:{label:'Vorarbeiter / Teamleiter',grants:['customer.read','order.read','order.report','order.complete','time.start','time.stop','document.upload','material.write','document.read','file.read','team.read','notification.read','task.read']},
  accounting:{label:'Buchhaltung',grants:['customer.read','customer.read.all','finance.read','billing.prepare','invoice.draft','document.read','document.upload','file.read','notification.read','task.read']},
  intake:{label:'Auftragsannahme',grants:['customer.read','customer.read.all','customer.write','order.create','notification.read','task.read']},
  admin:{label:'Technische Administration',grants:['user.manage','integration.manage','notification.read','task.read']}
});
function capabilities(user){if(!user||user.active===false||!Array.isArray(user.roles))return [];const grants=new Set();for(const role of user.roles){if(!ROLES[role])return [];for(const grant of ROLES[role].grants)grants.add(grant);}for(const grant of user.additionalCapabilities||[])if(ALL.includes(grant))grants.add(grant);for(const grant of user.deniedCapabilities||[])grants.delete(grant);return [...grants].sort();}
function assigned(user,order){if(!order||order.organisationId!==user.organisationId)return false;if(order.responsibleUserIds?.includes(user.id))return true;return user.roles.includes('teamlead')&&Boolean(order.teamId)&&Array.isArray(user.teamIds)&&user.teamIds.includes(order.teamId);}
function allowed(user,permission,{organisationId,resource=null,kind=null,orders=[]}={}){
  if(!user?.id||!organisationId||user.organisationId!==organisationId||!ALL.includes(permission))return false;
  const grants=capabilities(user);if(!grants.includes(permission))return false;
  if(!resource)return true;
  if(resource.organisationId!==organisationId)return false;
  if(resource.financial===true&&!grants.includes('finance.read'))return false;
  if(kind==='notification'||kind==='task')return resource.userId===user.id||grants.includes('notification.read.all');
  if(kind==='time')return resource.actorId===user.id||grants.includes('time.read.all');
  const order=kind==='order'?resource:resource.orderId?orders.find(x=>x.id===resource.orderId):null;
  if(resource.orderId&&!order)return false;
  if(order)return grants.includes('order.read.all')||assigned(user,order);
  if(kind==='customer')return grants.includes('customer.read.all')||orders.some(x=>x.customerId===resource.id&&assigned(user,x));
  if(kind==='file'||kind==='document')return resource.ownerId===user.id||grants.includes('order.read.all')||grants.includes('finance.read');
  return false;
}
function requirePermission(user,permission,context){if(!allowed(user,permission,context))throw Object.assign(new Error('Zugriff nicht erlaubt.'),{code:'FORBIDDEN'});}
module.exports={ALL,ROLES,capabilities,assigned,allowed,requirePermission};
