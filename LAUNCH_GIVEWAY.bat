@echo off
title GiveWay ATES - Auto Launcher
echo 🚦 Starting GiveWay Advanced Traffic Equity System...
echo.

:: Kill any old node processes to free up ports
taskkill /f /im node.exe >nul 2>&1

echo 🔍 Searching for Arduino and starting Backend...
start /b cmd /c "npm start"

echo ⏳ Waiting for system to boot...
timeout /t 5 /nobreak >nul

echo 🌐 Opening GiveWay in Professional App Mode...
start chrome --app=http://localhost:4000

echo.
echo ✅ System is running! 
echo Keep this window open while using the hardware.
echo.
pause
