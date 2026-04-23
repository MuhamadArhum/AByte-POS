@echo off
cd /d "%~dp0"

:: Kill any existing agent on port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo Stopping existing agent (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Check node_modules
if not exist "node_modules" (
    echo Installing dependencies...
    npm install --omit=dev
)

echo Starting AByte Printer Agent...
node agent.js
pause
