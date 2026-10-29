@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Package schrotties-demo -Port 8002
if errorlevel 1 pause
