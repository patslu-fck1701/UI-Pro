import subprocess,sys
from pathlib import Path

def test_hotel_management_synthetic_database():
    script=Path(__file__).with_name('hotel_management_scenarios.py')
    r=subprocess.run([sys.executable,str(script)],cwd=script.parents[1],capture_output=True,text=True,timeout=90)
    assert r.returncode==0,r.stdout+'\n'+r.stderr
