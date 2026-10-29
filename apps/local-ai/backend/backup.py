"""Local offline restore with path validation; uses a SQLite-consistent snapshot."""
import argparse,os,sqlite3,tempfile,zipfile,socket,time,json
from pathlib import Path
from contextlib import closing

def revoke_sessions(db):
    """Restored browser cookies and demo grants must never become valid again."""
    tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    for table in ['sessions','hotel_portal_sessions','hotel_demo_grants']:
        if table in tables:db.execute('DELETE FROM '+table)
    if 'platform_work_records' in tables:db.execute("DELETE FROM platform_work_records WHERE kind='demo_grant'")
    db.commit()

def create(data:Path,target:Path):
    if not (data/'werkz-ai.sqlite3').is_file():raise ValueError('Für dieses Paket und diesen Modus gibt es noch keine Datenbank.')
    if target.exists():raise ValueError('Sicherungsdatei existiert bereits. Bitte einen neuen Dateinamen wählen.')
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='werkz-backup-') as directory:
        snapshot=Path(directory)/'werkz-ai.sqlite3'
        with closing(sqlite3.connect(data/'werkz-ai.sqlite3')) as source,closing(sqlite3.connect(snapshot)) as dest:source.backup(dest)
        with closing(sqlite3.connect(snapshot)) as db:revoke_sessions(db)
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('manifest.json',json.dumps({'format':1,'package_mode':data.name}))
            archive.write(snapshot,'werkz-ai.sqlite3')
            files=data/'files'
            if files.exists():
                for file in files.rglob('*'):
                    if file.is_file() and not file.is_symlink():archive.write(file,str(file.relative_to(data)))
    return target
def restore(data:Path,source:Path,port:int=8000,expected_package_mode:str|None=None):
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1',port))==0:raise RuntimeError('Vor Wiederherstellung die zugehörige WERKZ-AI-Instanz beenden.')
    with zipfile.ZipFile(source) as archive:
        members=archive.infolist()
        if len({item.filename for item in members})!=len(members):raise ValueError('Doppelte Archivpfade sind nicht erlaubt.')
        if expected_package_mode:
            if 'manifest.json' not in archive.namelist():raise ValueError('Paketnachweis fehlt. Wiederherstellung abgebrochen.')
            if json.loads(archive.read('manifest.json'))['package_mode']!=expected_package_mode:raise ValueError('Sicherung gehört zu einem anderen Paket oder Betriebsmodus.')
        if not any(item.filename=='werkz-ai.sqlite3' for item in members):raise ValueError('Datenbank fehlt.')
        if sum(item.file_size for item in members)>1024**3:raise ValueError('Archiv zu groß.')
        for item in members:
            name=item.filename.replace('\\','/')
            if name not in {'werkz-ai.sqlite3','manifest.json'} and not name.startswith('files/'):raise ValueError('Unerwarteter Archivpfad.')
            if any(part in {'..',''} for part in name.split('/')) or ':' in name or name.startswith('/'):raise ValueError('Unsicherer Archivpfad.')
        with tempfile.TemporaryDirectory(prefix='werkz-restore-') as directory:
            stage=Path(directory);archive.extractall(stage)
            with closing(sqlite3.connect(stage/'werkz-ai.sqlite3')) as db:
                if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Datenbankintegrität ungültig.')
                revoke_sessions(db)
            data.mkdir(parents=True,exist_ok=True)
            if (data/'werkz-ai.sqlite3').exists():
                if os.name=='nt':create_protected(data,data/'backups'/('before-restore-'+str(time.time_ns())+'.wzb'))
                else:create(data,data/'backups'/('before-restore-'+str(time.time_ns())+'.zip'))
            # Store old data next to the target for recovery; never discard user files.
            import shutil
            for name in ['werkz-ai.sqlite3','werkz-ai.sqlite3-wal','werkz-ai.sqlite3-shm','files']:
                old=data/name
                if old.exists():old.rename(data/(name+'.before-restore-'+str(time.time_ns())))
            shutil.copy2(stage/'werkz-ai.sqlite3',data/'werkz-ai.sqlite3')
            if (stage/'files').exists():shutil.copytree(stage/'files',data/'files')
    return data

def create_protected(data:Path,archive:Path):
    from .windows_protection import protect,unprotect
    if archive.exists():raise ValueError('Sicherungsdatei existiert bereits.')
    with tempfile.TemporaryDirectory(prefix='werkz-protected-backup-') as directory:
        plain=create(data,Path(directory)/'snapshot.zip');encrypted=protect(plain.read_bytes());archive.parent.mkdir(parents=True,exist_ok=True)
        with archive.open('xb') as output:output.write(encrypted)
        if unprotect(archive.read_bytes())!=plain.read_bytes():raise RuntimeError('Sicherungs-Lesekontrolle fehlgeschlagen.')
    return archive

def restore_protected(data:Path,archive:Path,port:int,expected_package_mode:str):
    from .windows_protection import unprotect
    with tempfile.TemporaryDirectory(prefix='werkz-protected-restore-') as directory:
        plain=Path(directory)/'snapshot.zip';plain.write_bytes(unprotect(archive.read_bytes()))
        return restore(data,plain,port,expected_package_mode)
def restore_port(package):
    return 8001 if package in {'hotel','hotel-demo'} else 8002 if package=='schrotties-demo' else 8000

def main():
    parser=argparse.ArgumentParser();parser.add_argument('operation',choices=['create','restore']);parser.add_argument('archive');parser.add_argument('--package',choices=['personal','handwerk-demo','hotel','hotel-demo','schrotties-demo'],default='handwerk-demo');parser.add_argument('--mode',choices=['demo','production'],default='demo');args=parser.parse_args()
    root=Path(__file__).resolve().parents[1];data=Path(os.environ.get('WERKZ_AI_DATA',root/'data'))/(args.package+'-'+args.mode)
    archive=Path(args.archive).resolve()
    result=create_protected(data,archive) if args.operation=='create' else restore_protected(data,archive,restore_port(args.package),args.package+'-'+args.mode)
    print('Lokale Sicherungsaktion erfolgreich: '+str(result))
if __name__=='__main__':main()
