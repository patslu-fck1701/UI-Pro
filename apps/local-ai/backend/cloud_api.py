"""WerkZ host adapter for pinned GINI Cloud 1.0; no local GINI connection."""
import json
import os
import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
from .db import Session, LoginSession, User
from .kundenz import OIDCSession, recheck, enabled
from .security import current_user, session_hash, COOKIE_NAME
from .cloud_store import SQLDocumentStore, CloudPermission, CloudBudget
from .gini_cloud import GiniCloud, Identity, GiniCloudError, OpenAIPort, Document, sha256_text
from .write_lock import begin_write

router = APIRouter(prefix='/api/gini/v1', tags=['gini-cloud'])
POLICY = 'werkz-cloud/1.0'
store = SQLDocumentStore()


class Context:
    def __init__(self, request: Request):
        self.session_id = session_hash(request.cookies.get(COOKIE_NAME, ''))
        self.identity = self.verify()

    def verify(self):
        if not enabled():
            raise HTTPException(403, 'OIDC-Anmeldung erforderlich.')
        with Session() as db:
            session = db.get(LoginSession, self.session_id)
            binding = db.get(OIDCSession, self.session_id)
            if not session or not binding:
                raise GiniCloudError('SESSION_REVOKED', 401, 'Sitzung nicht verfügbar')
            user = db.get(User, session.user_id)
            if not user:
                raise GiniCloudError('SESSION_REVOKED', 401, 'Sitzung nicht verfügbar')
            grant = recheck(db, user, session, self.session_id)
            return Identity.from_server_session(dict(auth_source='oidc', tenant_id=user.tenant,
                principal_id=user.id, roles=[grant.role], session_id=self.session_id,
                issuer=binding.issuer, subject=binding.subject,
                expires_at=datetime.fromtimestamp(min(session.expires, grant.expires), timezone.utc).isoformat()))

    def is_active(self, session_id):
        try:
            return session_id == self.session_id and self.verify() == self.identity
        except Exception:
            return False

    def decide(self, req):
        identity = self.verify()
        with Session() as db:
            grant = db.get(CloudPermission, identity.principal_id)
            if (not grant or grant.revoked or grant.expires <= time.time()
                    or req['principal_id'] != identity.principal_id or req['tenant_id'] != identity.tenant_id
                    or req['policy_version'] != POLICY or req['source'] != 'gini-cloud'
                    or req['project_scope'] != 'gini' or req['purpose'] != 'hotel_assistant'
                    or req['consent_ref'] != grant.consent_ref
                    or req['action'] not in json.loads(grant.actions)
                    or req['data_class'] not in json.loads(grant.data_classes)):
                return {'decision': 'DENY', 'reason_code': 'NO_BOUND_CLOUD_GRANT', 'decision_id': uuid.uuid4().hex}
            if 'TEST_CUSTOMER' in identity.roles and req['data_class'] not in {'synthetic', 'public'}:
                return {'decision': 'DENY', 'reason_code': 'SYNTHETIC_ONLY', 'decision_id': uuid.uuid4().hex}
            if req['data_class'] == 'OWNER_PRIVATE':
                if not identity.is_owner(owner_binding()) or req['resource'] == 'openai:chat':
                    return {'decision': 'DENY', 'reason_code': 'OWNER_PRIVATE', 'decision_id': uuid.uuid4().hex}
            action, resource = req['action'], req['resource']
            valid = ((resource == 'gini:chat' and action == 'ask') or
                     (resource == 'openai:chat' and action == 'openai:chat') or
                     (resource.startswith('document:') and action in
                      {'file:read', 'file:upload', 'file:propose_edit', 'file:save', 'file:restore'}))
            if not valid:
                return {'decision': 'DENY', 'reason_code': 'ACTION_DENIED', 'decision_id': uuid.uuid4().hex}
            expiry = min(grant.expires, identity.expires_at.timestamp(),
                         datetime.fromisoformat(req['expires_at'].replace('Z','+00:00')).timestamp())
            return {**req, 'expires_at': datetime.fromtimestamp(expiry, timezone.utc).isoformat(),
                    'decision': 'ALLOW', 'reason_code': 'bound_cloud_grant', 'decision_id': uuid.uuid4().hex}

    def consent(self):
        with Session() as db:
            grant = db.get(CloudPermission, self.identity.principal_id)
            return grant.consent_ref if grant else 'not-granted'


def owner_binding():
    return os.environ.get('WERKZ_OWNER_ISSUER', ''), os.environ.get('WERKZ_OWNER_SUBJECT', '')


class PersistentBudget:
    """Conservatively reserve before sending; failed calls retain reservation.

    Units are token ceilings, not currency. No automatic refunds or retries.
    Twelvefold reserve bounds the upstream character/3 estimate conservatively.
    """
    def __init__(self, tenant):
        self.tenant = tenant
        self.limit = max(0, int(os.environ.get('WERKZ_GINI_CLOUD_TOKEN_LIMIT', '0')))
        self.reservation = 0

    def reserve(self, tokens):
        amount = max(0, int(tokens))*12
        with Session() as db:
            begin_write(db)
            row = db.get(CloudBudget, self.tenant)
            if not row:
                row = CloudBudget(tenant=self.tenant, used=0)
                db.add(row)
            if not self.limit or row.used+amount > self.limit:
                raise GiniCloudError('COST_LIMIT_REACHED', 429, 'Kostenlimit nicht freigegeben oder erreicht')
            row.used += amount
            db.commit()
            self.reservation = amount

    def commit(self, tokens):
        if int(tokens) > self.reservation:
            raise GiniCloudError('COST_LIMIT_REACHED', 429, 'Tokenlimit überschritten')


def context(request: Request, user=Depends(current_user)):
    return Context(request)


def service(ctx):
    budget = PersistentBudget(ctx.identity.tenant_id)
    approved = (os.environ.get('WERKZ_GINI_CLOUD_ENABLED') == '1'
                and os.environ.get('WERKZ_GINI_CLOUD_COST_APPROVED') == '1')
    provider = OpenAIPort(api_key=os.environ.get('WERKZ_GINI_CLOUD_OPENAI_KEY', ''),
                         model='gpt-6-luna', budget=budget, enabled=approved)
    return GiniCloud(kundenz=ctx, openai=provider, documents=store, sessions=ctx,
                     policy_version=POLICY, owner_binding=owner_binding())


def authorize(ctx, action, document):
    svc = service(ctx)
    svc._active(ctx.identity)
    svc._data_class_guard(ctx.identity, document['data_class'])
    svc.gate.require(ctx.identity, resource='document:'+document['document_id'], action=action,
        purpose='hotel_assistant', data_class=document['data_class'], consent_ref=ctx.consent())


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Upload(Input):
    name: str = Field(max_length=180)
    content: str = Field(max_length=60000)
    data_class: Literal['synthetic', 'OWNER_PRIVATE'] = 'synthetic'


class Chat(Input):
    messages: list[dict] = Field(min_length=1, max_length=8)


class Proposal(Input):
    instruction: str = Field(min_length=3, max_length=2000)


class Approval(Input):
    explicit_approval: bool
    proposed_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    idempotency_key: str = Field(min_length=8, max_length=128)


class Restore(Input):
    version: int = Field(ge=1)
    expected_version: int = Field(ge=1)
    explicit_approval: bool
    idempotency_key: str = Field(min_length=8, max_length=128)


@router.get('/capabilities')
def capabilities(ctx=Depends(context)):
    result = service(ctx).capabilities()
    if result['providers']['openai']['state'] == 'online':
        result['providers']['openai']['state'] = 'CONFIGURED_NOT_VERIFIED'
    return result


@router.post('/chat')
def chat(data: Chat, ctx=Depends(context)):
    return service(ctx).chat(ctx.identity, messages=data.messages, purpose='hotel_assistant',
                             consent_ref=ctx.consent(), data_class='synthetic')


@router.post('/documents', status_code=201)
def upload(data: Upload, ctx=Depends(context)):
    raw = dict(document_id='upload', tenant_id=ctx.identity.tenant_id, version=1,
               name=data.name, content=data.content, data_class=data.data_class, sha256=sha256_text(data.content))
    Document.from_host(raw)
    authorize(ctx, 'file:upload', raw)
    return store.put(tenant_id=ctx.identity.tenant_id, name=data.name, content=data.content,
                     data_class=data.data_class, principal=ctx.identity.principal_id)


@router.get('/documents')
def documents(ctx=Depends(context)):
    results = []
    for raw in store.list(ctx.identity.tenant_id):
        try:
            authorize(ctx, 'file:read', raw)
        except GiniCloudError as exc:
            if exc.status in {403, 404}:
                continue
            raise
        results.append({k:raw[k] for k in ('document_id','name','version','data_class','sha256')})
    return results


@router.get('/documents/{identifier}')
def read(identifier: str, ctx=Depends(context)):
    raw = store.get(ctx.identity.tenant_id, identifier)
    if raw is None:
        raise GiniCloudError('DOCUMENT_NOT_FOUND', 404, 'Dokument nicht gefunden')
    authorize(ctx, 'file:read', raw)
    return raw


@router.get('/documents/{identifier}/versions')
def versions(identifier: str, ctx=Depends(context)):
    read(identifier, ctx)
    return store.history(ctx.identity.tenant_id, identifier)


@router.post('/documents/{identifier}/edit-proposals')
def propose(identifier: str, data: Proposal, ctx=Depends(context)):
    result = service(ctx).propose_edit(ctx.identity, document_id=identifier,
        instruction=data.instruction, purpose='hotel_assistant', consent_ref=ctx.consent())
    ctx.verify()
    store.save_draft(ctx.identity, result['draft'])
    return result


@router.post('/edit-proposals/{identifier}/approve')
def approve(identifier: str, data: Approval, ctx=Depends(context)):
    draft = store.load_draft(ctx.identity, identifier)
    if data.explicit_approval is not True or data.proposed_sha256 != draft['proposed_sha256']:
        raise GiniCloudError('APPROVAL_REQUIRED', 428, 'Ausdrückliche Freigabe fehlt')
    raw = read(draft['document_id'], ctx)
    authorize(ctx, 'file:save', raw)
    replay = store.replay(ctx.identity.tenant_id, ctx.identity.principal_id,
                          data.idempotency_key, identifier, data.proposed_sha256)
    if replay:
        return {'contract_version':'gini-cloud/1.0.0', 'status':'SAVED',
                'new_version':replay['version'], 'idempotent_replay':True}
    return service(ctx).approve_save(ctx.identity, draft=draft,
        approval={'explicit_approval':True, 'approved_by':ctx.identity.principal_id,
                  'draft_id':identifier, 'proposed_sha256':data.proposed_sha256},
        purpose='hotel_assistant', consent_ref=ctx.consent(), idempotency_key=data.idempotency_key)


@router.post('/documents/{identifier}/restore')
def restore(identifier: str, data: Restore, ctx=Depends(context)):
    raw = read(identifier, ctx)
    authorize(ctx, 'file:restore', raw)
    if data.explicit_approval is not True:
        raise GiniCloudError('APPROVAL_REQUIRED', 428, 'Wiederherstellung bestätigen')
    old = store.old_version(ctx.identity.tenant_id, identifier, data.version)
    return store.commit_version(tenant_id=ctx.identity.tenant_id, document_id=identifier,
        expected_version=data.expected_version, content=old['content'], sha256=old['sha256'],
        approved_by=ctx.identity.principal_id, draft_id='restore:'+str(data.version),
        idempotency_key=data.idempotency_key)
