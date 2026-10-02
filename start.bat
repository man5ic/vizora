@echo off
title Vizora Launcher
echo ========================================================
echo               Starting Vizora Application               
echo ========================================================
echo.

:: Set working directory to the folder containing this batch script
cd /d "%~dp0"

echo [1/3] Generating Prisma client...
call npx prisma generate

echo.
echo [2/3] Launching Next.js dev server in a new terminal window...
start "Vizora Dev Server" cmd /k "title Vizora Dev Server && npm run dev"

echo.
echo [3/3] Opening default browser at http://localhost:3000...
ping 127.0.0.1 -n 4 >nul
start http://localhost:3000

echo.
echo ========================================================
echo   Vizora is now running! 
echo   - Dev Server terminal window is open.
echo   - Browser opened to http://localhost:3000.
echo   - Run stop.bat anytime to terminate the server.
echo ========================================================
echo.
ping 127.0.0.1 -n 6 >nul
