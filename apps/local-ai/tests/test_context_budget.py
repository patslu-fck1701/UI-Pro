import asyncio
import copy
import json
import pytest
from fastapi import HTTPException
from backend.context_budget import assemble


async def count(messages):
    return len(json.dumps(messages,ensure_ascii=False))//2+20


def build(**overrides):
    args=dict(system='Deutsch. Fakten prüfen.',user='Kurze Frage',history=[],contexts=[],document='',limit=1024,response_tokens=128,count=count)
    args.update(overrides)
    return asyncio.run(assemble(**args))


def test_large_tool_snapshot_is_bounded_and_original_unchanged():
    contexts=[('Hotel',{'metrics':{'occupied':3},'rooms':[{'number':i,'note':'test '*100} for i in range(42)]})]
    original=copy.deepcopy(contexts)
    prompt,info=build(contexts=contexts)
    assert info['input_tokens']+info['response_reserve']+64<=1024
    assert info['tools_reduced'] and contexts==original
    assert 'occupied' in prompt[-1]['content']


def test_document_excerpt_and_history_remain_stored_inputs():
    history=[{'role':'user','content':'alt '*500},{'role':'assistant','content':'Antwort '*500}]
    original=copy.deepcopy(history)
    prompt,info=build(history=history,document='Datei '*4000)
    assert info['document_excerpt'] and info['history_omitted']==2
    assert history==original and info['reduced']
    assert info['input_tokens']+128+64<=1024


def test_overlong_input_rejected_then_short_followup_succeeds():
    with pytest.raises(HTTPException) as error:build(user='lang '*1000)
    assert error.value.status_code==413
    prompt,info=build(user='Hallo')
    assert prompt[-1]['content']=='Hallo' and not info['reduced']


def test_history_only_whole_recent_turns_and_no_orphan():
    history=[{'role':'assistant','content':'verwaist'}, {'role':'user','content':'Frage'}, {'role':'assistant','content':'Antwort'}]
    prompt,info=build(history=history)
    assert [row['role'] for row in prompt]==['system','user','assistant','user']
    assert info['history_omitted']==1


def test_model_failure_propagates_without_mutating_context():
    async def unavailable(_):raise OSError('synthetic unavailable')
    with pytest.raises(OSError):build(count=unavailable)
