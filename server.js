const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const MCManager = require('./mc_manager');
const osUtils = require('os-utils');
const os = require('os');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const upload = multer({ dest: os.tmpdir() });

// Directorios
const SERVER_DIR = path.join(__dirname, 'servers', 'default');
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const mcServer = new MCManager(io);

// --- RUTAS API ---

// 1. Info del Panel (Versión)
app.get('/api/info', (req, res) => {
    try {
        const pkg = require('./package.json');
        res.json({ version: pkg.version });
    } catch (e) {
        res.json({ version: '1.0.0' });
    }
});

// 2. Monitor de Recursos (CPU/RAM)
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        const totalRam = os.totalmem();
        const freeRam = os.freemem();
        const usedRam = totalRam - freeRam;
        
        res.json({
            cpu: cpuPercent * 100,
            ram_used: usedRam / 1024 / 1024, // MB
            ram_total: totalRam / 1024 / 1024, // MB
            disk_used: 0, // Implementar lógica real si se desea
            disk_total: 10240
        });
    });
});

// 3. Configuración
app.get('/api/config', (req, res) => {
    res.json(mcServer.readProperties());
});

app.post('/api/config', (req, res) => {
    mcServer.writeProperties(req.body);
    res.json(mcServer.readProperties());
});

// 4. Control de Energía
app.post('/api/power/:action', async (req, res) => {
    const action = req.params.action;
    if (mcServer[action]) {
        await mcServer[action]();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Acción inválida' });
    }
});

// 5. Estado
app.get('/api/status', (req, res) => {
    res.json(mcServer.getStatus());
});

// --- SOCKETS ---
io.on('connection', (socket) => {
    // Enviar historial de logs al conectar
    socket.emit('logs_history', mcServer.getRecentLogs());
    socket.emit('status_change', mcServer.status);

    // Recibir comandos de la terminal
    socket.on('command', (cmd) => {
        mcServer.sendCommand(cmd);
    });
});

server.listen(3000, () => {
    console.log('✅ Aether Panel (Repo Version) corriendo en puerto 3000');
});
