"""OpenAI for GINI Cloud. The key is injected by the host (Render secret, owned by Codex);
GINI Cloud never reads files, Windows paths or local key stores.

No Qwen fallback in the cloud: if OpenAI is unavailable the answer is a clear 503.
"""
from __future__ import annotations

import json
import threading
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, ProxyHandler

from .contract import GiniCloudError

OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
TRAINING_USE = 'prohibited'   # OpenAI output is never training/eval material (AiZ policy)


class TokenBudget:
    """Reference budget (in-memory). Hosts should persist usage; interface: reserve/commit."""

    def __init__(self, limit_tokens: int):
        self.limit = max(0, int(limit_tokens))
        self.used = 0
        self._lock = threading.Lock()

    def reserve(self, tokens: int) -> None:
        with self._lock:
            if self.limit <= 0:
                raise GiniCloudError('COST_LIMIT_NOT_APPROVED', 503, 'Kein Kostenlimit freigegeben')
            if self.used + tokens > self.limit:
                raise GiniCloudError('COST_LIMIT_REACHED', 429, 'Kostenlimit erreicht')

    def commit(self, tokens: int) -> None:
        with self._lock:
            self.used += max(0, int(tokens))


class OpenAIPort:
    def __init__(self, *, api_key: str, model: str = 'gpt-6-luna', budget: TokenBudget,
                 enabled: bool = True, transport=None, timeout: float = 90):
        self._key = api_key or ''
        self.model = model
        self.budget = budget
        self.enabled = enabled
        self.transport = transport or build_opener(ProxyHandler({}))
        self.timeout = timeout

    def status(self) -> dict:
        if not self.enabled:
            return {'state': 'offline', 'reason': 'Not-Aus aktiv'}
        if not self._key:
            return {'state': 'NOT_CONNECTED', 'reason': 'Kein Schlüssel im Host konfiguriert'}
        if self.budget.limit <= 0:
            return {'state': 'offline', 'reason': 'Kostenlimit 0'}
        return {'state': 'online', 'reason': 'konfiguriert', 'model': self.model}

    def complete(self, messages: list[dict], *, max_completion_tokens: int) -> dict:
        if not self.enabled:
            raise GiniCloudError('PROVIDER_DISABLED', 503, 'OpenAI per Not-Aus abgeschaltet')
        if not self._key:
            raise GiniCloudError('PROVIDER_NOT_CONFIGURED', 503, 'OpenAI nicht konfiguriert')
        estimate = max_completion_tokens + sum(len(m.get('content', '')) for m in messages) // 3
        self.budget.reserve(estimate)
        # gpt-6-luna: max_completion_tokens, default temperature only (verified 02.11.2026).
        body = json.dumps({'model': self.model, 'messages': messages,
                           'max_completion_tokens': max_completion_tokens, 'store': False}).encode('utf-8')
        req = Request(OPENAI_URL, data=body, method='POST',
                      headers={'Authorization': 'Bearer ' + self._key, 'Content-Type': 'application/json'})
        try:
            with self.transport.open(req, timeout=self.timeout) as resp:
                doc = json.load(resp)
            choice = doc['choices'][0]
            text = choice['message'].get('content') or ''
            usage = int((doc.get('usage') or {}).get('total_tokens') or estimate)
        except HTTPError as exc:
            code = 'PROVIDER_RATE_LIMITED' if exc.code == 429 else 'PROVIDER_REJECTED'
            raise GiniCloudError(code, 502, f'OpenAI HTTP {exc.code}') from None
        except (URLError, OSError, TimeoutError):
            raise GiniCloudError('PROVIDER_UNAVAILABLE', 503, 'OpenAI nicht erreichbar') from None
        except (ValueError, KeyError, IndexError, TypeError):
            raise GiniCloudError('PROVIDER_INVALID_RESPONSE', 502, 'Ungültige OpenAI-Antwort') from None
        self.budget.commit(usage)
        return {'text': text, 'finish_reason': choice.get('finish_reason'), 'usage_tokens': usage,
                'model': str(doc.get('model') or self.model)[:80]}
