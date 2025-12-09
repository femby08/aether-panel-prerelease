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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// INICIALIZAR GESTOR
const mcServer = new MCManager(io);

// ==========================================
// API ROUTES
// ==========================================

// 1. CONTROL DE ENERGÍA (LO QUE FALLABA)
app.post('/api/power/:action', async (req, res) => {
    const action = req.params.action; // start, stop, restart, kill
    console.log(`[API] Orden recibida: ${action}`); 

    try {
        if (mcServer[action]) {
            await mcServer[action]();
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Acción inválida' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 2. INFO (Versión limpia)
app.get('/api/info', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        res.json({ version: pkg.version });
    } catch (e) { res.json({ version: '1.0.0' }); }
});

// 3. MONITOR (CPU/RAM)
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((c) => {
        // Cálculo básico de disco (simulado para rapidez)
        // En producción usarías 'du' o similar
        res.json({
            cpu: c * 100,
            ram_used: (os.totalmem() - os.freemem()),
            ram_total: os.totalmem(),
            disk_used: 0, 
            disk_total: 20 * 1024 * 1024 * 1024
        });
    });
});

// 4. ESTADO
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));

// 5. CONFIGURACIÓN
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { mcServer.writeProperties(req.body); res.json({success:true}); });

// 6. INSTALACIÓN DE JARS
app.post('/api/install', async (req, res) => {
    try {
        await mcServer.installJar(req.body.url, req.body.filename);
        res.json({ success: true });
    } catch(e) { res.status(500).json({}); }
});

// 7. UPDATER (Check simple)
app.get('/api/update/check', (req, res) => res.json({ type: 'none' }));
app.post('/api/update/perform', (req, res) => res.json({ success: true }));

// 8. FILES
app.get('/api/files', (req, res) => res.json([]));

// SOCKETS
io.on('connection', (s) => {
    s.emit('logs_history', mcServer.getRecentLogs());
    s.emit('status_change', mcServer.status);
    s.on('command', (c) => mcServer.sendCommand(c));
});

// START
server.listen(3000, () => console.log('✅ Aether Panel ONLINE en puerto 3000'));
