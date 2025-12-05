#!/bin/bash

# ============================================================
# AETHER PANEL - INSTALLER (Menu Interactivo)
# ============================================================

APP_DIR="/opt/aetherpanel"

# 1. VERIFICACIÓN DE ROOT
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, ejecuta este script como root (sudo)."
  exit 1
fi

# 2. MENÚ DE SELECCIÓN DE CANAL
clear
echo "============================================================"
echo "           🌌 AETHER PANEL - INSTALADOR"
echo "============================================================"
echo " Selecciona la versión que deseas instalar:"
echo ""
echo " [1] Estable      (Recomendado para producción)"
echo " [2] Prerelease   (Experimental / Pruebas)"
echo ""
echo "============================================================"
read -p ">> Elige una opción [1 o 2]: " CHOICE

case $CHOICE in
    1)
        CHANNEL="stable"
        UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel/main/updater.sh"
        echo ""
        echo "🛡️  Has seleccionado: RAMA ESTABLE"
        ;;
    2)
        CHANNEL="prerelease"
        UPDATER_URL="https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main/updater.sh"
        echo ""
        echo "🧪 Has seleccionado: RAMA EXPERIMENTAL (PRERELEASE)"
        ;;
    *)
        echo ""
        echo "❌ Opción inválida. Por favor reinicia el instalador y elige 1 o 2."
        exit 1
        ;;
esac

echo "============================================================"
echo "⏳ Preparando instalación en 3 segundos..."
sleep 3

# 3. INSTALACIÓN DE DEPENDENCIAS
echo "📦 Instalando dependencias del sistema..."
apt-get update -qq
apt-get install -y -qq curl wget unzip git default-jre

# Instalar Node.js si no existe
if ! command -v node &> /dev/null; then
    echo "🟢 Instalando Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y -qq nodejs
fi

# 4. PREPARACIÓN DE DIRECTORIO
mkdir -p "$APP_DIR"

# 5. DESCARGA DEL UPDATER CORRECTO
echo "⬇️  Descargando el instalador del canal: $CHANNEL..."
curl -H 'Cache-Control: no-cache' -s "$UPDATER_URL" -o "$APP_DIR/updater.sh"

# Verificamos si se descargó bien
if [ ! -s "$APP_DIR/updater.sh" ]; then
    echo "❌ Error crítico: No se pudo descargar el updater desde GitHub."
    echo "   Verifica tu conexión a internet o la URL del repositorio."
    exit 1
fi

chmod +x "$APP_DIR/updater.sh"

# 6. CREACIÓN DEL SERVICIO SYSTEMD
echo "⚙️  Configurando servicio del sistema (Systemd)..."
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

# 7. EJECUTAR EL UPDATER CON LA BANDERA CORRESPONDIENTE
echo "🚀 Ejecutando instalación de archivos..."
if [ "$CHANNEL" == "prerelease" ]; then
    bash "$APP_DIR/updater.sh" -pre
else
    bash "$APP_DIR/updater.sh" -stable
fi

echo ""
echo "✅ Instalación completada. El servicio debería estar corriendo."