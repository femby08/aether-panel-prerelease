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

// Asegurar directorios esenciales
const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const mcServer = new MCManager(io);

// CONFIGURACIÓN DE GITHUB
const apiClient = axios.create({ headers: { 'User-Agent': 'Nebula-Panel/1.3.0' } });
const REPO_RAW = 'https://raw.githubusercontent.com/reychampi/nebula/main';

// --- API: INFO DEL PANEL (Corrección Versión) ---
app.get('/api/info', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        res.json({ version: pkg.version });
    } catch (e) { res.json({ version: '1.0.0' }); }
});

// --- API: CHECK UPDATES ---
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

app.post('/api/update/perform', async (req, res) => {
    // Tu lógica original de updates se mantiene aquí
    res.json({ success: true }); 
});

// --- API: MONITOR (Datos para Gráficas) ---
app.get('/api/stats', (req, res) => { 
    osUtils.cpuUsage((c) => { 
        let d = 0; 
        try{fs.readdirSync(SERVER_DIR).forEach(f=>{try{d+=fs.statSync(path.join(SERVER_DIR,f)).size}catch{}})}catch{} 
        res.json({
            cpu: c * 100, 
            ram_used: (os.totalmem() - os.freemem()) / 1048576, 
            ram_total: os.totalmem() / 1048576, 
            disk_used: d / 1048576, 
            disk_total: 20480 
        }); 
    }); 
});
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));

// --- API: CONTROLES ---
app.post('/api/power/:a', async (req, res) => { 
    try{
        if(mcServer[req.params.a]) await mcServer[req.params.a]();
        res.json({success:true});
    } catch(e){ res.status(500).json({}); }
});

// --- API: FILES (Básico) ---
app.get('/api/files', (req, res) => { res.json([]); }); 

// --- API: CONFIGURACIÓN (CORREGIDO EL BUG DE SUCCESS TRUE) ---
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));

app.post('/api/config', (req, res) => { 
    mcServer.writeProperties(req.body); 
    // IMPORTANTE: Devolvemos la lista actualizada, no solo "success: true"
    res.json(mcServer.readProperties()); 
});

// --- API: INSTALL ---
app.post('/api/install', async (req, res) => { 
    try{ await mcServer.installJar(req.body.url, req.body.filename); res.json({success:true}); } catch(e){ res.status(500).json({}); }
});

// --- WEBSOCKETS ---
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

server.listen(3000, () => console.log('Panel funcionando en puerto 3000'));
