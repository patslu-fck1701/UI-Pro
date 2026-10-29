param([Parameter(Mandatory=$true)][string]$Archive,[ValidateSet('handwerk-demo','personal','hotel','hotel-demo','schrotties-demo')][string]$Package='handwerk-demo',[ValidateSet('demo','production')][string]$Mode='demo')
Set-Location $PSScriptRoot
& '.\.venv\Scripts\python.exe' -m backend.backup restore $Archive --package $Package --mode $Mode
if($LASTEXITCODE -ne 0){throw 'Wiederherstellung fehlgeschlagen.'}
