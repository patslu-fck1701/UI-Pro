"""GINI Cloud contract 1.0.0 – data types, validation and error codes.

Pure Python standard library. No file system, no network, no local paths. Everything
that identifies a person or tenant comes from the hosting server's authenticated
session (OIDC, owned by Codex) – never from browser-controlled request fields.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import re

CONTRACT_VERSION = 'gini-cloud/1.1.0'
ROLES = frozenset({'OWNER', 'CUSTOMER_ADMIN', 'CUSTOMER_USER', 'TEST_CUSTOMER'})
DATA_CLASSES = frozenset({'public', 'synthetic', 'internal', 'customer_confidential', 'OWNER_PRIVATE'})
# First gate: safe text formats only. Office/PDF are separate follow-up gates.
TEXT_TYPES = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.json': 'application/json',
    '.yaml': 'application/yaml', '.yml': 'application/yaml', '.xml': 'application/xml',
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.ts': 'text/plain',
    '.py': 'text/x-python', '.ini': 'text/plain', '.toml': 'text/plain', '.sql': 'text/plain',
}
GATED_FORMATS = frozenset({'.docx', '.xlsx', '.pptx', '.pdf', '.doc', '.xls', '.odt', '.rtf'})
MAX_DOCUMENT_CHARS = 60_000
MAX_INSTRUCTION_CHARS = 2_000
MAX_MESSAGE_CHARS = 8_000
_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$')
_NAME = re.compile(r'^[^\\/:*?"<>|\x00-\x1f]{1,180}$')
# Secret-like content must never be forwarded to an external model.
_SECRET = re.compile(
    r'(sk-(proj-)?[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abprs]-[A-Za-z0-9-]{10,}'
    r'|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.'
    r'|(?i:(api[_-]?key|secret|password|passwort|token)\s*[=:]\s*["\']?[^\s"\']{8,}))')
_WINDOWS_PATH = re.compile(r'(?i)\b[a-z]:\\')


class GiniCloudError(Exception):
    """Every refusal carries a stable code and an HTTP status for the host server."""

    def __init__(self, code: str, status: int, message: str, *, decision: dict | None = None):
        super().__init__(f'{code}: {message}')
        self.code, self.status, self.message, self.decision = code, status, message, decision

    def body(self) -> dict:
        out = {'contract_version': CONTRACT_VERSION, 'error': {'code': self.code, 'message': self.message}}
        if self.decision:
            out['decision'] = self.decision
        return out


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _parse_time(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else None
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def contains_secret(text: str) -> bool:
    return bool(_SECRET.search(text or ''))


@dataclass(frozen=True)
class Identity:
    """Built ONLY by the host server from its authenticated OIDC session."""
    tenant_id: str
    principal_id: str
    roles: frozenset
    session_id: str
    issuer: str
    subject: str
    expires_at: datetime
    auth_source: str = 'oidc'

    @classmethod
    def from_server_session(cls, session: dict, *, now: datetime | None = None) -> 'Identity':
        now = now or datetime.now(timezone.utc)
        if not isinstance(session, dict):
            raise GiniCloudError('IDENTITY_INVALID', 401, 'Keine gültige Serversitzung')
        if session.get('auth_source') != 'oidc':
            raise GiniCloudError('IDENTITY_NOT_OIDC', 401, 'Nur OIDC-Sitzungen sind zugelassen')
        for key in ('tenant_id', 'principal_id', 'session_id'):
            if not isinstance(session.get(key), str) or not _ID.fullmatch(session[key]):
                raise GiniCloudError('IDENTITY_INVALID', 401, 'Sitzungsfeld ungültig: ' + key)
        for key in ('issuer', 'subject'):
            if not isinstance(session.get(key), str) or not 1 <= len(session[key]) <= 300:
                raise GiniCloudError('IDENTITY_INVALID', 401, 'Sitzungsfeld ungültig: ' + key)
        roles = session.get('roles')
        if not isinstance(roles, (list, tuple, set, frozenset)) or not roles or not set(roles) <= ROLES:
            raise GiniCloudError('IDENTITY_ROLES_INVALID', 403, 'Unbekannte oder fehlende Rolle')
        expires = _parse_time(session.get('expires_at'))
        if expires is None or expires <= now:
            raise GiniCloudError('SESSION_EXPIRED', 401, 'Sitzung abgelaufen')
        return cls(session['tenant_id'], session['principal_id'], frozenset(roles), session['session_id'],
                   session['issuer'], session['subject'], expires)

    def is_owner(self, owner_binding: tuple[str, str] | None) -> bool:
        # OWNER only for the server-bound issuer+sub; a role string alone is not enough.
        return bool(owner_binding) and 'OWNER' in self.roles and (self.issuer, self.subject) == tuple(owner_binding)


IDENTITY_FIELDS = frozenset({'tenant_id', 'principal_id', 'roles', 'role', 'session_id', 'issuer', 'subject',
                             'owner', 'is_owner', 'identity', 'user', 'user_id'})


def reject_client_identity(body: dict) -> None:
    """Hosts call this on browser JSON: identity fields there are an attack, not input."""
    if isinstance(body, dict) and IDENTITY_FIELDS & set(body):
        raise GiniCloudError('CLIENT_IDENTITY_REJECTED', 400,
                             'Identität kommt nur aus der Serversitzung, nicht aus dem Request')


@dataclass(frozen=True)
class Document:
    """A text document handed over by the host's storage (never fetched by GINI)."""
    document_id: str
    tenant_id: str
    name: str
    version: int
    data_class: str
    content: str
    sha256: str
    media_type: str = ''
    extension: str = field(default='', init=False)

    @classmethod
    def from_host(cls, raw: dict) -> 'Document':
        if not isinstance(raw, dict):
            raise GiniCloudError('DOCUMENT_INVALID', 400, 'Dokument fehlt')
        name = raw.get('name')
        if not isinstance(name, str) or not _NAME.fullmatch(name) or name in ('.', '..') or '..' in name \
                or name.startswith('.') or _WINDOWS_PATH.search(name):
            raise GiniCloudError('DOCUMENT_NAME_INVALID', 400, 'Dateiname ungültig (keine Pfade)')
        ext = ('.' + name.rsplit('.', 1)[-1].lower()) if '.' in name else ''
        if ext in GATED_FORMATS:
            raise GiniCloudError('FORMAT_GATED', 415, f'{ext} ist ein eigenes Folge-Gate (noch nicht freigegeben)')
        if ext not in TEXT_TYPES:
            raise GiniCloudError('FORMAT_UNSUPPORTED', 415, 'Nur sichere Textformate')
        for key in ('document_id', 'tenant_id'):
            if not isinstance(raw.get(key), str) or not _ID.fullmatch(raw[key]):
                raise GiniCloudError('DOCUMENT_INVALID', 400, 'Feld ungültig: ' + key)
        version = raw.get('version')
        if not isinstance(version, int) or isinstance(version, bool) or version < 1:
            raise GiniCloudError('DOCUMENT_INVALID', 400, 'version muss ganzzahlig ≥ 1 sein')
        if raw.get('data_class') not in DATA_CLASSES:
            raise GiniCloudError('DATA_CLASS_UNKNOWN', 403, 'Unbekannte Datenklasse → DENY')
        content = raw.get('content')
        if not isinstance(content, str) or '\x00' in content:
            raise GiniCloudError('DOCUMENT_NOT_TEXT', 415, 'Kein gültiger Text')
        if len(content) > MAX_DOCUMENT_CHARS:
            raise GiniCloudError('DOCUMENT_TOO_LARGE', 413, f'Maximal {MAX_DOCUMENT_CHARS} Zeichen')
        if raw.get('sha256') != sha256_text(content):
            raise GiniCloudError('DOCUMENT_INTEGRITY', 422, 'sha256 passt nicht zum Inhalt')
        doc = cls(raw['document_id'], raw['tenant_id'], name, version, raw['data_class'], content,
                  raw['sha256'], TEXT_TYPES[ext])
        object.__setattr__(doc, 'extension', ext)
        return doc
