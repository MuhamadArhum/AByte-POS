@echo off
:: AByte Printer Agent — Windows Service Installer
:: Run this as Administrator

echo ============================================
echo  AByte Printer Agent — Service Installer
echo ============================================
echo.

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Please run this script as Administrator.
    pause
    exit /b 1
)

set "AGENT_DIR=%~dp0"
set "AGENT_EXE=%AGENT_DIR%dist\ABytePrinterAgent.exe"
set "NODE_SCRIPT=%AGENT_DIR%agent.js"
set "SERVICE_NAME=ABytePrinterAgent"

:: Check if compiled exe exists, else use node
if exist "%AGENT_EXE%" (
    set "RUN_CMD=%AGENT_EXE%"
    echo Using compiled EXE: %AGENT_EXE%
) else (
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: Node.js not found and no compiled EXE.
        echo Either install Node.js or run: npm run build-exe
        pause
        exit /b 1
    )
    set "RUN_CMD=node \"%NODE_SCRIPT%\""
    echo Using Node.js: node %NODE_SCRIPT%
)

:: Remove existing service if present
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing existing service...
    sc stop "%SERVICE_NAME%" >nul 2>&1
    sc delete "%SERVICE_NAME%" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Create Windows Task (auto-start at login, no service manager needed)
echo Creating startup task...
schtasks /create /tn "%SERVICE_NAME%" /tr "%RUN_CMD%" /sc ONLOGON /rl HIGHEST /f >nul 2>&1

if %errorlevel% equ 0 (
    echo ✓ Startup task created — agent will start automatically at login.
) else (
    echo WARNING: Could not create startup task. You may need to start manually.
)

:: Start now
echo.
echo Starting agent now...
if exist "%AGENT_EXE%" (
    start "" "%AGENT_EXE%"
) else (
    start "" cmd /k "node \"%NODE_SCRIPT%\""
)

timeout /t 2 /nobreak >nul

:: Verify
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Agent is running on http://localhost:3001
) else (
    echo Agent started — check the console window for errors.
)

echo.
echo ============================================
echo  Setup complete!
echo  Config file: %APPDATA%\ABytePrinterAgent\config.json
echo  To change printer: edit config.json and restart
echo ============================================
pause
