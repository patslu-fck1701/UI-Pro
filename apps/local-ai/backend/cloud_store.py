"""Host-owned, tenant-scoped SQL document versions and idempotent writes."""
import json
import time
import uuid
from sqlalchemy import String, Text, Integer, Float, select
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, Session, Audit, now
from .write_lock import begin_write
from .gini_cloud import Document, GiniCloudError, sha256_text


class CloudDocument(Base):
    __tablename__ = 'cloud_documents'
    tenant: Mapped[str] = mapped_column(String, primary_key=True)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    data_class: Mapped[str] = mapped_column(String)
    version: Mapped[int] = mapped_column(Integer)


class CloudVersion(Base):
    __tablename__ = 'cloud_versions'
    tenant: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(String, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String)
    principal: Mapped[str] = mapped_column(String)
    created: Mapped[str] = mapped_column(String, default=now)


class CloudDraft(Base):
    __tablename__ = 'cloud_drafts'
    tenant: Mapped[str] = mapped_column(String, primary_key=True)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    principal: Mapped[str] = mapped_column(String)
    expires: Mapped[float] = mapped_column(Float)
    payload: Mapped[str] = mapped_column(Text)


class CloudCommit(Base):
    __tablename__ = 'cloud_commits'
    tenant: Mapped[str] = mapped_column(String, primary_key=True)
    principal: Mapped[str] = mapped_column(String, primary_key=True)
    key: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(String)
    draft_id: Mapped[str] = mapped_column(String)
    sha256: Mapped[str] = mapped_column(String)
    version: Mapped[int] = mapped_column(Integer)


class CloudPermission(Base):
    __tablename__ = 'cloud_permissions'
    principal: Mapped[str] = mapped_column(String, primary_key=True)
    actions: Mapped[str] = mapped_column(Text)
    data_classes: Mapped[str] = mapped_column(Text)
    consent_ref: Mapped[str] = mapped_column(String)
    expires: Mapped[float] = mapped_column(Float)
    revoked: Mapped[int] = mapped_column(Integer, default=0)


class CloudBudget(Base):
    __tablename__ = 'cloud_budgets'
    tenant: Mapped[str] = mapped_column(String, primary_key=True)
    used: Mapped[int] = mapped_column(Integer)


def missing():
    return GiniCloudError('DOCUMENT_NOT_FOUND', 404, 'Dokument nicht gefunden')


def record(db, head, version=None):
    if head is None:
        return None
    row = db.get(CloudVersion, (head.tenant, head.id, version or head.version))
    if row is None:
        raise missing()
    return dict(document_id=head.id, tenant_id=head.tenant, name=head.name,
                data_class=head.data_class, version=row.version, content=row.content, sha256=row.sha256)


class SQLDocumentStore:
    def list(self, tenant_id):
        with Session() as db:
            return [record(db, row) for row in db.scalars(select(CloudDocument).where(
                CloudDocument.tenant == tenant_id).order_by(CloudDocument.id).limit(100))]

    def get(self, tenant_id, document_id):
        with Session() as db:
            return record(db, db.get(CloudDocument, (tenant_id, document_id)))

    def put(self, *, tenant_id, name, content, data_class, principal):
        identifier = 'doc-'+uuid.uuid4().hex
        raw = dict(document_id=identifier, tenant_id=tenant_id, name=name, content=content,
                   data_class=data_class, version=1, sha256=sha256_text(content))
        Document.from_host(raw)
        with Session() as db:
            begin_write(db)
            db.add(CloudDocument(tenant=tenant_id, id=identifier, name=name, data_class=data_class, version=1))
            db.add(CloudVersion(tenant=tenant_id, document_id=identifier, version=1,
                                content=content, sha256=raw['sha256'], principal=principal))
            self._audit(db, tenant_id, principal, 'cloud.document.created', identifier)
            db.commit()
        return raw

    @staticmethod
    def _audit(db, tenant, principal, event, target):
        db.add(Audit(id=str(uuid.uuid4()), tenant=tenant, actor=principal, event=event, target=target))

    def replay(self, tenant, principal, key, draft_id, sha):
        with Session() as db:
            row = db.get(CloudCommit, (tenant, principal, key))
            if row is None:
                return None
            if row.draft_id != draft_id or row.sha256 != sha:
                raise GiniCloudError('IDEMPOTENCY_CONFLICT', 409, 'Schlüssel bereits anders verwendet')
            return {'version': row.version, 'document_id': row.document_id}

    def commit_version(self, *, tenant_id, document_id, expected_version, content, sha256,
                       approved_by, draft_id, idempotency_key):
        with Session() as db:
            begin_write(db)
            previous = db.get(CloudCommit, (tenant_id, approved_by, idempotency_key))
            if previous:
                if (previous.document_id, previous.draft_id, previous.sha256) != (document_id, draft_id, sha256):
                    raise GiniCloudError('IDEMPOTENCY_CONFLICT', 409, 'Schlüssel bereits anders verwendet')
                return {'version': previous.version}
            head = db.get(CloudDocument, (tenant_id, document_id))
            if not head:
                raise missing()
            if head.version != expected_version:
                raise GiniCloudError('VERSION_CONFLICT', 409, 'Version geändert')
            if sha256_text(content) != sha256:
                raise GiniCloudError('DRAFT_TAMPERED', 422, 'Prüfsumme falsch')
            Document.from_host({**record(db, head), 'content': content, 'sha256': sha256})
            head.version += 1
            db.add(CloudVersion(tenant=tenant_id, document_id=document_id, version=head.version,
                                content=content, sha256=sha256, principal=approved_by))
            db.add(CloudCommit(tenant=tenant_id, principal=approved_by, key=idempotency_key,
                               document_id=document_id, draft_id=draft_id, sha256=sha256, version=head.version))
            self._audit(db, tenant_id, approved_by, 'cloud.document.version.created', document_id)
            db.commit()
            return {'version': head.version}

    def history(self, tenant, document_id):
        with Session() as db:
            if not db.get(CloudDocument, (tenant, document_id)):
                raise missing()
            return [{'version': r.version, 'sha256': r.sha256, 'created': r.created}
                    for r in db.scalars(select(CloudVersion).where(CloudVersion.tenant == tenant,
                        CloudVersion.document_id == document_id).order_by(CloudVersion.version))]

    def old_version(self, tenant, document_id, version):
        with Session() as db:
            value = record(db, db.get(CloudDocument, (tenant, document_id)), version)
            if not value:
                raise missing()
            return value

    def save_draft(self, identity, draft):
        if draft.get('tenant_id') != identity.tenant_id or draft.get('requested_by') != identity.principal_id:
            raise GiniCloudError('DRAFT_NOT_FOUND', 404, 'Entwurf nicht gefunden')
        with Session() as db:
            db.add(CloudDraft(tenant=identity.tenant_id, id=draft['draft_id'], principal=identity.principal_id,
                              expires=min(time.time()+900, identity.expires_at.timestamp()), payload=json.dumps(draft)))
            db.commit()

    def load_draft(self, identity, identifier):
        with Session() as db:
            row = db.get(CloudDraft, (identity.tenant_id, identifier))
            if not row or row.principal != identity.principal_id or row.expires <= time.time():
                raise GiniCloudError('DRAFT_NOT_FOUND', 404, 'Entwurf nicht gefunden')
            return json.loads(row.payload)
