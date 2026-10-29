import subprocess,sys,os
import pytest
from pathlib import Path

@pytest.mark.skipif(os.name!='nt',reason='Windows DPAPI is user-bound')
@pytest.mark.parametrize('package',['hotel','handwerk-demo','hotel-demo','schrotties-demo'])
def test_industry_protected_restore(package):
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('backup_scenarios.py')),package],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=120)
    assert result.returncode==0,result.stdout+'\n'+result.stderr

def test_isolated_guest_portal():
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('guest_scenarios.py'))],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=120)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
def test_isolated_hotel_workflows():
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('hotel_scenarios.py'))],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=120)
    assert result.returncode==0,result.stdout+'\n'+result.stderr

def test_isolated_handwerk_workflow():
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('work_scenarios.py')),'handwerk-demo'],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=120)
    assert result.returncode==0,result.stdout+'\n'+result.stderr

def test_isolated_schrotties_workflow():
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('work_scenarios.py')),'schrotties-demo'],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=120)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
