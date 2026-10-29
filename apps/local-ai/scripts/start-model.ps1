param([string]$ModelPath='',[switch]$SwitchModel)
. (Join-Path $PSScriptRoot 'common.ps1')
$modelMutex=Enter-WerkZMutex 'model-start'
try{
$llama=Get-EngineExecutable
if(-not $ModelPath){$ModelPath=Get-DefaultModel}
$ModelPath=(Resolve-Path -LiteralPath $ModelPath).Path
if([IO.Path]::GetExtension($ModelPath) -ne '.gguf'){throw 'Nur lokale GGUF-Dateien sind zulaessig.'}
$pidFile=Join-Path $Runtime 'llama.pid'
$keyFile=Join-Path $Runtime 'engine.key'
if($SwitchModel){Stop-OwnedProcess $pidFile $llama '--port 8080'}
$listener=Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if($listener){
  $owner=Get-CimInstance Win32_Process -Filter ("ProcessId="+$listener[0].OwningProcess)
  if($owner.ExecutablePath -ine $llama -or $owner.CommandLine -notlike '*--host 127.0.0.1*' -or $owner.CommandLine -notlike '*--port 8080*'){
    throw 'Port 8080 belongs to an unverified process. No process changed.'
  }
  try{$health=Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 3}catch{throw 'Port 8080 belegt, aber keine bereite llama.cpp-Engine gefunden.'}
  if($health.status -eq 'ok'){Write-Host 'Vorhandene lokale Engine wird verwendet.';return}
  throw 'Vorhandene lokale Engine ist noch nicht bereit.'
}
if(-not(Test-Path -LiteralPath $keyFile)){
  $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  [IO.File]::WriteAllText($keyFile,[Convert]::ToBase64String($bytes),(New-Object Text.UTF8Encoding($false)))
}
$python=Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$startedProcessId=& $python (Join-Path $ProjectRoot 'scripts\launch-local.py') model --executable $llama --model $ModelPath
if($LASTEXITCODE -ne 0){throw 'Local model launcher failed.'}
$process=Get-Process -Id ([int]$startedProcessId) -ErrorAction Stop
[IO.File]::WriteAllText($pidFile,[string]$startedProcessId)
for($i=0;$i -lt 90;$i++){
  if($process.HasExited){throw 'llama.cpp wurde beendet. Siehe .runtime\llama.stderr.log.'}
  try{$r=Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 2;if($r.status -eq 'ok'){Write-Host 'Lokales Modell bereit.' -ForegroundColor Green;return}}catch{ }
  Start-Sleep -Milliseconds 700
}
throw 'Modellstart noch nicht abgeschlossen. Logs pruefen.'
}finally{$modelMutex.ReleaseMutex();$modelMutex.Dispose()}
