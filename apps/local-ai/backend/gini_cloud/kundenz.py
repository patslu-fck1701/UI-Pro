"""KundenZ binding for GINI Cloud (same 12-field contract as local GINI and WerkZ PR #115).

The host provides `decide(request) -> dict`. Anything but a well-formed, request-bound
ALLOW is DENY. REQUIRE_APPROVAL never executes.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import json
import uuid

from .contract import GiniCloudError

FIELDS = ('request_id', 'principal_id', 'tenant_id', 'project_scope', 'resource', 'action',
          'purpose', 'source', 'data_class', 'policy_version', 'consent_ref', 'expires_at')
DECISIONS = ('ALLOW', 'DENY', 'REQUIRE_APPROVAL')


def binding(request: dict) -> str:
    raw = json.dumps([request[k] for k in FIELDS], ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _time(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else None
    except ValueError:
        return None


class KundenZGate:
    def __init__(self, port, *, policy_version: str, source: str = 'gini-cloud', ttl_seconds: int = 120, clock=None):
        self.port = port
        self.policy_version = policy_version
        self.source = source
        self.ttl = ttl_seconds
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def require(self, identity, *, resource: str, action: str, purpose: str, data_class: str,
                consent_ref: str, project_scope: str = 'gini') -> dict:
        now = self.clock()
        req = {'request_id': 'gc-' + uuid.uuid4().hex, 'principal_id': identity.principal_id,
               'tenant_id': identity.tenant_id, 'project_scope': project_scope, 'resource': resource,
               'action': action, 'purpose': purpose, 'source': self.source, 'data_class': data_class,
               'policy_version': self.policy_version, 'consent_ref': consent_ref,
               'expires_at': (now + timedelta(seconds=self.ttl)).strftime('%Y-%m-%dT%H:%M:%SZ')}
        if any(not isinstance(req[k], str) or not req[k].strip() or len(req[k]) > 512 or '*' in req[k] for k in FIELDS):
            raise GiniCloudError('KUNDENZ_DENY', 403, 'Unvollständige Autorisierungsanfrage',
                                 decision={'decision': 'DENY', 'reason_code': 'invalid_request'})
        try:
            out = self.port.decide(dict(req))
        except Exception:  # any authority failure is DENY
            raise GiniCloudError('KUNDENZ_UNAVAILABLE', 403, 'KundenZ nicht erreichbar → DENY',
                                 decision={'decision': 'DENY', 'reason_code': 'KUNDENZ_UNAVAILABLE'}) from None
        if not isinstance(out, dict) or out.get('decision') not in DECISIONS \
                or not isinstance(out.get('reason_code'), str) or not isinstance(out.get('decision_id'), str):
            raise GiniCloudError('KUNDENZ_DENY', 403, 'Ungültige KundenZ-Antwort → DENY',
                                 decision={'decision': 'DENY', 'reason_code': 'INVALID_KUNDENZ_DECISION'})
        public = {'decision': out['decision'], 'reason_code': out['reason_code'][:80],
                  'decision_id': out['decision_id'][:80], 'resource': resource, 'action': action}
        if out['decision'] == 'ALLOW':
            exp = _time(out.get('expires_at'))
            if any(out.get(k) != req[k] for k in FIELDS if k != 'expires_at') or exp is None \
                    or exp <= now or exp > _time(req['expires_at']):
                raise GiniCloudError('KUNDENZ_DENY', 403, 'ALLOW passt nicht zur Anfrage → DENY',
                                     decision={**public, 'decision': 'DENY', 'reason_code': 'UNBOUND_ALLOW'})
            return {**public, 'binding': binding(req)}
        code = 'KUNDENZ_REQUIRE_APPROVAL' if out['decision'] == 'REQUIRE_APPROVAL' else 'KUNDENZ_DENY'
        raise GiniCloudError(code, 403, 'KundenZ: ' + out['decision'], decision=public)
