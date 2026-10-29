param([switch]$NoBrowser)
& (Join-Path $PSScriptRoot '..\start.ps1') -Package hotel -Mode production -Port 8001 -NoBrowser:$NoBrowser
