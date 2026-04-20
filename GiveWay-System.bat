@echo off
title GiveWay System Launcher
setlocal enabledelayedexpansion

:: --- GiveWay ATES Automation Suite ---
:: This script ensures the Node.js backend is active and launches the UI.

echo ============================================================
echo   G I V E W A Y : ADAPTIVE TRAFFIC EQUITY SYSTEM (v4.2)
echo ============================================================
echo [STATUS] Checking System Readiness...

:: 1. Check if Backend is already running on Port 4000
netstat -ano | findstr :4000 > nul
if %errorlevel% equ 0 (
    echo [✅] GiveWay Backend is already active.
) else (
    echo [🚀] Starting GiveWay Backend in Background...
    :: Run node server.js in a minimized window
    start "GiveWay Backend Server" /min cmd /c "node server.js"
    
    :: Wait for server to initialize
    echo [⏳] Waiting for Uplink Initialization...
    timeout /t 5 > nul
)

:: 2. Launch the Web Dashboard
:: We prefer the Vercel link as it ensures cloud-sync stability, 
:: but we also provide the local link as fallback.

echo [🌐] Launching Production Dashboard...
start https://give-way-app.vercel.app

echo [✨] GiveWay Operation Center is Ready.
echo [ℹ️] You can now sync your mobile app using the QR code on screen.
echo ============================================================
exit
