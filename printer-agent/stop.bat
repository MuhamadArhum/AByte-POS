@echo off
echo Stopping AByte Printer Agent...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo Killing PID %%a...
    taskkill /PID %%a /F >nul 2>&1
)

echo Done.
timeout /t 1 /nobreak >nul
