"""Offline Windows speech: no cloud service and no implicit microphone access."""
import asyncio,io,json,os,subprocess,tempfile,wave
from pathlib import Path
from fastapi import APIRouter,Depends,HTTPException,UploadFile,File,Response
from pydantic import BaseModel,Field
from .db import ROOT
from .modules.registry import guard

router=APIRouter(prefix='/api/voice',tags=['local_speech'])
lock=asyncio.Lock()
def run(action,input_file='',output_file=''):
    if os.name!='nt':raise RuntimeError('Windows-Sprachdienst ist auf diesem System nicht verfügbar.')
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'scripts/local-speech.ps1'),'-Action',action,'-InputFile',str(input_file),'-OutputFile',str(output_file)],stdin=subprocess.DEVNULL,capture_output=True,timeout=90,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if result.returncode:raise RuntimeError('Lokaler deutscher Windows-Sprachdienst konnte die Aufgabe nicht verarbeiten.')
    return result.stdout.decode('utf-8-sig',errors='replace').strip()
class SpeechText(BaseModel):
    text:str=Field(min_length=1,max_length=3000)
@router.get('/status')
async def status(user=Depends(guard('voice_ai'))):
    try:return {**json.loads(await asyncio.to_thread(run,'status')),'engine':'Windows System.Speech','prototype':True}
    except Exception:return {'engine':'Windows System.Speech','recognizers':[],'voices':[],'localOnly':True,'prototype':True,'available':False}
@router.post('/synthesize')
async def synthesize(input:SpeechText,user=Depends(guard('voice_ai'))):
    if lock.locked():raise HTTPException(409,'Sprachdienst ist beschäftigt.')
    async with lock:
        try:
            with tempfile.TemporaryDirectory(prefix='werkz-speech-') as folder:
                source=Path(folder)/'text.txt';target=Path(folder)/'speech.wav';source.write_text(input.text,encoding='utf-8')
                await asyncio.to_thread(run,'synthesize',source,target)
                return Response(target.read_bytes(),media_type='audio/wav')
        except Exception:raise HTTPException(503,'Lokale Sprachausgabe nicht verfügbar. Deutsche Windows-Stimme prüfen.')
@router.post('/transcribe')
async def transcribe(file:UploadFile=File(...),user=Depends(guard('voice_ai'))):
    raw=await file.read(10*1024*1024+1)
    if len(raw)>10*1024*1024:raise HTTPException(413,'Aufnahme ist zu groß.')
    try:
        with wave.open(io.BytesIO(raw),'rb') as wav:
            if wav.getnchannels()!=1 or wav.getsampwidth()!=2 or not 8000<=wav.getframerate()<=48000 or wav.getnframes()/wav.getframerate()>60:raise ValueError()
    except Exception:raise HTTPException(400,'PCM-WAV mono, 16 Bit, 8–48 kHz und höchstens 60 Sekunden erforderlich.')
    if lock.locked():raise HTTPException(409,'Sprachdienst ist beschäftigt.')
    async with lock:
        try:
            with tempfile.TemporaryDirectory(prefix='werkz-speech-') as folder:
                source=Path(folder)/'input.wav';target=Path(folder)/'text.txt';source.write_bytes(raw)
                await asyncio.to_thread(run,'transcribe',source,target);text=target.read_text(encoding='utf-8-sig').strip()
                return {'text':text,'reviewRequired':True,'localOnly':True,'engine':'Windows System.Speech'}
        except Exception:raise HTTPException(503,'Lokale Erkennung nicht abgeschlossen. Aufnahme oder deutschen Windows-Sprachdienst prüfen.')
