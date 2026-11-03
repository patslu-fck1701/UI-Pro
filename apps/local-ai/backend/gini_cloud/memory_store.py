"""Reference document store (in-memory) – shows Codex the storage contract GINI expects.

Production storage (PostgreSQL/object storage on Render) belongs to Codex. Required semantics:
tenant-scoped reads, optimistic locking (expected_version), every previous version kept and
restorable, idempotent commits per idempotency_key.
"""
from __future__ import annotations

import threading

from .contract import GiniCloudError, sha256_text


class InMemoryDocumentStore:
    def __init__(self):
        self._docs: dict[tuple[str, str], list[dict]] = {}
        self._commits: dict[str, dict] = {}
        self._lock = threading.Lock()

    def put(self, *, tenant_id: str, document_id: str, name: str, content: str, data_class: str) -> dict:
        with self._lock:
            versions = self._docs.setdefault((tenant_id, document_id), [])
            rec = {'document_id': document_id, 'tenant_id': tenant_id, 'name': name, 'version': len(versions) + 1,
                   'data_class': data_class, 'content': content, 'sha256': sha256_text(content)}
            versions.append(rec)
            return dict(rec)

    def get(self, tenant_id: str, document_id: str) -> dict | None:
        with self._lock:
            versions = self._docs.get((tenant_id, document_id))
            return dict(versions[-1]) if versions else None

    def history(self, tenant_id: str, document_id: str) -> list[dict]:
        with self._lock:
            return [dict(v) for v in self._docs.get((tenant_id, document_id), [])]

    def commit_version(self, *, tenant_id, document_id, expected_version, content, sha256, approved_by,
                       draft_id, idempotency_key) -> dict:
        with self._lock:
            if idempotency_key in self._commits:
                return dict(self._commits[idempotency_key])
            versions = self._docs.get((tenant_id, document_id))
            if not versions:
                raise GiniCloudError('DOCUMENT_NOT_FOUND', 404, 'Dokument nicht gefunden')
            if versions[-1]['version'] != expected_version:
                raise GiniCloudError('VERSION_CONFLICT', 409, 'Version geändert')
            if sha256_text(content) != sha256:
                raise GiniCloudError('DRAFT_TAMPERED', 422, 'Inhalt passt nicht zur Prüfsumme')
            rec = {**versions[-1], 'version': expected_version + 1, 'content': content, 'sha256': sha256,
                   'approved_by': approved_by, 'draft_id': draft_id}
            versions.append(rec)
            result = {'version': rec['version']}
            self._commits[idempotency_key] = result
            return dict(result)

    def restore(self, tenant_id: str, document_id: str, version: int) -> dict:
        """Restore = new version with old content (history is never rewritten)."""
        with self._lock:
            versions = self._docs[(tenant_id, document_id)]
            old = next(v for v in versions if v['version'] == version)
            rec = {**versions[-1], 'version': versions[-1]['version'] + 1, 'content': old['content'],
                   'sha256': old['sha256'], 'restored_from': version}
            versions.append(rec)
            return dict(rec)
