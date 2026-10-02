'use strict';

class NotificationPort {
  send(_) { throw new Error('NotificationPort.send must be implemented'); }
}
class ApprovalChannel {
  request(_) { throw new Error('ApprovalChannel.request must be implemented'); }
  decide(_) { throw new Error('ApprovalChannel.decide must be implemented'); }
}
class LocalApprovalChannel extends ApprovalChannel {
  constructor(){super();this.messages=new Map();this.decisions=new Map();}
  request(request){
    if(this.messages.has(request.idempotencyKey)) return structuredClone(this.messages.get(request.idempotencyKey));
    const message={
      provider:'local',messageId:'local:'+request.idempotencyKey,state:'pending',
      organisationId:request.organisationId,actorId:request.actorId||null,
      entityType:request.entityType,entityId:request.entityId,command:request.command,
      correlationId:request.correlationId||request.idempotencyKey
    };
    this.messages.set(request.idempotencyKey,message);
    return structuredClone(message);
  }
  decide(action){
    if(this.decisions.has(action.idempotencyKey)) return structuredClone(this.decisions.get(action.idempotencyKey));
    const message=[...this.messages.values()].find(x=>x.messageId===action.messageId);
    if(!message) throw new Error('Unknown approval message');
    const result={...message,state:action.decision,decidedBy:action.actorId,decisionId:'local-decision:'+action.idempotencyKey};
    this.decisions.set(action.idempotencyKey,result);
    return structuredClone(result);
  }
}
class LocalNotificationAdapter extends NotificationPort {
  constructor(){super();this.sent=new Map();}
  send(notification){
    if(this.sent.has(notification.idempotencyKey)) return structuredClone(this.sent.get(notification.idempotencyKey));
    const result={provider:'local',messageId:'local-note:'+notification.idempotencyKey,...structuredClone(notification)};
    this.sent.set(notification.idempotencyKey,result);return structuredClone(result);
  }
}
module.exports={NotificationPort,ApprovalChannel,LocalApprovalChannel,LocalNotificationAdapter};
