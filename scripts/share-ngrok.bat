@echo off
rem Starts Workforce Futures on this PC and shares it through ngrok.
rem Double-click to run. Add "noai" to turn off the WorkBuddy model:  share-ngrok.bat noai
setlocal
cd /d "%~dp0.."
set PORT=8001
if not defined NGROK set NGROK=ngrok

if /i "%~1"=="noai" (
  set LLM_ENABLED=0
  echo AI features are off for this run.
)

if not exist ".venv\Scripts\python.exe" (
  echo Python environment not found. Run these once in this folder:
  echo   python -m venv .venv
  echo   .venv\Scripts\python -m pip install -r requirements-app.txt
  pause
  exit /b 1
)
where %NGROK% >nul 2>nul || (
  echo ngrok was not found. Install it with:  winget install ngrok.ngrok
  pause
  exit /b 1
)

curl -s -f -o nul http://127.0.0.1:%PORT%/api/health && (
  echo The app is already running on port %PORT%.
  goto ready
)

echo Starting the app on port %PORT% in a new window. Keep that window open.
start "Workforce Futures app" cmd /k ".venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port %PORT%"

set /a tries=0
:wait
curl -s -f -o nul http://127.0.0.1:%PORT%/api/health && goto ready
set /a tries+=1
if %tries% geq 40 (
  echo The app did not start. Check the "Workforce Futures app" window for the error.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait

:ready
echo App is running at http://127.0.0.1:%PORT%
echo Starting ngrok. Share the https address it shows. Press Ctrl+C here to stop sharing.
%NGROK% http 127.0.0.1:%PORT%
