"""Isolated UI test host. Never imported by the installed application."""
import os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app import app
from backend import operator,engine
from backend.knowledge_port import KnowledgeSearchPort
operator.port=KnowledgeSearchPort(Path(os.environ['WERKZ_SYNTHETIC_AIZ_BINDING']))
async def models():return [{'id':'synthetic-ui-model'}]
async def window():return 4096
async def count(messages):return sum(len(m['content']) for m in messages)//3+20
async def tokens(messages,*args):
    assert 'AiZ' in str(messages)
    yield 'Synthetische Antwort aus dem autorisierten AiZ-Kontext.'
engine.models=models;engine.context_window=window;engine.count_tokens=count;engine.tokens=tokens
if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8136,access_log=False)
