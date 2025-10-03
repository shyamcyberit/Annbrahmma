@echo off
REM This batch file starts the Canteen App backend and frontend in separate windows.

REM Define the base path to your project
SET "PROJECT_ROOT=D:\WebApps\Annbrahamma"

REM --- Start Backend ---
ECHO Starting backend server...
REM The 'start' command opens a new command prompt window.
REM 'cmd /k' keeps the new window open after the command executes.
start cmd /k "cd /d "%PROJECT_ROOT%\backend" && node index.js"

REM Optional: Add a small delay to give the backend time to start up
timeout /t 5 /nobreak >nul

REM --- Start Frontend ---
ECHO Starting frontend development server...
start cmd /k "cd /d "%PROJECT_ROOT%\frontend" && npm run dev"

ECHO Both backend and frontend started. Check the new command prompt windows.
ECHO You can close this window now, but keep the new windows open to run the app.