import json,os,shutil,subprocess,sys,socket,time
from pathlib import Path
import pytest

pytestmark=pytest.mark.skipif(os.name!='nt',reason='Windows startup semantics')
ROOT=Path(__file__).resolve().parents[1]


def test_startup_scripts_parse_on_windows_powershell():
    command="$ErrorActionPreference='Stop';foreach($p in @('start.ps1','scripts/common.ps1','scripts/start-model.ps1','scripts/startup.ps1')){$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseFile((Join-Path $PWD $p),[ref]$tokens,[ref]$errors)|Out-Null;if($errors){throw ($errors|Out-String)}}"
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],cwd=ROOT,capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr


def test_missing_installation_is_blocked_and_registration_refused(tmp_path):
    scripts=tmp_path/'scripts';scripts.mkdir()
    for name in ['common.ps1','startup.ps1']:shutil.copyfile(ROOT/'scripts'/name,scripts/name)
    command=['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',str(scripts/'startup.ps1')]
    health=subprocess.run([*command,'-Action','Health'],capture_output=True,text=True,timeout=30)
    assert health.returncode==0,health.stderr
    report=json.loads(health.stdout)
    assert report['phase']=='BLOCKED' and report['checks']['files']=='missing'
    assert json.loads((tmp_path/'.runtime/startup-status.json').read_text())['phase']=='BLOCKED'
    receipt=(tmp_path/'.runtime/STARTPRUEFUNG.html').read_text(encoding='utf-8')
    assert 'BLOCKED' in receipt and 'Startpruefung' in receipt
    register=subprocess.run([*command,'-Action','Register'],capture_output=True,text=True,timeout=15)
    assert register.returncode!=0 and 'before registering' in register.stderr


def test_detached_backend_does_not_keep_powershell_output_pipe_open(tmp_path):
    import httpx
    if not (ROOT/'.venv/Scripts/python.exe').is_file():pytest.skip('Run this Windows lifecycle test in the installed app checkout')
    with socket.socket() as probe:
        try:probe.bind(('127.0.0.1',8133))
        except OSError:pytest.skip('Isolated test port already in use')
    wrapper=tmp_path/'launch.ps1'
    wrapper.write_text("$ErrorActionPreference='Stop'\n& $args[0] $args[1] backend --port 8133\nexit $LASTEXITCODE\n")
    env={**os.environ,'WERKZ_AI_DATA':str(tmp_path/'data'),'WERKZ_AI_PACKAGE':'handwerk-demo','WERKZ_AI_MODE':'demo'}
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',str(wrapper),sys.executable,str(ROOT/'scripts/launch-local.py')],env=env,cwd=ROOT,capture_output=True,text=True,timeout=15)
    assert result.returncode==0,result.stderr
    pid=int(result.stdout.strip())
    try:
        with httpx.Client(timeout=2,trust_env=False) as client:
            for _ in range(20):
                try:
                    response=client.get('http://127.0.0.1:8133/api/setup')
                    if response.status_code==200:break
                except httpx.HTTPError:pass
                time.sleep(.25)
            else:pytest.fail('Detached isolated backend did not become ready')
    finally:
        # Only the freshly created child PID from this test; never an arbitrary listener.
        subprocess.run(['taskkill','/PID',str(pid),'/T','/F'],capture_output=True,timeout=10)
