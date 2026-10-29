import subprocess,sys
from pathlib import Path
def test_session_role_module_document_revocation_stops_output():
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('stream_revocation_scenarios.py'))],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=90)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
