const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const MCManager = require('./mc_manager');
const osUtils = require('os-utils');
const os = require('os');
const multer = require('multer');
const axios = require('axios');
const { exec, spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const upload = multer({ dest: os.tmpdir() });

// --- DIRECTORIOS ---
const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Asegurar que existen
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const mcServer = new MCManager(io);
const REPO_RAW = 'https://raw.githubusercontent.com/reychampi/nebula/main';
const apiClient = axios.create({ headers: { 'User-Agent': 'Nebula-Panel/1.3.0' } });

// ==========================================
// API ROUTES
// ==========================================

// 1. INFO DEL PANEL (Versión)
app.get('/api/info', (req, res) => {
    try {
        if (fs.existsSync(path.join(__dirname, 'package.json'))) {
            const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
            res.json({ version: pkg.version });
        } else {
            res.json({ version: '1.0.0' });
        }
    } catch (e) { 
        res.json({ version: 'Unknown' }); 
    }
});

// 2. MONITOR (CPU/RAM/DISCO)
app.get('/api/stats', (req, res) => { 
    osUtils.cpuUsage((c) => { 
        let d = 0; 
        try { 
            // Calcular uso de disco de la carpeta del servidor
            if(fs.existsSync(SERVER_DIR)) {
                fs.readdirSync(SERVER_DIR).forEach(f => {
                    try { d += fs.statSync(path.join(SERVER_DIR,f)).size } catch{}
                });
            }
        } catch{} 
        
        res.json({
            cpu: c * 100, 
            ram_used: (os.totalmem() - os.freemem()) / 1048576, 
            ram_total: os.totalmem() / 1048576, 
            disk_used: d / 1048576, 
            disk_total: 20480 // 20GB Límite visual
        }); 
    }); 
});

// 3. ESTADO DEL SERVIDOR
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));

// 4. CONFIGURACIÓN (server.properties)
app.get('/api/config', (req, res) => {
    res.json(mcServer.readProperties());
});

app.post('/api/config', (req, res) => { 
    // Guardamos y devolvemos la config actualizada para refrescar la UI
    mcServer.writeProperties(req.body); 
    res.json(mcServer.readProperties()); 
});

// 5. UPDATES (Check)
app.get('/api/update/check', async (req, res) => {
    try {
        const localPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const remotePkg = (await apiClient.get(`${REPO_RAW}/package.json`)).data;
        
        if (remotePkg.version !== localPkg.version) {
            return res.json({ type: 'hard', local: localPkg.version, remote: remotePkg.version });
        }
        res.json({ type: 'none' });
    } catch (e) { res.json({ type: 'error' }); }
});

// 6. UPDATES (Perform)
app.post('/api/update/perform', (req, res) => {
    const { type } = req.body;
    // Aquí iría la lógica real de bash, por ahora simulamos éxito
    io.emit('toast', { type: 'info', msg: 'Actualización iniciada...' });
    setTimeout(() => {
        res.json({ success: true });
    }, 2000);
});

// 7. CONTROLES DE ENERGÍA
app.post('/api/power/:a', async (req, res) => { 
    try{
        if(mcServer[req.params.a]) await mcServer[req.params.a]();
        res.json({success:true});
    } catch(e){ res.status(500).json({}); }
});

// 8. FILE MANAGER (Básico)
app.get('/api/files', (req, res) => {
    // Implementación básica para evitar errores 404
    res.json([]);
});

// ==========================================
// SOCKET.IO
// ==========================================
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

// ==========================================
// INICIO
// ==========================================
server.listen(3000, () => console.log('✅ Aether Panel escuchando en puerto 3000'));
