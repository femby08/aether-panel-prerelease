#!/bin/bash
echo "Aether Panel - Updater"
echo "======================"

REPO_ZIP="https://github.com/femby08/aether-panel/archive/refs/heads/main.zip"
TEMP_DIR="/tmp/aether_update_$RANDOM"
APP_DIR=$(pwd)

echo "[1/4] Stopping panel..."
# Kill the node process. This might need adjustment depending on how it's run (systemd, pm2, etc).
# For now, we assume it was started directly or we rely on the parent process killing itself before this runs fully?
# Actually, the server spawns this script. We can't kill the parent immediately if we are a child, 
# but if detached, we can. The server.js should exit itself.
# We will wait a bit to ensure it releases locks.
sleep 2

echo "[2/4] Downloading..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
curl -L "$REPO_ZIP" -o "$TEMP_DIR/update.zip"
unzip -o "$TEMP_DIR/update.zip" -d "$TEMP_DIR"

SOURCE_DIR=$(find "$TEMP_DIR" -maxdepth 1 -name "aether-panel-*" | head -n 1)

echo "[3/4] Applying changes..."
# Rsync is better for this than simple cp
rsync -av --exclude 'settings.json' --exclude 'server.properties' --exclude 'update.log' --exclude 'servers' --exclude 'backups' --exclude 'node_modules' --exclude '.git' "$SOURCE_DIR/" "$APP_DIR/"

echo "[4/4] Updating dependencies..."
npm install --production

echo "[V] Done. Restarting..."
rm -rf "$TEMP_DIR"
chmod +x start.sh
./start.sh
