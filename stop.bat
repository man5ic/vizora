@echo off
title Vizora Stopper
echo ========================================================
echo               Stopping Vizora Application               
echo ========================================================
echo.

cd /d "%~dp0"

echo Searching for Vizora server running on port 3000...
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3000 .*LISTENING"') do (
    echo Stopping process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
    set "FOUND=1"
)

echo Closing Vizora terminal window...
taskkill /FI "WINDOWTITLE eq Vizora Dev Server*" /F >nul 2>&1

echo.
echo ========================================================
echo   Vizora application has been stopped.
echo ========================================================
echo.
pause
