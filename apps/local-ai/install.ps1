param([string]$PythonPath='')
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if(-not(Test-Path -LiteralPath '.venv\Scripts\python.exe')){
  if(-not $PythonPath){
    $bundled=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if(Test-Path -LiteralPath $bundled){$PythonPath=$bundled}else{$PythonPath=(Get-Command python.exe).Source}
  }
  & $PythonPath -m venv .venv
  if($LASTEXITCODE -ne 0){throw 'Python-Umgebung konnte nicht erstellt werden.'}
}
$requirements=if(Test-Path -LiteralPath 'requirements.lock.txt'){'requirements.lock.txt'}else{'requirements.txt'}
& '.\.venv\Scripts\python.exe' -m pip install -r $requirements
if($LASTEXITCODE -ne 0){throw 'Python-Abhaengigkeiten konnten nicht installiert werden.'}
Push-Location frontend
try{
  if(Test-Path -LiteralPath 'package-lock.json'){& npm.cmd ci --no-fund --no-audit}else{& npm.cmd install --no-fund --no-audit}
  if($LASTEXITCODE -ne 0){throw 'Frontend-Abhaengigkeiten konnten nicht installiert werden.'}
  & npm.cmd run build
  if($LASTEXITCODE -ne 0){throw 'Frontend-Build fehlgeschlagen.'}
}finally{Pop-Location}
Write-Host 'WERKZ AI installiert. Start: .\start.ps1' -ForegroundColor Green
