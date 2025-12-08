#!/bin/bash

# ============================================================
# AETHER PANEL - SMART UPDATER
# Lee el archivo .channel para saber qué descargar
# ============================================================

APP_DIR="/opt/aetherpanel"
LOG="/opt/aetherpanel/update.log"
BACKUP_DIR="/opt/aetherpanel_backup_temp"
TEMP_DIR="/tmp/aether_update_temp"

# 1. DETERMINAR CANAL
# Si existe el archivo .channel, úsalo. Si no, asume stable.
if [ -f "$APP_DIR/.channel" ]; then
    CHANNEL=$(cat "$APP_DIR/.channel" | tr -d '[:space:]')
else
    CHANNEL="stable"
    echo "stable" > "$APP_DIR/.channel"
fi

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

log_msg "--- 🌌 INICIANDO ACTUALIZACIÓN (Canal: $CHANNEL) ---"

# 2. PREPARACIÓN
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Descargar
log_msg "⬇️ Descargando ZIP desde GitHub ($CHANNEL)..."
wget -q "$REPO_ZIP" -O /tmp/aether_update.zip || curl -L "$REPO_ZIP" -o /tmp/aether_update.zip

if [ ! -s /tmp/aether_update.zip ]; then
    log_msg "❌ ERROR: El archivo ZIP está vacío o no se descargó."
    exit 1
fi

unzip -q -o /tmp/aether_update.zip -d "$TEMP_DIR"

# Encontrar carpeta raíz (ignora el nombre de la carpeta del zip)
NEW_SOURCE=$(find "$TEMP_DIR" -name "package.json" | head -n 1 | xargs dirname)
if [ -z "$NEW_SOURCE" ]; then
    log_msg "❌ ERROR: ZIP inválido (no se encontró package.json)."
    exit 1
fi

# 3. BACKUP
log_msg "💾 Creando backup..."
rm -rf "$BACKUP_DIR"
cp -r "$APP_DIR" "$BACKUP_DIR"

# 4. INSTALACIÓN
systemctl stop aetherpanel

# Copiar archivos (Sobrescribir todo)
cp -rf "$NEW_SOURCE/"* "$APP_DIR/"

# Restaurar el archivo .channel (por si el zip lo borra)
echo "$CHANNEL" > "$APP_DIR/.channel"

# Reinstalar dependencias
cd "$APP_DIR"
npm install --production >> $LOG 2>&1
chmod +x "$APP_DIR/updater.sh"

# 5. FINALIZACIÓN
log_msg "🚀 Reiniciando servicio..."
systemctl start aetherpanel
sleep 5

if systemctl is-active --quiet aetherpanel; then
    log_msg "✅ ACTUALIZADO CORRECTAMENTE A LA VERSIÓN DE: $CHANNEL"
else
    log_msg "🚨 FALLO AL INICIAR. RESTAURANDO BACKUP..."
    systemctl stop aetherpanel
    rm -rf "$APP_DIR"/*
    cp -r "$BACKUP_DIR/"* "$APP_DIR/"
    systemctl start aetherpanel
    log_msg "⏪ SISTEMA RESTAURADO."
fi

rm -rf "$TEMP_DIR" /tmp/aether_update.zip
