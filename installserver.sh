#!/bin/bash

# ============================================================
# AETHER PANEL - INSTALLER (Bootstrapper) - PRERELEASE
# Instala dependencias y delega la descarga al Updater
# ============================================================

APP_DIR="/opt/aetherpanel"
# CAMBIO APLICADO: Repositorio Prerelease
UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main/updater.sh"

# 1. VERIFICACIÓN DE ROOT
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, ejecuta este script como root (sudo)."
  exit 1
fi

echo "🌌 Iniciando instalación de Aether Panel (PRERELEASE)..."

# 2. INSTALACIÓN DE DEPENDENCIAS DEL SISTEMA
# Actualizamos repositorios e instalamos lo necesario: Java (para MC), Node, Git, Zip
echo "📦 Instalando dependencias..."
apt-get update -qq
apt-get install -y -qq curl wget unzip git default-jre

# Instalar Node.js si no existe (usamos la versión LTS)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y -qq nodejs
fi

# 3. PREPARACIÓN DE DIRECTORIO
mkdir -p "$APP_DIR"

# 4. DESCARGA DEL UPDATER
echo "⬇️ Descargando el sistema de actualizaciones (Experimental)..."
curl -H 'Cache-Control: no-cache' -s "$UPDATER_URL" -o "$APP_DIR/updater.sh"

# Verificación simple de descarga
if [ ! -s "$APP_DIR/updater.sh" ]; then
    echo "❌ Error: No se pudo descargar el updater desde el repositorio prerelease."
    exit 1
fi

chmod +x "$APP_DIR/updater.sh"

# 5. CREACIÓN DEL SERVICIO SYSTEMD (Para arranque automático)
echo "⚙️ Configurando servicio del sistema..."
cat > /etc/systemd/system/aetherpanel.service <<EOF
[Unit]
Description=Aether Panel Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aetherpanel

# 6. EJECUTAR EL UPDATER PARA LA PRIMERA INSTALACIÓN
echo "🚀 Ejecutando instalación inicial..."
bash "$APP_DIR/updater.sh"

echo "✅ Instalación completada. Puedes acceder a tu panel."
