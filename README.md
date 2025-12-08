<div align="center">

<h1 align="center">
  <img src="https://raw.githubusercontent.com/reychampi/aether-panel/main/public/logo.png" alt="Logo" width="30" style="vertical-align: middle; margin-right: 10px;">
  Aether Panel
</h1>

**El panel de control ligero, moderno y potente para servidores de Minecraft.**  
Gestión inteligente, monitoreo en tiempo real y diseño Glassmorphism.

[![Version](https://img.shields.io/badge/version-1.6.0-8b5cf6?style=for-the-badge&logo=git)](https://github.com/reychampi/aether-panel)
[![Status](https://img.shields.io/badge/status-stable-10b981?style=for-the-badge)](https://github.com/reychampi/aether-panel)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
![Windows](https://img.shields.io/badge/Windows-Nativo%20(no%20testeado)-FFD600?style=for-the-badge&logo=windows)

[Instalación](#-instalación-rápida) • [Sistemas Compatibles](#-sistemas-operativos-soportados) • [Características](#-características)

</div>

---

## ✨ Descripción

**Aether Panel** es una solución todo-en-uno para administrar servidores de Minecraft.  
Ofrece un diseño moderno tipo **Glassmorphism**, instalación automática y herramientas avanzadas para gestionar tu servidor sin complicaciones.

![Dashboard Preview](https://raw.githubusercontent.com/reychampi/aether-panel/main/public/panel.png)

---

## 🐧 Sistemas Operativos Soportados

Aether Panel es **universal** y funciona en la mayoría de sistemas modernos.

| Familia | Distribuciones / SO | Método | Estado |
|--------|----------------------|--------|--------|
| **Debian** | Ubuntu 20.04+, Debian 10+, Mint | `apt` | ✅ Nativo |
| **RHEL** | Fedora 36+, CentOS 8+, Rocky | `dnf` | ✅ Nativo |
| **Arch** | Arch Linux, Manjaro | `pacman` | ✅ Nativo |
| **Windows** | Windows 10, 11, Server 2019+ | `.bat` | 🟡 Nativo (no testeado) |

---

## 🚀 Novedades V1.6.x

### 🎮 Experiencia de Usuario
- **Consola Interactiva** con envío de comandos en vivo.  
- **Sistema de Ayuda** con tooltips `(?)` explicativos.  
- **Atajos de Teclado** (`Alt + 1–8`, `ESC`).  
- **IP Copiable** desde la cabecera.  
- **Interfaz más rápida**, animaciones suaves y modo claro/oscuro mejorado.

### 🛠️ Mejoras Técnicas
- `start_windows.bat`: instalación automática de Node.js y Temurin (no testeado).  
- Instalador Linux universal con detección de distro.  
- Actualizador OTA de la UI sin reiniciar.  
- Instalador de núcleos optimizado (Vanilla, Paper, Forge, Fabric).  
- Descarga de versiones más estable.

---

## 📦 Instalación Rápida

---

### 🐧 Linux (VPS / Dedicado)

Ejecuta como **root**:

<pre>
curl -sL https://raw.githubusercontent.com/reychampi/aether-panel/refs/heads/main/installserver.sh | bash
</pre>

---

### 🪟 Windows (PC / Server) — 🟡 No testeado

1. Descarga el repositorio (`Code → Download ZIP`).  
2. Descomprime la carpeta.  
3. Ejecuta:

<pre>
start_windows.bat
</pre>

El script instalará automáticamente:

- Node.js  
- Java (Temurin)  

El panel se abrirá automáticamente en tu navegador.

---

## ⚡ Características

- 🖥️ Monitor en tiempo real (CPU, RAM, almacenamiento).  
- 💻 Consola web interactiva con colores.  
- 📂 Gestor de archivos con editor de código.  
- 📥 Instalador de núcleos (Vanilla, Paper, Fabric, Forge).  
- 📦 Backups `.tar.gz` con un clic.  
- 🧩 Tienda de Mods integrada.  
- ⚙️ Editor visual de `server.properties`.  
- 🔄 Smart Updater OTA sin reinstalar.

---

## 🛠️ Solución de Problemas Frecuentes

### 🔹 El panel no carga en el navegador

Asegúrate de abrir el puerto **3000**.

**Linux (UFW):**
<pre>
sudo ufw allow 3000/tcp
</pre>

**Windows:**

Permite el acceso a Node.js en el Firewall cuando Windows pregunte.

---

### 🔹 Error: `command not found` o `$'\r'` (Linux)

Ocurre si los `.sh` están en formato **CRLF**.

Solución:

<pre>
sed -i 's/\r$//' *.sh
</pre>

---

<div align="center">
Desarrollado por <strong>ReyChampi</strong>  
¿Encontraste un error? Abre un Issue.
</div>
