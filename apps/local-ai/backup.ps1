param([string]$Archive='',[ValidateSet('handwerk-demo','personal','hotel','hotel-demo','schrotties-demo')][string]$Package='handwerk-demo',[ValidateSet('demo','production')][string]$Mode='demo')
Set-Location $PSScriptRoot
if(-not $Archive){$Archive=Join-Path $PSScriptRoot ('data\backups\'+$Package+'-'+$Mode+'-'+(Get-Date -Format yyyyMMddHHmmssfff)+'.wzb')}
& '.\.venv\Scripts\python.exe' -m backend.backup create $Archive --package $Package --mode $Mode
if($LASTEXITCODE -ne 0){throw 'Backup fehlgeschlagen.'}
