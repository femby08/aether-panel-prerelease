<div align="center">

<h1 align="center">
  <img src="https://raw.githubusercontent.com/reychampi/aether-panel/main/public/logo.png" alt="Logo" width="30" style="vertical-align: middle; margin-right: 10px;">
  Aether Panel
</h1>

**The lightweight, modern, and powerful control panel for Minecraft servers.**  
Smart management, real-time monitoring, and beautiful Glassmorphism design.

[![Version](https://img.shields.io/badge/version-1.8.0-rc-1--beta-orange?style=for-the-badge&logo=git)](https://github.com/femby08/aether-panel-prerelease)
[![Status](https://img.shields.io/badge/status-experimental-orange?style=for-the-badge)](https://github.com/femby08/aether-panel-prerelease)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

[Installation](#-quick-installation) • [Supported Systems](#-supported-operating-systems) • [Features](#-features)

</div>

---

## ✨ Description

**Aether Panel** is an all-in-one solution for managing Minecraft servers.  
It offers a modern **Glassmorphism** design, automatic installation, and advanced tools to manage your server without complications. Now with Multi-User support and Internationalization!

![Dashboard Preview](https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main/public/panel.png)

---

## 🐧 Supported Operating Systems

Aether Panel is **universal** and works on most modern systems.

| Family | Distributions / OS | Method | Status |
|--------|----------------------|--------|--------|
| **Debian** | Ubuntu 20.04+, Debian 10+, Mint | `apt` | ✅ Native |
| **RHEL** | Fedora 36+, CentOS 8+, Rocky | `dnf` | ✅ Native |
| **Arch** | Arch Linux, Manjaro | `pacman` | ✅ Native |
| **Windows** | Windows 10, 11, Server 2019+ | `.bat` | ✅ Native |

---

## 🚀 What's New in V1.7.0

### 👥 Multi-User System
- **Detailed User Management**: Create users with custom Roles (Admin/User).
- **Granular Permissions**: Control access to Start/Stop, Console, Files, Logs, and more using individual checkboxes.
- **Secure Access**: Restricted tabs and buttons are automatically hidden based on permissions.

### 🌍 Internationalization (i18n)
- **Multi-Language Support**: Fully translated into **English**, **Spanish**, and **Portuguese**.
- **Auto-Detection**: Defaults to English, easily switchable in settings.

### 🧪 Aether Labs (BETA)
- **Web Scheduler**: Schedule tasks like restarts or backups (UI Prototype).
- **Log Viewer**: View server history directly in the panel.
- **Improved Labs Interface**: Clearly marked Beta vs WIP features.

### 🎨 UI & Performance
- **Compact & Responsive**: Optimized Power Control layout.
- **Performance Boost**: Reduced blur effects for smoother rendering on all devices.
- **Beautiful Checkboxes**: Custom animated UI elements.

---

## 📦 Quick Installation

### 🐧 Linux (VPS / Dedicated)

Run as **root**:

<pre>
curl -sL https://raw.githubusercontent.com/femby08/aether-panel-prerelease/main/installserver.sh | bash
</pre>

---

### 🪟 Windows (PC / Server) — 🟡 Untested

1. Download the repository (`Code → Download ZIP`).  
2. Unzip the folder.  
3. Run:

<pre>
start_windows.bat
</pre>

The script will automatically install:

- Node.js  
- Java (Temurin)  

The panel will open automatically in your browser.

---

## ⚡ Features

- 🖥️ **Real-time Monitoring**: CPU, RAM, Disk usage stats.
- 💻 **Interactive Console**: Web-based terminal with color support.
- 👥 **Multi-User Access**: Secure permission system.
- 📂 **File Manager**: Edit server files directly in the browser.
- 📥 **Core Installer**: One-click install for Vanilla, Paper, Fabric, Forge.
- 📦 **Backups**: Create `.tar.gz` backups instantly.
- ⚙️ **Config Editor**: Visual editor for `server.properties`.
- 🔄 **Smart Updater**: OTA updates without reinstallation.

---

## 🛠️ Troubleshooting

### 🔹 The panel doesn't load in the browser

Ensure port **3000** is open.

**Linux (UFW):**
<pre>
sudo ufw allow 3000/tcp
</pre>

**Windows:**

Allow Node.js access in the Firewall when prompted.

---

### 🔹 Error: `command not found` or `$'\r'` (Linux)

Occurs if `.sh` files are in **CRLF** format (Windows line endings).

Solution:

<pre>
sed -i 's/\r$//' *.sh
</pre>

---

<div align="center">
Developed by <strong>Femby08</strong>  
Found a bug? Open an Issue.
</div>
