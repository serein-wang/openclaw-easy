@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org
  exit /b 1
)
if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=0; $i -lt 40; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:4721/api/health'; if ($r.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:4721'; exit 0 } } catch {} ; Start-Sleep -Seconds 1 }; Start-Process 'http://127.0.0.1:4721'"
call npm run dev
exit /b %ERRORLEVEL%
