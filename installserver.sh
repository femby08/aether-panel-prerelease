#!/bin/bash

# ============================================================
# AETHER PANEL - INSTALADOR ROBUSTO
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
echo " [1] Estable      (Repositorio: aether-panel)"
echo " [2] Prerelease   (Repositorio: aether-panel-prerelease)"
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
        echo "❌ Opción inválida."
        exit 1
        ;;
esac

echo "============================================================"
echo "⏳ Preparando instalación..."
sleep 2

# 3. INSTALACIÓN DE DEPENDENCIAS
echo "📦 Instalando dependencias..."
apt-get update -qq
apt-get install -y -qq curl wget unzip git default-jre

if ! command -v node &> /dev/null; then
    echo "🟢 Instalando Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y -qq nodejs
fi

# 4. PREPARACIÓN DE DIRECTORIO Y CANAL
mkdir -p "$APP_DIR"

# --- CRUCIAL: GUARDAR LA ELECCIÓN DEL USUARIO ---
echo "$CHANNEL" > "$APP_DIR/.channel"
echo "🔒 Canal fijado en: $CHANNEL"
# -----------------------------------------------

# 5. DESCARGA DEL UPDATER
echo "⬇️  Descargando el instalador del canal: $CHANNEL..."
curl -H 'Cache-Control: no-cache' -s "$UPDATER_URL" -o "$APP_DIR/updater.sh"

if [ ! -s "$APP_DIR/updater.sh" ]; then
    echo "❌ Error crítico: No se pudo descargar el updater."
    exit 1
fi

chmod +x "$APP_DIR/updater.sh"

# 6. SERVICIO SYSTEMD
echo "⚙️  Configurando servicio..."
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

# 7. EJECUTAR INSTALACIÓN
echo "🚀 Ejecutando instalación de archivos..."
bash "$APP_DIR/updater.sh"

echo ""
echo "✅ Instalación completada."
