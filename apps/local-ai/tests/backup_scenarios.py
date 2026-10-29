"""Restore actual industry DB snapshots; no operating demo data is modified."""
import os,sys,tempfile,sqlite3
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
root=Path(tempfile.mkdtemp(prefix='werkz-restore-test-'));package=sys.argv[1]
mode='production' if package=='hotel' else 'demo'
os.environ.update(WERKZ_AI_PACKAGE=package,WERKZ_AI_MODE=mode,WERKZ_AI_DATA=str(root))
from fastapi.testclient import TestClient
from backend.app import app
from backend.db import DATA
from backend.backup import create_protected,restore_protected
from backend.windows_protection import MAGIC
with TestClient(app,headers={'origin':'http://testserver'}) as client:
    prefix='hotel' if package in {'hotel','hotel-demo'} else 'work'
    if package=='hotel':
        identity={'username':'synthetic_backup_owner','password':'synthetic-only-test'}
        assert client.post('/api/setup',json=identity).status_code==201
        assert client.post('/api/login',json=identity).status_code==200
        category=client.post('/api/hotel/room-types',json={'name':'SYNTHETIC BACKUP','capacity':2,'nightly_cents':10000}).json()
        assert client.post('/api/hotel/rooms',json={'number':'SYN-BACKUP','type_id':category['id']}).status_code==201
    else:
        response=client.post('/api/'+prefix+'/demo/start',json={'role':'management' if prefix=='hotel' else 'administrator'})
        assert response.status_code==200,response.text
    snapshot=client.get('/api/'+prefix+'/snapshot');assert snapshot.status_code==200
    with sqlite3.connect(DATA/'werkz-ai.sqlite3') as db:
        assert db.execute('SELECT count(*) FROM sessions').fetchone()[0]>0
        if prefix=='hotel':db.execute("INSERT INTO hotel_portal_sessions VALUES('synthetic-old-cookie','synthetic-access','2099-01-01')");db.commit()
        table='hotel_rooms' if prefix=='hotel' else 'platform_work_records'
        expected=db.execute('SELECT count(*) FROM '+table+(' WHERE kind != \'demo_grant\'' if prefix=='work' else '')).fetchone()[0]
    archive=create_protected(DATA,root/'protected.wzb')
    assert archive.read_bytes().startswith(MAGIC) and b'SYNTHETISCH' not in archive.read_bytes()
    target=root/'restored'
    try:restore_protected(target,archive,59999,'wrong-package-demo')
    except ValueError:pass
    else:raise AssertionError('Cross-package restore was accepted')
    assert not target.exists()
    restore_protected(target,archive,59999,package+'-'+mode)
    with sqlite3.connect(target/'werkz-ai.sqlite3') as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert db.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        assert db.execute('SELECT count(*) FROM '+table).fetchone()[0]==expected
        assert db.execute('SELECT count(*) FROM hotel_portal_sessions').fetchone()[0]==0
        assert db.execute('SELECT count(*) FROM hotel_demo_grants').fetchone()[0]==0
        assert db.execute("SELECT count(*) FROM platform_work_records WHERE kind='demo_grant'").fetchone()[0]==0
    corrupted=root/'corrupt.wzb';raw=bytearray(archive.read_bytes());raw[-1]^=1;corrupted.write_bytes(raw)
    try:restore_protected(root/'corrupt-target',corrupted,59999,package+'-'+mode)
    except (ValueError,RuntimeError):pass
    else:raise AssertionError('Damaged backup was accepted')
    if package=='hotel':
        import subprocess
        from backend.backup import restore_port
        assert restore_port('hotel')==8001 and restore_port('handwerk-demo')==8000
        cli=subprocess.run([sys.executable,'-m','backend.backup','create',str(root/'cli-production.wzb'),'--package','hotel','--mode','production'],capture_output=True,text=True,timeout=30)
        assert cli.returncode==0,cli.stderr
        assert (root/'cli-production.wzb').read_bytes().startswith(MAGIC)
        from unittest.mock import patch
        from backend import backup
        previous_argv=sys.argv
        try:
            sys.argv=['backup','restore',str(archive),'--package','hotel','--mode','production']
            with patch('backend.backup.socket.socket') as socket:
                probe=socket.return_value.__enter__.return_value
                probe.connect_ex.return_value=0
                try:backup.main()
                except RuntimeError:pass
                else:raise AssertionError('Restore while Hotel port is active was accepted')
                probe.connect_ex.assert_called_once_with(('127.0.0.1',8001))
        finally:sys.argv=previous_argv
print('PASS '+package+': encrypted backup/readback, real DB restore, package isolation, revoked sessions/grants, corruption rejection.')
