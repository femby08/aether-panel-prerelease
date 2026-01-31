@echo off
title Aether Panel - Iniciador
echo 🌌 Iniciando Aether Panel...

:: 1. Comprobar si existe la carpeta node_modules
if not exist node_modules (
    echo 📦 No se encontraron las librerias. Instalando dependencias...
    npm install
)

:: 2. Iniciar el servidor
echo 🚀 Arrancando server.js...
node server.js

:: 3. Mantener la ventana abierta si hay un error
pause