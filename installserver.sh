#!/bin/bash

# ============================================================
# AETHER PANEL - INSTALLER
# ============================================================

APP_DIR="/opt/aetherpanel"

# Selección de canal por argumento (-pre) o por defecto
CHANNEL="stable"
UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel/main/updater.sh"

if [ "$1" == "-pre" ]; then
    CHANNEL="prerelease"
    UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main/updater.sh"
    echo "🧪 MODO SELECCIONADO: EXPERIMENTAL (PRERELEASE)"
else
    echo "🛡️ MODO SELECCIONADO: STABLE"
fi

# 1. VERIFICACIÓN ROOT
if [ "$EUID" -ne 0 ]; then
  echo "❌ Ejecuta como root (sudo)."
  exit 1
fi

echo "🌌 Instalando dependencias..."
apt-get update -qq
apt-get install -y -qq curl wget unzip git default-jre

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y -qq nodejs
fi

mkdir -p "$APP_DIR"

# 2. DESCARGAR UPDATER
echo "⬇️ Obteniendo instalador del canal: $CHANNEL..."
curl -H 'Cache-Control: no-cache' -s "$UPDATER_URL" -o "$APP_DIR/updater.sh"
chmod +x "$APP_DIR/updater.sh"

# 3. SERVICIO SYSTEMD
echo "⚙️ Creando servicio..."
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

# 4. INSTALACIÓN VÍA UPDATER
echo "🚀 Instalando archivos del panel..."
if [ "$CHANNEL" == "prerelease" ]; then
    bash "$APP_DIR/updater.sh" -pre
else
    bash "$APP_DIR/updater.sh" -stable
fi

echo "✅ Instalación completada."