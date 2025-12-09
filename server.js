const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const MCManager = require('./mc_manager');
const osUtils = require('os-utils');
const os = require('os');
const multer = require('multer');
const stream = require('stream');
const { promisify } = require('util');

// --- INICIALIZACIÓN ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const upload = multer({ dest: os.tmpdir() });

const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Asegurar directorios
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public'))); // Sirve los archivos estáticos (html, css, js)
app.use(express.json());

// --- GESTOR MINECRAFT ---
const mcServer = new MCManager(io);

// --- UTILIDADES ---
const getDirSize = (dirPath) => {
    let size = 0;
    try {
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            files.forEach(file => {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) size += getDirSize(filePath);
                else size += stats.size;
            });
        }
    } catch(e) {}
    return size;
};

function getServerIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

function sendStats(cpuPercent, diskBytes, res) {
    const cpus = os.cpus();
    let cpuSpeed = cpus.length > 0 ? cpus[0].speed : 0;
    res.json({
        cpu: cpuPercent * 100,
        cpu_freq: cpuSpeed,
        ram_total: os.totalmem(),
        ram_free: os.freemem(),
        ram_used: os.totalmem() - os.freemem(),
        disk_used: diskBytes,
        disk_total: 20 * 1024 * 1024 * 1024 // 20GB simulado para referencia visual
    });
}

// ==========================================
//                 RUTAS API
// ==========================================

// Información básica del sistema y versión
app.get('/api/info', (req, res) => {
    try { 
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); 
        res.json({ version: pkg.version }); 
    } catch (e) { 
        res.json({ version: '1.0.0' }); 
    }
});

app.get('/api/network', (req, res) => {
    res.json({ ip: getServerIP(), port: 25565 });
});

// --- WHITELIST & JUGADORES ---
app.get('/api/players', (req, res) => {
    // Aquí podrías implementar RCON para obtener jugadores reales
    // Por ahora enviamos una lista vacía para evitar errores en frontend
    res.json([]); 
});

app.get('/api/whitelist', (req, res) => {
    const p = path.join(SERVER_DIR, 'whitelist.json');
    if(fs.existsSync(p)) {
        try { res.json(JSON.parse(fs.readFileSync(p, 'utf8'))); } 
        catch { res.json([]); }
    } else { res.json([]); }
});

app.post('/api/whitelist', (req, res) => {
    const p = path.join(SERVER_DIR, 'whitelist.json');
    try {
        fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
        // Si el servidor está encendido, recargamos la whitelist en tiempo real
        if(mcServer.status === 'ONLINE') mcServer.sendCommand('whitelist reload');
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ESTADÍSTICAS (MONITOR) ---
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        let diskBytes = getDirSize(SERVER_DIR);
        sendStats(cpuPercent, diskBytes, res);
    });
});

app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));

// --- CONTROL DE ENERGÍA (START/STOP) ---
app.post('/api/power/:action', async (req, res) => { 
    try { 
        const action = req.params.action; // start, stop, restart, kill
        if (mcServer[action]) {
            await mcServer[action]();
            res.json({ success: true }); 
        } else {
            res.status(400).json({ error: 'Acción no válida' });
        }
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/command', (req, res) => { 
    if(mcServer.status === 'ONLINE'){ 
        mcServer.sendCommand(req.body.command); 
        res.json({success:true}); 
    } else { 
        res.status(400).json({error: 'El servidor está apagado'}); 
    } 
});

// --- ARCHIVOS Y CONFIGURACIÓN ---
app.get('/api/files', (req, res) => {
    const t = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''));
    if (!fs.existsSync(t)) return res.json([]);
    const files = fs.readdirSync(t, { withFileTypes: true }).map(f => ({
        name: f.name, 
        isDir: f.isDirectory(), 
        size: f.isDirectory() ? '-' : (fs.statSync(path.join(t, f.name)).size / 1024).toFixed(1) + ' KB'
    }));
    res.json(files.sort((a, b) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1));
});

// Leer server.properties
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));

// Guardar server.properties
app.post('/api/config', (req, res) => { 
    mcServer.writeProperties(req.body); 
    res.json({ success: true }); 
});

// SOCKET.IO PARA CONSOLA
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`>>> Aether Panel V1.6.3 Corregido corriendo en puerto ${PORT}`));
