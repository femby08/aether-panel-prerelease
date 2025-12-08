#!/bin/bash

# ============================================================
# AETHER PANEL - SMART UPDATER (Final Version)
# ============================================================

APP_DIR="/opt/aetherpanel"
LOG="/opt/aetherpanel/update.log"
BACKUP_DIR="/opt/aetherpanel_backup_temp"
TEMP_DIR="/tmp/aether_update_temp"

# 1. DETERMINAR CANAL (Lectura inteligente)
if [ -f "$APP_DIR/.channel" ]; then
    CHANNEL=$(cat "$APP_DIR/.channel" | tr -d '[:space:]')
else
    # Si no existe archivo de canal, intentamos detectar por argumento legado
    if [ "$1" == "-pre" ]; then
        CHANNEL="prerelease"
    else
        CHANNEL="stable"
    fi
    # Guardamos la preferencia para el futuro
    echo "$CHANNEL" > "$APP_DIR/.channel"
fi

# 2. SELECCIONAR REPOSITORIO
if [ "$CHANNEL" == "prerelease" ]; then
    REPO_ZIP="https://github.com/femby08/aether-panel-prerelease/archive/refs/heads/main.zip"
else
    REPO_ZIP="https://github.com/femby08/aether-panel/archive/refs/heads/main.zip"
fi

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG
    echo -e "$1"
}

log_msg "--- 🌌 INICIANDO ACTUALIZACIÓN (Canal: $CHANNEL) ---"

# 3. PREPARACIÓN
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Descargar
log_msg "⬇️ Descargando código fuente..."
wget -q "$REPO_ZIP" -O /tmp/aether_update.zip || curl -L "$REPO_ZIP" -o /tmp/aether_update.zip

if [ ! -s /tmp/aether_update.zip ]; then
    log_msg "❌ ERROR CRÍTICO: No se pudo descargar el archivo ZIP."
    exit 1
fi

unzip -q -o /tmp/aether_update.zip -d "$TEMP_DIR"

# Encontrar la carpeta raíz descomprimida (a veces github añade -main al nombre)
NEW_SOURCE=$(find "$TEMP_DIR" -name "package.json" | head -n 1 | xargs dirname)
if [ -z "$NEW_SOURCE" ]; then
    log_msg "❌ ERROR: El ZIP descargado no contiene un panel válido."
    exit 1
fi

# 4. BACKUP DE SEGURIDAD
log_msg "💾 Creando copia de seguridad..."
rm -rf "$BACKUP_DIR"
# Solo hacemos backup si existe el directorio
if [ -d "$APP_DIR" ]; then
    cp -r "$APP_DIR" "$BACKUP_DIR"
fi

# 5. INSTALACIÓN
log_msg "⚙️ Aplicando actualización..."
systemctl stop aetherpanel 2>/dev/null

# Asegurar directorio destino
mkdir -p "$APP_DIR"

# Copiar archivos (Sobrescribir)
cp -rf "$NEW_SOURCE/"* "$APP_DIR/"

# Restaurar archivo de canal (importante para no perder la config)
echo "$CHANNEL" > "$APP_DIR/.channel"

# Permisos y Dependencias
cd "$APP_DIR"
chmod +x updater.sh
log_msg "📦 Instalando dependencias NPM..."
npm install --production >> $LOG 2>&1

# 6. REINICIO Y VERIFICACIÓN
log_msg "🚀 Iniciando servicio..."
systemctl start aetherpanel
sleep 5

if systemctl is-active --quiet aetherpanel; then
    log_msg "✅ ACTUALIZACIÓN EXITOSA: Sistema operativo en v$(node -p "require('./package.json').version") ($CHANNEL)"
else
    log_msg "🚨 FALLO AL INICIAR. RESTAURANDO BACKUP..."
    systemctl stop aetherpanel
    if [ -d "$BACKUP_DIR" ]; then
        rm -rf "$APP_DIR"/*
        cp -r "$BACKUP_DIR/"* "$APP_DIR/"
        systemctl start aetherpanel
        log_msg "⏪ Sistema restaurado a la versión anterior."
    else
        log_msg "❌ No hay backup disponible para restaurar."
    fi
fi

# Limpieza
rm -rf "$TEMP_DIR" /tmp/aether_update.zip
