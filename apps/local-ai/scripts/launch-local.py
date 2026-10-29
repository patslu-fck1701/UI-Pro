"""Detach only the two existing local services, closing inherited caller pipe handles."""
import argparse,os,subprocess,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def command(kind,port=8000,executable='',model=''):
    if kind=='backend':
        if not 1024<=port<=65535:raise ValueError('Invalid backend port')
        return [str(ROOT/'.venv/Scripts/python.exe'),'-m','uvicorn','backend.app:app','--host','127.0.0.1','--port',str(port),'--no-access-log']
    binary=Path(executable).resolve();gguf=Path(model).resolve()
    if binary.name.lower()!='llama-server.exe' or not binary.is_file() or gguf.suffix.lower()!='.gguf' or not gguf.is_file():raise ValueError('Existing local llama executable and GGUF required')
    return [str(binary),'-m',str(gguf),'-c','4096','-ngl','0','--host','127.0.0.1','--port','8080','--threads','4','--parallel','1','--reasoning-budget','0','--no-webui','--api-key-file',str(ROOT/'.runtime/engine.key')]


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('kind',choices=['backend','model']);parser.add_argument('--port',type=int,default=8000);parser.add_argument('--executable',default='');parser.add_argument('--model',default='');args=parser.parse_args()
    if os.name!='nt':raise SystemExit('Windows launcher only')
    runtime=ROOT/'.runtime';runtime.mkdir(exist_ok=True)
    label=f'backend-{args.port}' if args.kind=='backend' else 'llama'
    with (runtime/(label+'.stdout.log')).open('w',encoding='utf-8') as out,(runtime/(label+'.stderr.log')).open('w',encoding='utf-8') as err:
        process=subprocess.Popen(command(args.kind,args.port,args.executable,args.model),cwd=ROOT,stdin=subprocess.DEVNULL,stdout=out,stderr=err,close_fds=True,creationflags=subprocess.CREATE_NO_WINDOW)
    print(process.pid)
