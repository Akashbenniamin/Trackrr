@echo off
title FreelanceTracker - Dev Server
cd /d "%~dp0"

echo ===================================================
echo           FreelanceTracker - Test Launch
echo ===================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Installing project dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Vite dev server...
echo [INFO] Your browser will open automatically.
echo [INFO] Press Ctrl+C to stop.
echo.

call npm run dev -- --open

pause
