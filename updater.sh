#!/bin/bash

# ============================================================
# AETHER PANEL - SMART UPDATER (FAIL-SAFE EDITION)
# 1. Soft Update: Cambios en /public -> Hot Swap (Sin reinicio)
# 2. Hard Update: Cambio de versión -> Reinicio + Rollback si falla
# ============================================================

LOG="/opt/aetherpanel/update.log"
APP_DIR="/opt/aetherpanel"
BACKUP_DIR="/opt/aetherpanel_backup_temp"
TEMP_DIR="/tmp/nebula_update_temp"
# [CHANGE] Updated Repository URL
REPO_ZIP="https://github.com/femby08/aether-panel/archive/refs/heads/main.zip"

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG
    echo -e "$1"
}

log_msg "--- 🌌 UPDATE PROCESS STARTED ---"

# 1. PREPARACIÓN Y DESCARGA
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Descargar Repo
wget -q "$REPO_ZIP" -O /tmp/nebula_update.zip || curl -L "$REPO_ZIP" -o /tmp/nebula_update.zip
unzip -q -o /tmp/nebula_update.zip -d "$TEMP_DIR"

# Encontrar raíz (donde está package.json)
NEW_SOURCE=$(find "$TEMP_DIR" -name "package.json" | head -n 1 | xargs dirname)

if [ -z "$NEW_SOURCE" ]; then
    log_msg "❌ ERROR: ZIP corrupto o estructura inválida."
    exit 1
fi

# 2. COMPARACIÓN DE VERSION
if [ -f "$APP_DIR/package.json" ]; then
    CURRENT_VERSION=$(node -p "require('$APP_DIR/package.json').version")
else
    CURRENT_VERSION="0.0.0"
fi
NEW_VERSION=$(node -p "require('$NEW_SOURCE/package.json').version")

log_msg "🔎 Actual: $CURRENT_VERSION | Nueva: $NEW_VERSION"

# ============================================================
# LÓGICA DE ACTUALIZACIÓN
# ============================================================

# --- CASO A: SOFT UPDATE (Misma versión, cambios visuales) ---
if [ "$CURRENT_VERSION" == "$NEW_VERSION" ]; then
    log_msg "ℹ️ Versiones coinciden. Buscando cambios visuales (Soft Update)..."
    
    # Comparamos solo /public
    if diff -r -q "$APP_DIR/public" "$NEW_SOURCE/public" > /dev/null; then
        log_msg "✅ No hay cambios visuales. Todo al día."
    else
        log_msg "🎨 Cambios visuales detectados. Aplicando Hot-Swap..."
        cp -rf "$NEW_SOURCE/public/"* "$APP_DIR/public/"
        log_msg "✅ Interfaz actualizada sin reiniciar."
    fi

# --- CASO B: HARD UPDATE (Cambio de versión) ---
else
    log_msg "⚠️  NUEVA VERSIÓN DETECTADA. Iniciando actualización segura..."

    # 1. BACKUP DE SEGURIDAD
    log_msg "💾 Creando snapshot de seguridad..."
    rm -rf "$BACKUP_DIR"
    cp -r "$APP_DIR" "$BACKUP_DIR"

    # 2. APLICAR CAMBIOS
    systemctl stop aetherpanel
    
    # Copiar archivos (excluyendo datos de usuario si fuera necesario, aquí sobrescribimos core)
    cp -rf "$NEW_SOURCE/"* "$APP_DIR/"
    
    # Dependencias
    cd "$APP_DIR"
    npm install --production >> $LOG 2>&1
    chmod +x "$APP_DIR/updater.sh" # Asegurar que el updater siga siendo ejecutable

    # 3. TEST DE ARRANQUE (FAIL-SAFE)
    log_msg "🚀 Intentando arrancar nueva versión..."
    systemctl start aetherpanel
    
    # Esperamos 10 segundos para ver si crashea
    sleep 10
    
    if systemctl is-active --quiet aetherpanel; then
        log_msg "✅ ACTUALIZACIÓN EXITOSA: El sistema es estable en V$NEW_VERSION."
        # Opcional: Borrar backup
        # rm -rf "$BACKUP_DIR"
    else
        log_msg "🚨 FALLO CRÍTICO: El servicio no arrancó."
        log_msg "⏪ EJECUTANDO ROLLBACK AUTOMÁTICO..."
        
        systemctl stop aetherpanel
        # Restaurar backup
        rm -rf "$APP_DIR"/* # Limpiar instalación fallida
        cp -r "$BACKUP_DIR/"* "$APP_DIR/" # Restaurar la copia
        
        systemctl start aetherpanel
        log_msg "✅ ROLLBACK COMPLETADO: Se ha restaurado la versión $CURRENT_VERSION."
    fi
fi

# Limpieza temporal
rm -rf "$TEMP_DIR" /tmp/nebula_update.zip
