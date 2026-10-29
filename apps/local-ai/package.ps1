Set-Location $PSScriptRoot
& '.\.venv\Scripts\python.exe' scripts/build-package.py
if($LASTEXITCODE -ne 0){throw 'Paket konnte nicht erstellt werden.'}
