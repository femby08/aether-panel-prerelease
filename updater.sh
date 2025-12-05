#!/bin/bash

# ============================================================
# AETHER PANEL - ACTUALIZADOR (Live Mode)
# ============================================================

LOG="/opt/aetherpanel/update.log"
APP_DIR="/opt/aetherpanel"
REPO_ZIP="https://github.com/reychampi/aether-panel/archive/refs/heads/main.zip"

# Función para mensajes bonitos
msg() {
    echo -e "$1"
    echo "[$(date +'%T')] $1" >> $LOG
}

msg "--- 🔄 INICIANDO PROCESO DE ACTUALIZACIÓN ---"

# 1. Ir al directorio
cd "$APP_DIR" || { msg "❌ Error: Directorio no encontrado"; exit 1; }

# 2. Limpieza
rm -rf update.zip aether-panel-main

# 3. Descarga
msg "⬇️  Descargando la última versión desde GitHub..."
curl -sL "$REPO_ZIP" -o update.zip

# 4. Descompresión
msg "📦 Descomprimiendo archivos..."
unzip -q -o update.zip

# 5. Instalación
msg "♻️  Sobrescribiendo archivos del sistema..."
# Copia todo sobre lo existente
cp -rf aether-panel-main/* .

# 6. Limpieza de basura
rm -rf aether-panel-main update.zip

# 7. Permisos
chmod +x updater.sh installserver.sh

# 8. Dependencias
msg "📚 Comprobando librerías de Node.js..."
npm install --production > /dev/null 2>&1

# 9. Reinicio
msg "🚀 Reiniciando Aether Panel..."
systemctl restart aetherpanel

msg "✅ ¡ACTUALIZADO CORRECTAMENTE!"
msg "   Ya puedes recargar la página web."
