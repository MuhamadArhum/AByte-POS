@echo off
title AByte Printer Agent v2.1
cd /d "%~dp0"

:: Kill any existing agent on port 3001
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo Stopping existing agent (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

:: Install deps if missing
if not exist "node_modules" (
    echo Installing dependencies...
    npm install --omit=dev
)

echo.
echo  Starting AByte Printer Agent...
echo  UI: http://localhost:3001
echo  Press Ctrl+C to stop.
echo.

node agent.js
pause
