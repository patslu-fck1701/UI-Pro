param([switch]$KeepModel,[ValidateRange(1024,65535)][int]$Port=8000)
. (Join-Path $PSScriptRoot 'scripts\common.ps1')
$python=Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$pidName=if($Port -eq 8000){'backend.pid'}else{"backend-$Port.pid"}
Stop-OwnedProcess (Join-Path $Runtime $pidName) $python 'backend.app:app'
if(-not $KeepModel){Stop-OwnedProcess (Join-Path $Runtime 'llama.pid') (Get-EngineExecutable) '--port 8080'}
Write-Host 'Von WERKZ AI gestartete Dienste beendet.' -ForegroundColor Green
