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
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const upload = multer({ dest: os.tmpdir() });

const SERVER_DIR = path.join(__dirname, 'servers', 'default');
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });

// === AUTO-GENERADOR DE LOGOS (Solución "No hay logos") ===
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

const logoPath = path.join(publicDir, 'logo.svg');
if (!fs.existsSync(logoPath)) {
    console.log("🎨 Generando logo por defecto...");
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#8b5cf6" d="M256 0c141.4 0 256 114.6 256 256S397.4 512 256 512 0 397.4 0 256 114.6 0 256 0zM366.3 189.6l-128-75.1c-11.2-6.5-23.9 4.6-19.4 16.9l27.2 75.7-69.6-6.1c-28.3-2.5-39.2 37.2-13.8 52.1l128 75.1c11.2 6.5 23.9-4.6 19.4-16.9l-27.2-75.7 69.6 6.1c28.3 2.5 39.2-37.2 13.8-52.1z"/></svg>`;
    fs.writeFileSync(logoPath, svgContent);
}

app.use(express.static(publicDir));
app.use(express.json());

const mcServer = new MCManager(io);
const REPO_RAW = 'https://raw.githubusercontent.com/femby08/aether-panel/main';
const apiClient = axios.create({ headers: { 'User-Agent': 'Aether/1.0' } });

// --- API: INFO ---
app.get('/api/info', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        res.json({ version: pkg.version });
    } catch (e) { res.json({ version: '1.0.0' }); }
});

// --- API: MONITOR ---
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((c) => {
        let d = 0;
        try { if(fs.existsSync(SERVER_DIR)) fs.readdirSync(SERVER_DIR).forEach(f=>{try{d+=fs.statSync(path.join(SERVER_DIR,f)).size}catch{}})}catch{}
        res.json({
            cpu: c * 100,
            ram_used: (os.totalmem() - os.freemem()),
            ram_total: os.totalmem(),
            disk_used: d,
            disk_total: 20 * 1024 * 1024 * 1024 // 20GB
        });
    });
});

// --- API: ESTADO & CONTROL ---
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { mcServer.writeProperties(req.body); res.json({success:true}); });

app.post('/api/power/:a', async (req, res) => { 
    try { if (mcServer[req.params.a]) await mcServer[req.params.a](); res.json({ success: true }); } 
    catch (e) { res.status(500).json({}); } 
});

// --- API: UPDATES ---
app.get('/api/update/check', async (req, res) => {
    try {
        const local = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
        const remote = (await apiClient.get(`${REPO_RAW}/package.json`)).data.version;
        res.json({ type: local !== remote ? 'hard' : 'none', local, remote });
    } catch (e) { res.json({ type: 'error' }); }
});
app.post('/api/update/perform', (req, res) => res.json({ success: true }));

// --- API: FILES (Prevent 404) ---
app.get('/api/files', (req, res) => res.json([]));

// --- SOCKETS ---
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

server.listen(3000, () => console.log('✅ Aether Panel ONLINE (Puerto 3000)'));
