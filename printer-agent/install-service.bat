@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo  AByte Printer Agent - Service Installer
echo ============================================
echo.

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Please run this script as Administrator.
    pause
    exit /b 1
)

:: Get the folder where this bat file lives (no trailing backslash)
set "AGENT_DIR=%~dp0"
if "%AGENT_DIR:~-1%"=="\" set "AGENT_DIR=%AGENT_DIR:~0,-1%"

set "AGENT_JS=%AGENT_DIR%\agent.js"
set "AGENT_EXE=%AGENT_DIR%\dist\ABytePrinterAgent.exe"
set "SERVICE_NAME=ABytePrinterAgent"

echo Agent folder: %AGENT_DIR%
echo.

:: Decide what to run
if exist "%AGENT_EXE%" (
    set "RUN_TARGET=%AGENT_EXE%"
    set "USE_NODE=0"
    echo Using compiled EXE.
) else (
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: Node.js not found. Install Node.js from https://nodejs.org/
        pause
        exit /b 1
    )
    set "USE_NODE=1"
    echo Using Node.js.
)

:: Install npm deps if needed
if not exist "%AGENT_DIR%\node_modules" (
    echo Installing dependencies...
    pushd "%AGENT_DIR%"
    npm install --omit=dev
    popd
)

:: Remove old task if exists
schtasks /query /tn "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing old startup task...
    schtasks /delete /tn "%SERVICE_NAME%" /f >nul 2>&1
)

:: Create startup task
if "%USE_NODE%"=="1" (
    :: Write a small launcher VBScript to avoid console window popup
    set "LAUNCHER=%AGENT_DIR%\start-agent.vbs"
    echo Set WShell = CreateObject("WScript.Shell") > "!LAUNCHER!"
    echo WShell.Run "cmd /c node """ & "%AGENT_JS%" & """ > """ & "%AGENT_DIR%\agent.log" & """ 2>&1", 0, False >> "!LAUNCHER!"

    schtasks /create /tn "%SERVICE_NAME%" /tr "wscript.exe \"%AGENT_DIR%\start-agent.vbs\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
) else (
    schtasks /create /tn "%SERVICE_NAME%" /tr "\"%AGENT_EXE%\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
)

if %errorlevel% equ 0 (
    echo ✓ Startup task created.
) else (
    echo WARNING: Could not create startup task.
)

:: Kill any existing agent process
taskkill /f /im node.exe /fi "WINDOWTITLE eq ABytePrinterAgent" >nul 2>&1

:: Start agent now (hidden window)
echo.
echo Starting agent...

if "%USE_NODE%"=="1" (
    pushd "%AGENT_DIR%"
    start "ABytePrinterAgent" /min cmd /c "node agent.js > agent.log 2>&1"
    popd
) else (
    start "" "%AGENT_EXE%"
)

:: Wait and verify
timeout /t 3 /nobreak >nul

curl -s --max-time 3 http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Agent is running on http://localhost:3001
) else (
    echo Agent starting... check agent.log if it does not respond.
    echo Log file: %AGENT_DIR%\agent.log
)

echo.
echo ============================================
echo  Done!
echo  Config: %AGENT_DIR%\config.json
echo  Log:    %AGENT_DIR%\agent.log
echo ============================================
echo.
pause
