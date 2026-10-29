@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Package hotel -Mode production -Port 8001
if errorlevel 1 pause
