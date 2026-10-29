from pathlib import Path
import hashlib,zipfile
root=Path(__file__).resolve().parents[1]
target=root/'dist'/'WERKZ-AI-0.1.0.zip';target.parent.mkdir(exist_ok=True)
allowed=['backend','frontend','config','packages','customer-packages','scripts','tests','migrations','docs']
files=[]
for name in allowed:
    for file in (root/name).rglob('*'):
        relative=file.relative_to(root)
        if file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(root) and not any(part in {'node_modules','__pycache__','.pytest_cache','.git','.runtime','data'} for part in relative.parts) and not file.name.startswith('.env') and file.suffix.lower() not in {'.key','.pem','.pfx','.p12','.wzb','.sqlite3','.log'} and not any(word in file.name.lower() for word in ['demo-zugaenge','credentials','engine.key']):files.append(file)
files += [file for file in root.iterdir() if file.is_file() and file.suffix in {'.ps1','.cmd','.md','.txt','.toml'}]
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):archive.write(file,file.relative_to(root))
checksum=hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix('.zip.sha256').write_text(checksum+'  '+target.name+'\n')
print('Installationsarchiv: '+str(target))
print('Enthaelt Quellcode, gebaute Oberflaeche und Installer; keine Konten, Daten, API-Schluessel, Modelle oder Laufzeitlogs.')
