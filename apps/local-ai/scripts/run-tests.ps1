$ErrorActionPreference='Stop'
Set-Location (Join-Path $PSScriptRoot '..')
& '.\.venv\Scripts\python.exe' -m pytest -q
if($LASTEXITCODE -ne 0){throw 'Integrationstests fehlgeschlagen.'}
& npm.cmd --prefix frontend run build
if($LASTEXITCODE -ne 0){throw 'Frontend-Build fehlgeschlagen.'}
