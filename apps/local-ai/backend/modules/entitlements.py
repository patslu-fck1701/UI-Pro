"""Runtime adapter for Core's active/trial entitlement contract.

Uses the existing tenant ModuleConfig; no second identity or entitlement database.
Legacy bool/preview configuration stays compatible. Stored objects fail closed.
"""
from datetime import datetime, timezone
import hashlib
import json

STATUSES = frozenset({'active', 'trial', 'suspended', 'expired'})

def revision(records):
    return hashlib.sha256(json.dumps(records, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def enabled(value, at=None):
    if type(value) is bool:
        return value
    if not isinstance(value, dict) or set(value) - {'status', 'expiresAt'}:
        return False
    if type(value.get('status')) is not str or value['status'] not in {'active', 'trial'}:
        return False
    expiry = value.get('expiresAt')
    if expiry is None:
        return True
    try:
        if not isinstance(expiry, str):
            return False
        expires = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
        return expires.tzinfo is not None and expires > (at or datetime.now(timezone.utc))
    except (ValueError, TypeError):
        return False

def effective(value):
    # These are labelled demo capabilities, never converted into active grants.
    if isinstance(value, str) and value in {'simulation', 'preview'}:
        return value
    return enabled(value)
