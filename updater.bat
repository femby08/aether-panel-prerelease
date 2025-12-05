@echo off
title Aether Panel - Actualizador
color 0b
cls

set "REPO_ZIP=https://github.com/reychampi/aether-panel/archive/refs/heads/main.zip"
set "TEMP_DIR=%TEMP%\aether_update_%RANDOM%"
set "APP_DIR=%~dp0"

echo [1/4] Deteniendo panel...
taskkill /F /IM node.exe >nul 2>&1

echo [2/4] Descargando...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"
powershell -Command "Invoke-WebRequest '%REPO_ZIP%' -OutFile '%TEMP_DIR%\update.zip'"
powershell -Command "Expand-Archive -Path '%TEMP_DIR%\update.zip' -DestinationPath '%TEMP_DIR%' -Force"

for /d %%I in ("%TEMP_DIR%\aether-panel-*") do set "SOURCE_DIR=%%I"

echo [3/4] Aplicando cambios...
robocopy "%SOURCE_DIR%" "%APP_DIR%." /E /IS /IT /XF settings.json server.properties update.log /XD servers backups node_modules .git

echo [4/4] Actualizando librerias...
call npm install --production

echo [V] Listo. Reiniciando...
timeout /t 2 >nul
start "" "start_windows.bat"
rmdir /s /q "%TEMP_DIR%"
exit
