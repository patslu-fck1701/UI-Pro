$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
& '.\stop.ps1' -KeepModel
& '.\install.ps1'
if($LASTEXITCODE -ne 0){throw 'Update-Pruefung fehlgeschlagen.'}
& '.\.venv\Scripts\python.exe' -m pytest -q
if($LASTEXITCODE -ne 0){throw 'Tests fehlgeschlagen. Bitte vor erneutem Start pruefen.'}
Write-Host 'Abhaengigkeiten, Build und Tests aktualisiert. start.ps1 zum gewuenschten Paket ausfuehren.' -ForegroundColor Green
