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
const stream = require('stream');
const { promisify } = require('util');

// --- CONFIGURACIÓN PRE-RELEASE ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const upload = multer({ dest: os.tmpdir() });
const pipeline = promisify(stream.pipeline);

const IS_WIN = process.platform === 'win32';
const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Asegurar directorios
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const mcServer = new MCManager(io);

// Configuración de Repositorio (Ajustado para Pre-release)
const apiClient = axios.create({ headers: { 'User-Agent': 'Aether-Panel/PreRelease' }, timeout: 10000 });
// Si quieres usar tu propio repo de updates, cambia esto:
const REPO_RAW = 'https://raw.githubusercontent.com/femby08/aether-panel/main'; 

// ==========================================
// API ROUTES
// ==========================================

// 1. INFO
app.get('/api/info', (req, res) => {
    try { 
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); 
        res.json({ version: pkg.version + '-BETA' }); // Etiqueta Beta forzada
    } catch (e) { res.json({ version: 'Dev-Build' }); }
});

// 2. MONITOR DE RECURSOS (Lógica Estable)
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        let diskBytes = 0;
        // Intento de lectura real de disco
        if(!IS_WIN) {
            exec(`du -sb ${SERVER_DIR}`, (error, stdout) => {
                if (!error && stdout) diskBytes = parseInt(stdout.split(/\s+/)[0]);
                sendStats(cpuPercent, diskBytes, res);
            });
        } else {
            sendStats(cpuPercent, 0, res); // En Windows es lento calcular recursivamente
        }
    });
});

function sendStats(cpu, disk, res) {
    res.json({
        cpu: cpu * 100,
        ram_total: os.totalmem(),
        ram_used: os.totalmem() - os.freemem(),
        disk_used: disk,
        disk_total: 20 * 1024 * 1024 * 1024 // 20GB Límite visual
    });
}

// 3. ESTADO DEL SERVIDOR
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));

// 4. CONFIGURACIÓN
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { mcServer.writeProperties(req.body); res.json({ success: true }); });

// 5. UPDATES (Check Inteligente)
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

app.post('/api/update/perform', (req, res) => {
    const { type } = req.body;
    // Simulación segura para Pre-release (evita romper tu entorno de dev)
    if(type === 'soft') {
        io.emit('toast', { type: 'success', msg: 'Actualizando UI (Simulado)...' });
        setTimeout(() => res.json({ success: true, mode: 'soft' }), 1000);
    } else {
        res.json({ success: true, mode: 'hard' });
    }
});

// 6. POWER ACTIONS
app.post('/api/power/:a', async (req, res) => { 
    try { if (mcServer[req.params.a]) await mcServer[req.params.a](); res.json({ success: true }); } 
    catch (e) { res.status(500).json({}); } 
});

// 7. FILES (Gestor básico)
app.get('/api/files', (req, res) => { res.json([]); }); // Placeholder para evitar errores 404

// SOCKETS
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

server.listen(3000, () => console.log('🚀 Aether Panel (Pre-Release Core) en puerto 3000'));
