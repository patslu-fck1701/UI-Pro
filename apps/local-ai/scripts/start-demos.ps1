param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$demoRoot=Split-Path -Parent $PSScriptRoot
foreach($demo in @(@('hotel',8001,'production'),@('handwerk-demo',8000,'demo'),@('schrotties-demo',8002,'demo'))){
  & (Join-Path $demoRoot 'start.ps1') -Package $demo[0] -Port $demo[1] -Mode $demo[2] -NoBrowser
}
if(-not $NoBrowser){Start-Process (Join-Path ([Environment]::GetFolderPath('Desktop')) 'WERKZ-DEMO-HEUTE\START-HIER.html')}
