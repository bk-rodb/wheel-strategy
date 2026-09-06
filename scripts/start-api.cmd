@echo off
setlocal EnableExtensions
REM Start WheelStrategy.Api on :5099 if it is not already listening.
REM Run as the same Windows user who set ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY.
REM Usage: scripts\start-api.cmd   (from Task Scheduler "At logon", or double-click)

set "ROOT=%~dp0.."
set "API_DIR=%ROOT%\backend\WheelStrategy.Api"
set "LOG_DIR=%API_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

netstat -ano | findstr /R /C:":5099 .*LISTENING" >nul
if %ERRORLEVEL%==0 (
  echo [%DATE% %TIME%] API already listening on :5099
  exit /b 0
)

cd /d "%API_DIR%"
set "ASPNETCORE_ENVIRONMENT=Development"
echo [%DATE% %TIME%] Starting WheelStrategy.Api >> "%LOG_DIR%\api.log"
dotnet run --launch-profile http >> "%LOG_DIR%\api.log" 2>&1
exit /b %ERRORLEVEL%
