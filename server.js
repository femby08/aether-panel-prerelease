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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const upload = multer({ dest: os.tmpdir() });
const pipeline = promisify(stream.pipeline);

const IS_WIN = process.platform === 'win32';
const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const mcServer = new MCManager(io);
const apiClient = axios.create({ headers: { 'User-Agent': 'Aether-Panel/1.0.0' }, timeout: 10000 });
const REPO_RAW = 'https://raw.githubusercontent.com/femby08/aether-panel/main';

// ==========================================
// RUTAS API
// ==========================================

// 1. INFO (CORREGIDO: Solo muestra la versión del package.json)
app.get('/api/info', (req, res) => {
    try { 
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); 
        res.json({ version: pkg.version }); // Sin añadidos extra
    } catch (e) { res.json({ version: '1.0.0' }); }
});

// 2. MONITOR
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        let diskBytes = 0;
        if(!IS_WIN) {
            exec(`du -sb ${SERVER_DIR}`, (error, stdout) => {
                if (!error && stdout) diskBytes = parseInt(stdout.split(/\s+/)[0]);
                sendStats(cpuPercent, diskBytes, res);
            });
        } else {
            sendStats(cpuPercent, 0, res);
        }
    });
});

function sendStats(cpu, disk, res) {
    res.json({
        cpu: cpu * 100,
        ram_total: os.totalmem(),
        ram_used: os.totalmem() - os.freemem(),
        disk_used: disk,
        disk_total: 20 * 1024 * 1024 * 1024
    });
}

// 3. ESTADO Y CONTROL
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { mcServer.writeProperties(req.body); res.json({ success: true }); });
app.post('/api/power/:a', async (req, res) => { 
    try { if (mcServer[req.params.a]) await mcServer[req.params.a](); res.json({ success: true }); } 
    catch (e) { res.status(500).json({}); } 
});

// 4. UPDATES
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
    io.emit('toast', { type: 'success', msg: 'Actualización iniciada...' });
    setTimeout(() => res.json({ success: true, mode: type }), 1000);
});

// 5. FILES (Placeholder para evitar errores 404 en el log)
app.get('/api/files', (req, res) => res.json([]));

// SOCKETS
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

server.listen(3000, () => console.log('🚀 Aether Panel en puerto 3000'));
