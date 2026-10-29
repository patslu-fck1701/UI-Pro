"""Local analysis contract tests; inference doubles are not an end-to-end model proof."""
import asyncio,runpy,uuid
from datetime import datetime,timezone,timedelta
from pathlib import Path
import pytest

module=runpy.run_path(str(Path(__file__).resolve().parents[1]/'scripts/bridge-analyze.py'))
analyze=module['analyze'];engine=module['engine']

def job(**changes):
    return {'request_id':str(uuid.uuid4()),'lease_id':str(uuid.uuid4()),'prompt':'SYNTHETISCH: Testfrage','expires_at':(datetime.now(timezone.utc)+timedelta(seconds=90)).isoformat(),**changes}

@pytest.fixture
def inference(monkeypatch):
    captured=[]
    async def models():return [{'id':r'C:\private\operator\Qwen-Test.gguf'}]
    async def limit():return 4096
    async def count(messages):return 40
    async def tokens(messages,model,temperature,max_tokens):
        captured.append(messages);yield 'SYNTHETIC MODEL TEST DOUBLE'
    for name,value in [('models',models),('context_window',limit),('count_tokens',count),('tokens',tokens)]:monkeypatch.setattr(engine,name,value)
    return captured

def test_analysis_has_no_business_context_or_local_path(inference):
    result=asyncio.run(analyze(job()))
    assert result=={'answer':'SYNTHETIC MODEL TEST DOUBLE','model':'Qwen-Test.gguf'}
    assert len(inference[0])==2 and 'keinen Zugriff auf Betriebsdaten' in inference[0][0]['content']

@pytest.mark.parametrize('changes',[{'prompt':' '},{'prompt':'x'*4001},{'request_id':'not-a-request'},{'lease_id':'not-a-lease'},{'expires_at':'2000-01-01T00:00:00Z'},{'expires_at':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}])
def test_invalid_or_expired_job_never_reaches_inference(inference,changes):
    with pytest.raises((ValueError,KeyError,TypeError)):asyncio.run(analyze(job(**changes)))
    assert inference==[]

def test_missing_model_and_oversized_output_fail(inference,monkeypatch):
    async def none():return []
    monkeypatch.setattr(engine,'models',none)
    with pytest.raises(ValueError):asyncio.run(analyze(job()))
    async def models():return [{'id':'test'}]
    async def large(*args):yield 'x'*8001
    monkeypatch.setattr(engine,'models',models);monkeypatch.setattr(engine,'tokens',large)
    with pytest.raises(ValueError):asyncio.run(analyze(job()))
