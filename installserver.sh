#!/bin/bash

# ============================================================
# AETHER PANEL - INTERACTIVE INSTALLER (V1.7.1 - Fixed)
# Repository: https://github.com/reychampi/aether-panel
# Fixes: Windows line ending (CRLF) support, Input Sanitization
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="/opt/aetherpanel"
REPO_STABLE="https://raw.githubusercontent.com/femby08/aether-panel/main"
REPO_EXP="https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main"
SERVICE_USER="root"

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

# Function to sanitize input (removes Windows \r characters)
clean_input() {
    echo "$1" | tr -d '\r'
}

print_banner() {
    clear
    echo -e "${CYAN}"
    echo "    _    _____ ____  _   _ _____ ____    "
    echo "   / \  | ____|_   _|| | | | ____|  _ \  "
    echo "  / _ \ |  _|   | |  | |_| |  _| | |_) | "
    echo " / ___ \| |___  | |  |  _  | |___|  _ <  "
    echo "/_/   \_\_____| |_|  |_| |_|_____|_| \_\ "
    echo -e "${NC}"
    echo -e "${BLUE}:: Aether Panel Manager V1.7.1 (Patched) ::${NC}"
    echo "------------------------------------------------"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ Error: Please run as root (sudo bash installserver.sh)${NC}"
        exit 1
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo -e "${RED}❌ OS not detected. Continuing anyway...${NC}"
        OS="unknown"
    fi
}

pause() {
    echo ""
    read -p "Press [Enter] to continue..." dummy
}

# ============================================================
# CORE FUNCTIONS
# ============================================================

install_dependencies() {
    echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
    
    case $OS in
        ubuntu|debian|linuxmint)
            apt-get update -qq
            apt-get install -y -qq curl wget unzip git rsync default-jre python3 python3-pip
            if ! command -v node &> /dev/null; then
                echo -e "   - Installing Node.js LTS..."
                curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - > /dev/null
                apt-get install -y -qq nodejs
            fi
            ;;
        fedora|centos|rhel|almalinux|rocky)
            dnf install -y curl wget unzip git rsync java-latest-openjdk python3
            if ! command -v node &> /dev/null; then
                 dnf install -y nodejs
            fi
            ;;
        arch|manjaro)
             pacman -Sy --noconfirm curl wget unzip git rsync jre-openjdk nodejs python
            ;;
        *)
            echo -e "${RED}⚠️  Unknown OS ($OS). Manual installation required for: nodejs, java, python3, git, unzip.${NC}"
            sleep 2
            ;;
    esac
}

install_panel() {
    print_banner
    echo -e "${GREEN}🚀 Starting Installation...${NC}"
    
    echo -e "\n${CYAN}Select Version:${NC}"
    echo "1) Stable (Recommended)"
    echo "2) Experimental (New features, potentially unstable)"
    read -p "Your choice [1-2]: " raw_v_choice
    v_choice=$(clean_input "$raw_v_choice")
    
    if [ "$v_choice" == "2" ]; then
        SELECTED_REPO="$REPO_EXP"
        echo -e "${YELLOW}⚠️  Installing EXPERIMENTAL version...${NC}"
    else
        SELECTED_REPO="$REPO_STABLE"
        echo -e "${GREEN}✅ Installing STABLE version...${NC}"
    fi

    install_dependencies
    
    echo -e "${YELLOW}📂 Setting up directories...${NC}"
    mkdir -p "$APP_DIR/public"
    
    echo -e "${CYAN}⬇️  Downloading core files...${NC}"
    curl -sL "$SELECTED_REPO/updater.sh" -o "$APP_DIR/updater.sh"
    
    if [ ! -f "$APP_DIR/updater.sh" ]; then
         echo -e "${RED}❌ Failed to download updater.sh. Check your internet connection.${NC}"
         pause
         return
    fi
    
    chmod +x "$APP_DIR/updater.sh"
    
    # Run Updater
    bash "$APP_DIR/updater.sh"
    
    # Fix Permissions
    chown -R $SERVICE_USER:$SERVICE_USER "$APP_DIR"
    
    # Setup Service
    echo -e "${CYAN}⚙️  Configuring Systemd Service...${NC}"
    NODE_PATH=$(which node)
    
    if [ -z "$NODE_PATH" ]; then
        echo -e "${RED}❌ Node.js binary not found. Service creation failed.${NC}"
        pause
        return
    fi

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
    
    IP_ADDR=$(curl -s ifconfig.me || echo "YOUR_SERVER_IP")
    echo -e "${GREEN}✅ Installation Complete!${NC}"
    echo -e "🌍 Access your panel at: http://$IP_ADDR:3000"
    pause
}

update_panel() {
    echo -e "${CYAN}🔄 Updating Aether Panel...${NC}"
    
    echo -e "\n${CYAN}Select Version to Update to:${NC}"
    echo "1) Stable"
    echo "2) Experimental"
    read -p "Your choice [1-2]: " raw_v_choice
    v_choice=$(clean_input "$raw_v_choice")
    
    if [ "$v_choice" == "2" ]; then
        SELECTED_REPO="$REPO_EXP"
    else
        SELECTED_REPO="$REPO_STABLE"
    fi
    
    echo -e "${YELLOW}⬇️  Downloading updater from selected branch...${NC}"
    curl -sL "$SELECTED_REPO/updater.sh" -o "$APP_DIR/updater.sh"
    chmod +x "$APP_DIR/updater.sh"
    
    if [ -f "$APP_DIR/updater.sh" ]; then
        bash "$APP_DIR/updater.sh"
        systemctl restart aetherpanel
        echo -e "${GREEN}✅ Update Complete!${NC}"
    else
        echo -e "${RED}❌ Updater download failed.${NC}"
    fi
    pause
}

uninstall_panel() {
    echo -e "${RED}⚠️  WARNING: This will delete the panel and all data.${NC}"
    read -p "Are you sure? (y/n): " raw_confirm
    confirm=$(clean_input "$raw_confirm")
    
    # Enhanced Yes/No logic
    if [[ "$confirm" =~ ^[yY]([eE][sS])?$ ]]; then
        echo -e "${YELLOW}Stopping services...${NC}"
        systemctl stop aetherpanel
        systemctl disable aetherpanel
        rm -f /etc/systemd/system/aetherpanel.service
        systemctl daemon-reload
        
        echo -e "${YELLOW}Removing files...${NC}"
        rm -rf "$APP_DIR"
        
        echo -e "${GREEN}🗑️  Uninstalled successfully.${NC}"
    else
        echo "Cancelled."
    fi
    pause
}

# ============================================================
# MAIN LOGIC
# ============================================================

check_root
detect_os

while true; do
    print_banner
    echo "1) Install Aether Panel"
    echo "2) Update Panel"
    echo "3) Uninstall Panel"
    echo "4) Exit"
    echo ""
    read -p "Select an option [1-4]: " raw_choice
    
    # Sanitize the input to remove any hidden Windows characters
    choice=$(clean_input "$raw_choice")
    
    case $choice in
        1) install_panel ;;
        2) update_panel ;;
        3) uninstall_panel ;;
        4) echo -e "${CYAN}Goodbye!${NC}"; exit 0 ;;
        *) echo -e "${RED}Invalid option: '$choice'${NC}"; sleep 1 ;;
    esac
done
