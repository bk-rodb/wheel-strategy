@echo off
setlocal EnableExtensions
REM One-shot bot cycle for Task Scheduler. Exits immediately outside the Mon/Tue ET window.
REM Usage: bot\run-once.cmd

cd /d "%~dp0"

if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"

if not exist "data" mkdir "data"
echo.>> "data\scheduler.log"
echo ===== %DATE% %TIME% =====>> "data\scheduler.log"

call npm run once >> "data\scheduler.log" 2>&1
exit /b %ERRORLEVEL%
