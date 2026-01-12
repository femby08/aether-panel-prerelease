#!/bin/bash

# ============================================================
# AETHER PANEL - INTERACTIVE INSTALLER (V1.7.0)
# Repository: https://github.com/reychampi/aether-panel
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

APP_DIR="/opt/aetherpanel"
REPO_STABLE="https://raw.githubusercontent.com/femby08/aether-panel/main"
REPO_EXP="https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main"
SERVICE_USER="root"

# Helper Functions
print_banner() {
    clear
    echo -e "${CYAN}"
    echo "    _    _____ ____  _   _ _____ ____    "
    echo "   / \  | ____|_   _|| | | | ____|  _ \  "
    echo "  / _ \ |  _|   | |  | |_| |  _| | |_) | "
    echo " / ___ \| |___  | |  |  _  | |___|  _ <  "
    echo "/_/   \_\_____| |_|  |_| |_|_____|_| \_\ "
    echo -e "${NC}"
    echo -e "${CYAN}:: Aether Panel Manager V1.7.0 ::${NC}"
    echo "------------------------------------------------"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ Please run as root (sudo bash installserver.sh)${NC}"
        exit 1
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        echo -e "${RED}❌ OS not detected.${NC}"
        exit 1
    fi
}

install_dependencies() {
    echo -e "${YELLOW}📦 Installing system dependencies (Node.js, Java, Python)...${NC}"
    
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
            echo -e "${RED}⚠️  Manual installation required: nodejs, java, python3, git, unzip.${NC}"
            ;;
    esac
}

install_panel() {
    echo -e "${GREEN}🚀 Starting Installation...${NC}"
    
    echo -e "\n${CYAN}Select Version:${NC}"
    echo "1) Stable (Recommended)"
    echo "2) Experimental (New features, potentially unstable)"
    read -p "Your choice [1-2]: " v_choice
    
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
    # Download updater script from selected repo
    curl -sL "$SELECTED_REPO/updater.sh" -o "$APP_DIR/updater.sh"
    chmod +x "$APP_DIR/updater.sh"
    
    # Run Updater to get files
    # Note: The downloaded updater.sh might need to know which repo to pull from if it's generic.
    # Assuming updater.sh in the repo is configured for that repo.
    bash "$APP_DIR/updater.sh"
    
    # Fix Permissions
    chown -R $SERVICE_USER:$SERVICE_USER "$APP_DIR"
    
    # Setup Service
    echo -e "${CYAN}⚙️  Configuring Systemd Service...${NC}"
    NODE_PATH=$(which node)
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
    
    echo -e "${GREEN}✅ Installation Complete!${NC}"
    echo -e "🌍 Access your panel at: http://$(curl -s ifconfig.me):3000"
    pause
}

update_panel() {
    echo -e "${CYAN}🔄 Updating Aether Panel...${NC}"
    
    echo -e "\n${CYAN}Select Version to Update to:${NC}"
    echo "1) Stable"
    echo "2) Experimental"
    read -p "Your choice [1-2]: " v_choice
    
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
    read -p "Are you sure? (y/n): " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        systemctl stop aetherpanel
        systemctl disable aetherpanel
        rm /etc/systemd/system/aetherpanel.service
        systemctl daemon-reload
        rm -rf "$APP_DIR"
        echo -e "${GREEN}🗑️  Uninstalled successfully.${NC}"
    else
        echo "Cancelled."
    fi
    pause
}

pause() {
    read -p "Press [Enter] to continue..."
}

# Main Logic
check_root
detect_os

while true; do
    print_banner
    echo "1) Install Aether Panel"
    echo "2) Update Panel"
    echo "3) Uninstall Panel"
    echo "4) Exit"
    echo ""
    read -p "Select an option [1-4]: " choice
    
    case $choice in
        1) install_panel ;;
        2) update_panel ;;
        3) uninstall_panel ;;
        4) exit 0 ;;
        *) echo -e "${RED}Invalid option.${NC}"; sleep 1 ;;
    esac
done
