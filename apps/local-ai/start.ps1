param([ValidateSet('handwerk-demo','personal','hotel','hotel-demo','schrotties-demo')][string]$Package='handwerk-demo',[ValidateSet('demo','production')][string]$Mode='demo',[string]$ModelPath='',[switch]$NoBrowser,[ValidateRange(1024,65535)][int]$Port=8000)
. (Join-Path $PSScriptRoot 'scripts\common.ps1')
$startMutex=Enter-WerkZMutex 'application-start'
try{
Set-Location $ProjectRoot
$baseUrl="http://127.0.0.1:$Port"
$pidName=if($Port -eq 8000){'backend.pid'}else{"backend-$Port.pid"}
if(-not(Test-Path -LiteralPath 'frontend\dist\index.html') -or -not(Test-Path -LiteralPath '.venv\Scripts\python.exe')){& (Join-Path $ProjectRoot 'install.ps1');if($LASTEXITCODE -ne 0){throw 'Installation fehlgeschlagen.'}}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){
  try{
    $running=Invoke-RestMethod "$baseUrl/api/health" -TimeoutSec 5
    if($running.name -eq 'WERKZ AI' -and $running.package -eq $Package -and $running.mode -eq $Mode -and $running.engine -eq 'ready' -and -not $ModelPath){
      Write-Host "WERKZ AI laeuft bereits: $baseUrl" -ForegroundColor Green
      if(-not $NoBrowser){Start-Process $baseUrl}
      return
    }
  }catch{Write-Verbose 'Bestehender Dienst konnte nicht als passende WERKZ-AI-Instanz bestaetigt werden.'}
  throw "Port $Port ist bereits belegt. Passenden Port stoppen oder anderen Port auswaehlen."
}
& (Join-Path $ProjectRoot 'scripts\start-model.ps1') -ModelPath $ModelPath
$env:WERKZ_AI_PACKAGE=$Package;$env:WERKZ_AI_MODE=$Mode
$python=(Resolve-Path -LiteralPath '.venv\Scripts\python.exe').Path
$startedProcessId=& $python (Join-Path $ProjectRoot 'scripts\launch-local.py') backend --port $Port
if($LASTEXITCODE -ne 0){throw 'Local backend launcher failed.'}
$process=Get-Process -Id ([int]$startedProcessId) -ErrorAction Stop
[IO.File]::WriteAllText((Join-Path $Runtime $pidName),[string]$startedProcessId)
Remove-Item Env:WERKZ_AI_PACKAGE,Env:WERKZ_AI_MODE -ErrorAction SilentlyContinue
for($i=0;$i -lt 30;$i++){
  if($process.HasExited){throw 'Backend wurde beendet. Siehe .runtime\backend.stderr.log.'}
  try{$r=Invoke-RestMethod "$baseUrl/api/health" -TimeoutSec 3;if($r.app -eq 'ok'){
    if($r.engine -ne 'ready'){throw 'Backend bereit, Modellzugriff jedoch fehlgeschlagen.'}
    Write-Host "WERKZ AI: $baseUrl" -ForegroundColor Green
    if(-not $NoBrowser){Start-Process $baseUrl}
    return
  }}catch{$lastError=$_.Exception.Message}
  Start-Sleep -Milliseconds 500
}
throw "Backend nicht bereit: $lastError"
}finally{$startMutex.ReleaseMutex();$startMutex.Dispose()}
