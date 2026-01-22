#!/bin/bash

# ============================================================
# AETHER PANEL - INSTALADOR OFICIAL (GitHub: femby08)
# ============================================================

APP_DIR="/opt/aetherpanel"
# CORRECCIÓN: Apuntamos al repositorio correcto
UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel/main/updater.sh"
SERVICE_USER="root"

# 1. VERIFICACIÓN DE ROOT
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, ejecuta este script como root (sudo)."
  exit 1
fi

echo "🌌 Iniciando instalación de Aether Panel desde GitHub..."

# 2. DETECCIÓN DEL SISTEMA OPERATIVO
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ No se pudo detectar el sistema operativo."
    exit 1
fi

echo "🐧 Sistema detectado: $OS"

# 3. INSTALACIÓN DE DEPENDENCIAS
case $OS in
    ubuntu|debian|linuxmint)
        echo "📦 Instalando dependencias..."
        apt-get update -qq
        apt-get install -y -qq curl wget unzip git rsync default-jre
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
            apt-get install -y -qq nodejs
        fi
        ;;
    fedora|centos|rhel|almalinux|rocky)
        echo "📦 Instalando dependencias..."
        dnf install -y curl wget unzip git rsync java-latest-openjdk
        if ! command -v node &> /dev/null; then
            dnf install -y nodejs
        fi
        ;;
    arch|manjaro)
        pacman -Sy --noconfirm curl wget unzip git rsync jre-openjdk nodejs
        ;;
    *)
        echo "⚠️  Instala manualmente: nodejs, java, git, unzip, curl."
        ;;
esac

# 4. PREPARACIÓN DE DIRECTORIO
mkdir -p "$APP_DIR/public"
chown -R $SERVICE_USER:$SERVICE_USER "$APP_DIR"

# 5. DESCARGA DE ASSETS (Corregido a femby08)
echo "🎨 Descargando logos..."
curl -s -L "https://raw.githubusercontent.com/femby08/aether-panel/main/public/logo.svg" -o "$APP_DIR/public/logo.svg"
curl -s -L "https://raw.githubusercontent.com/femby08/aether-panel/main/public/logo.ico" -o "$APP_DIR/public/logo.ico"

# 6. DESCARGA DEL UPDATER Y EJECUCIÓN (Descarga el código del panel)
echo "⬇️  Descargando núcleo del panel desde GitHub..."
curl -H 'Cache-Control: no-cache' -s "$UPDATER_URL" -o "$APP_DIR/updater.sh"
chmod +x "$APP_DIR/updater.sh"

# Ejecutamos el updater para bajar los archivos js y html
bash "$APP_DIR/updater.sh"

# 7. CORRECCIÓN AUTOMÁTICA DEL ERROR "Cannot GET /"
# Como sabemos que el repo oficial tiene mal la ruta 'public', aplicamos el parche automáticamente aquí:
echo "🔧 Aplicando parche de ruta 'public'..."
sed -i "s/app.use(express.static(__dirname));/app.use(express.static(path.join(__dirname, 'public')));/" "$APP_DIR/server.js"

# 8. CONFIGURACIÓN DEL SERVICIO SYSTEMD
NODE_PATH=$(which node)
echo "⚙️  Creando servicio systemd..."
cat > /etc/systemd/system/aetherpanel.service <<EOF
[Unit]
Description=Aether Panel Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=$NODE_PATH server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aetherpanel
systemctl restart aetherpanel

echo "✅ Instalación completada."
echo "🌍 Accede a tu panel en: http://$(curl -s ifconfig.me):3000"
