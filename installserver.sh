#!/bin/bash

# ============================================================
# AETHER PANEL - UNIVERSAL INSTALLER (Multi-Distro)
# Soporte: Debian, Ubuntu, Fedora, CentOS, Arch Linux, Manjaro
# ============================================================

APP_DIR="/opt/aetherpanel"
UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel/main/updater.sh"
SERVICE_USER="root"

# 1. VERIFICACIÓN DE ROOT
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, ejecuta este script como root (sudo)."
  exit 1
fi

echo "🌌 Iniciando instalación de Aether Panel..."

# 2. DETECCIÓN DEL SISTEMA OPERATIVO
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ No se pudo detectar el sistema operativo."
    exit 1
fi

echo "🐧 Sistema detectado: $OS"

# 3. INSTALACIÓN DE DEPENDENCIAS SEGÚN DISTRO
case $OS in
    ubuntu|debian|linuxmint)
        echo "📦 Instalando dependencias para Debian/Ubuntu..."
        apt-get update -qq
        apt-get install -y -qq curl wget unzip git rsync default-jre
        
        if ! command -v node &> /dev/null; then
            echo "📦 Instalando Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
            apt-get install -y -qq nodejs
        fi
        ;;

    fedora|centos|rhel|almalinux|rocky)
        echo "📦 Instalando dependencias para RHEL/Fedora..."
        dnf install -y curl wget unzip git rsync java-latest-openjdk
        
        if ! command -v node &> /dev/null; then
            echo "📦 Instalando Node.js..."
            dnf install -y nodejs
        fi
        ;;

    arch|manjaro)
        echo "📦 Instalando dependencias para Arch Linux..."
        pacman -Sy --noconfirm curl wget unzip git rsync jre-openjdk nodejs
        ;;

    *)
        echo "⚠️  Tu distribución ($OS) no está soportada oficialmente."
        echo "    Instala manualmente: nodejs, java, git, unzip, curl, wget, rsync."
        read -p "    ¿Continuar? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
        ;;
esac

# 4. PREPARACIÓN DE DIRECTORIO
mkdir -p "$APP_DIR/public"
chown -R $SERVICE_USER:$SERVICE_USER "$APP_DIR"

# 5. DESCARGA DE ASSETS
echo "🎨 Descargando recursos gráficos..."
curl -s -L "https://raw.githubusercontent.com/reychampi/aether-panel/main/public/logo.svg" -o "$APP_DIR/public/logo.svg"
curl -s -L "https://raw.githubusercontent.com/reychampi/aether-panel/main/public/logo.ico" -o "$APP_DIR/public/logo.ico"

# 6. DESCARGA DEL UPDATER
echo "⬇️  Descargando sistema de actualizaciones..."
curl -H 'Cache-Control: no-cache' -s "$UPDATER_URL" -o "$APP_DIR/updater.sh"
chmod +x "$APP_DIR/updater.sh"
chown $SERVICE_USER:$SERVICE_USER "$APP_DIR/updater.sh"

# 7. CREACIÓN DEL SERVICIO SYSTEMD
NODE_PATH=$(which node)
echo "⚙️ Configurando servicio (Node en $NODE_PATH)..."
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

# 8. EJECUTAR INSTALACIÓN INICIAL
echo "🚀 Ejecutando instalación del núcleo..."
if [ "$SERVICE_USER" == "root" ]; then
    bash "$APP_DIR/updater.sh"
else
    su -c "bash $APP_DIR/updater.sh" $SERVICE_USER
fi

echo "✅ Instalación completada. Aether Panel está listo en el puerto 3000."
