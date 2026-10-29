import subprocess,sys
from pathlib import Path
def test_empty_hotel_program_without_demo_records():
    root=Path(__file__).resolve().parents[1]
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('hotel_program_scenarios.py'))],cwd=root,capture_output=True,text=True,timeout=60)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
