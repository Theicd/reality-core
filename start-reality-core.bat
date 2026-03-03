@echo off
setlocal
set "ROOT=%~dp0"
echo [REALITY CORE] Starting backend...
start "REALITY CORE SERVER" cmd /k node "%ROOT%server\index.js"
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"
echo [REALITY CORE] UI is opening on http://localhost:3000
