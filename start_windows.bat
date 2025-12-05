@echo off
setlocal enabledelayedexpansion
title Aether Panel - Windows Launcher
color 0b

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ejecuta como Administrador para instalar dependencias.
    pause
    exit
)

cls
echo ==========================================
echo        AETHER PANEL - WINDOWS
echo ==========================================
echo.

:: INSTALAR DEPENDENCIAS
node -v >nul 2>&1
if %errorlevel% neq 0 winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements

java -version >nul 2>&1
if %errorlevel% neq 0 winget install -e --id EclipseAdoptium.Temurin.21.JDK --accept-source-agreements

:: PREPARAR PANEL
if not exist "node_modules" call npm install --production
if not exist "public" mkdir public
if not exist "servers\default" mkdir servers\default

if not exist "public\logo.ico" (
    powershell -Command "Invoke-WebRequest https://raw.githubusercontent.com/reychampi/aether-panel/main/public/logo.svg -OutFile public\logo.svg"
    powershell -Command "Invoke-WebRequest https://raw.githubusercontent.com/reychampi/aether-panel/main/public/logo.ico -OutFile public\logo.ico"
)

:: OBTENER IP LOCAL
for /f "delims=" %%a in ('powershell -command "([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object {$_.AddressFamily -eq 'InterNetwork'})[0].IPAddressToString"') do set SERVER_IP=%%a

cls
echo [V] Servidor iniciado.
echo     Local: http://localhost:3000
echo     Red:   http://%SERVER_IP%:3000
echo.

node server.js
pause
