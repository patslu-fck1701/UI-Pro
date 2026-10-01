'use strict';

function managementCockpit(state, organisationId) {
  const own = values => Object.values(values || {}).filter(value => value.organisationId === organisationId);
  return {
    openDecisions: own(state.approvals).filter(x=>x.state==='pending').map(x=>({type:'approval',id:x.id,orderId:x.orderId})),
    blockedOrders: own(state.orders).filter(x=>x.status==='blocked').map(x=>({type:'blocked_order',id:x.id,title:x.title})),
    readyToBill: own(state.orders).filter(x=>x.billingState==='ready').map(x=>({type:'ready_to_bill',id:x.id,title:x.title})),
    critical: own(state.orders).filter(x=>x.attentionRequired).map(x=>({type:'attention',id:x.id,title:x.title}))
  };
}
module.exports={managementCockpit};
