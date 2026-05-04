@echo off
setlocal EnableDelayedExpansion
title AByte Printer Agent - Service Installer

echo.
echo  ============================================
echo   AByte Printer Agent - Service Installer
echo  ============================================
echo.

:: ── Check Admin ────────────────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Please run this script as Administrator.
    echo.
    echo  Right-click the file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

set "AGENT_DIR=%~dp0"
if "%AGENT_DIR:~-1%"=="\" set "AGENT_DIR=%AGENT_DIR:~0,-1%"
set "AGENT_JS=%AGENT_DIR%\agent.js"
set "SERVICE_NAME=ABytePrinterAgent"

echo  Agent folder : %AGENT_DIR%
echo.

:: ── Check Node.js ──────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found.
    echo.
    echo  Please install Node.js from: https://nodejs.org/
    echo  Then run this script again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node.js      : %NODE_VER%   [OK]

:: ── Install npm dependencies ───────────────────────────────
if not exist "%AGENT_DIR%\node_modules" (
    echo.
    echo  Installing dependencies (first time only)...
    pushd "%AGENT_DIR%"
    npm install --omit=dev
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    popd
    echo  Dependencies installed   [OK]
) else (
    echo  Dependencies             [Already installed]
)

:: ── Remove old task if exists ──────────────────────────────
schtasks /query /tn "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo  Removing old startup task...
    schtasks /delete /tn "%SERVICE_NAME%" /f >nul 2>&1
)

:: ── Create VBScript launcher (no console window popup) ────
set "LAUNCHER=%AGENT_DIR%\start-agent.vbs"
echo Set WShell = CreateObject("WScript.Shell") > "%LAUNCHER%"
echo WShell.Run "cmd /c node ""%AGENT_JS%"" >> ""%AGENT_DIR%\agent.log"" 2>&1", 0, False >> "%LAUNCHER%"

:: ── Register as startup task ───────────────────────────────
schtasks /create /tn "%SERVICE_NAME%" /tr "wscript.exe \"%LAUNCHER%\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
if %errorlevel% equ 0 (
    echo  Startup task created     [OK]
    echo  The agent will auto-start every time Windows logs in.
) else (
    echo  [WARNING] Could not create startup task.
    echo  You can still run start.bat manually.
)

:: ── Stop any existing agent ────────────────────────────────
echo.
echo  Stopping any running agent...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: ── Start agent now (hidden) ───────────────────────────────
echo  Starting agent...
pushd "%AGENT_DIR%"
start "ABytePrinterAgent" /min cmd /c "node agent.js >> agent.log 2>&1"
popd

:: ── Wait and verify ────────────────────────────────────────
timeout /t 3 /nobreak >nul

curl -s --max-time 4 http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo  Agent running on port 3001  [OK]
    echo.
    echo  Opening UI in browser...
    start http://localhost:3001
) else (
    echo.
    echo  [WARNING] Agent may still be starting.
    echo  Check agent.log if it does not respond.
    echo  Log: %AGENT_DIR%\agent.log
)

echo.
echo  ============================================
echo   Installation Complete!
echo.
echo   UI     : http://localhost:3001
echo   Config : %AGENT_DIR%\config.json
echo   Log    : %AGENT_DIR%\agent.log
echo  ============================================
echo.
pause
