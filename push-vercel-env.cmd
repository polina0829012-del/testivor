@echo off
REM Обход блокировки npm.ps1 в PowerShell: только node, без npm.
cd /d "%~dp0"
node scripts\push-env-to-vercel.mjs
exit /b %ERRORLEVEL%
