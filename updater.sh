#!/bin/bash

# ============================================================
# AETHER PANEL - MULTI-CHANNEL UPDATER
# Uso: ./updater.sh -pre (Experimental) | ./updater.sh -stable (Normal)
# ============================================================

CHANNEL="stable"
if [ "$1" == "-pre" ]; then
    CHANNEL="prerelease"
fi

LOG="/opt/aetherpanel/update.log"
APP_DIR="/opt/aetherpanel"
BACKUP_DIR="/opt/aetherpanel_backup_temp"
TEMP_DIR="/tmp/aether_update_temp"

# DEFINICIÓN DE REPOSITORIOS
REPO_STABLE="https://github.com/femby08/aether-panel/archive/refs/heads/main.zip"
REPO_PRE="https://github.com/femby08/aether-panel-prerelease/archive/refs/heads/main.zip"

if [ "$CHANNEL" == "prerelease" ]; then
    REPO_ZIP="$REPO_PRE"
else
    REPO_ZIP="$REPO_STABLE"
fi

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG
    echo -e "$1"
}

log_msg "--- 🌌 UPDATE STARTED (Channel: $CHANNEL) ---"

# 1. PREPARACIÓN
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Descargar
log_msg "⬇️ Descargando desde: $CHANNEL..."
wget -q "$REPO_ZIP" -O /tmp/aether_update.zip || curl -L "$REPO_ZIP" -o /tmp/aether_update.zip
unzip -q -o /tmp/aether_update.zip -d "$TEMP_DIR"

# Encontrar raíz
NEW_SOURCE=$(find "$TEMP_DIR" -name "package.json" | head -n 1 | xargs dirname)
if [ -z "$NEW_SOURCE" ]; then
    log_msg "❌ ERROR: ZIP corrupto."
    exit 1
fi

# 2. BACKUP
log_msg "💾 Creando backup de seguridad..."
rm -rf "$BACKUP_DIR"
cp -r "$APP_DIR" "$BACKUP_DIR"

# 3. INSTALACIÓN
systemctl stop aetherpanel

# Copiar archivos
cp -rf "$NEW_SOURCE/"* "$APP_DIR/"

# Reinstalar dependencias (por si cambiaron en prerelease)
cd "$APP_DIR"
npm install --production >> $LOG 2>&1
chmod +x "$APP_DIR/updater.sh"

# 4. VERIFICACIÓN
log_msg "🚀 Reiniciando servicio..."
systemctl start aetherpanel
sleep 10

if systemctl is-active --quiet aetherpanel; then
    log_msg "✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE."
    # rm -rf "$BACKUP_DIR" # Descomentar para borrar backup si es exitoso
else
    log_msg "🚨 FALLO AL INICIAR. RESTAURANDO..."
    systemctl stop aetherpanel
    rm -rf "$APP_DIR"/*
    cp -r "$BACKUP_DIR/"* "$APP_DIR/"
    systemctl start aetherpanel
    log_msg "⏪ SISTEMA RESTAURADO A VERSIÓN ANTERIOR."
fi

rm -rf "$TEMP_DIR" /tmp/aether_update.zip