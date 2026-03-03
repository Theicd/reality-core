@echo off
setlocal
set "URL=http://localhost:3000"
set "ROOT=%~dp0"
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo [REALITY CORE] Backend is down, starting server...
  start "REALITY CORE SERVER" cmd /k node "%ROOT%server\index.js"
  timeout /t 4 /nobreak >nul
)
start "" "%URL%"
