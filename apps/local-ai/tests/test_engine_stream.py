"""Synthetic SSE completion regressions; no llama.cpp or external network."""
import asyncio
import json

import httpx
import pytest

from backend import engine


def mock_stream(monkeypatch, body, status=200):
    original = httpx.AsyncClient

    def respond(request):
        assert request.url.path == '/v1/chat/completions'
        return httpx.Response(status, text=body)

    transport = httpx.MockTransport(respond)
    monkeypatch.setattr(
        engine.httpx, 'AsyncClient',
        lambda **kwargs: original(**kwargs, transport=transport),
    )


def read_stream():
    async def collect():
        return [
            text async for text in engine.tokens(
                [{'role': 'user', 'content': 'synthetic hello'}],
                'synthetic-model', 0.1, 10,
            )
        ]

    return asyncio.run(collect())


def test_completed_sse_is_accepted(monkeypatch):
    chunk = {'choices': [{'delta': {'content': 'Synthetische Antwort.'}}]}
    mock_stream(monkeypatch, 'data: ' + json.dumps(chunk) + '\n\ndata: [DONE]\n\n')
    assert read_stream() == ['Synthetische Antwort.']


def test_truncated_sse_is_rejected(monkeypatch):
    chunk = {'choices': [{'delta': {'content': 'Unvollständig'}}]}
    mock_stream(monkeypatch, 'data: ' + json.dumps(chunk) + '\n\n')
    with pytest.raises(ValueError, match='before completion'):
        read_stream()


def test_empty_sse_is_rejected(monkeypatch):
    mock_stream(monkeypatch, '')
    with pytest.raises(ValueError, match='before completion'):
        read_stream()

@pytest.mark.parametrize('payload', [
    {'error': {'message': 'synthetic provider failure'}},
    {'choices': []},
    {'choices': [{'delta': None}]},
    {'choices': [{'delta': {'content': 123}}]},
])
def test_invalid_sse_event_is_controlled_error(monkeypatch, payload):
    mock_stream(monkeypatch, 'data: ' + json.dumps(payload) + '\n\ndata: [DONE]\n\n')
    with pytest.raises(ValueError, match='Invalid model stream event'):
        read_stream()


@pytest.mark.parametrize('reason', ['length', 'content_filter', 'tool_calls', 1])
def test_nonstop_finish_reason_is_rejected_even_with_done(monkeypatch, reason):
    # A transport [DONE] is not proof that the generated answer finished normally.
    chunk = {'choices': [{'delta': {'content': 'Synthetic partial text'}, 'finish_reason': reason}]}
    mock_stream(monkeypatch, 'data: ' + json.dumps(chunk) + '\n\ndata: [DONE]\n\n')
    with pytest.raises(ValueError, match='not completed normally'):
        read_stream()


def test_explicit_stop_finish_reason_is_accepted(monkeypatch):
    chunk = {'choices': [{'delta': {'content': 'Synthetic complete text'}, 'finish_reason': 'stop'}]}
    mock_stream(monkeypatch, 'data: ' + json.dumps(chunk) + '\n\ndata: [DONE]\n\n')
    assert read_stream() == ['Synthetic complete text']
