const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const MCManager = require('./mc_manager');
const osUtils = require('os-utils');
const os = require('os');
const multer = require('multer');

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
app.use(express.static(path.join(__dirname, 'public')));
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

// --- RUTAS API ---

// 1. Info Básica (Arregla el problema de "Cargando...")
app.get('/api/info', (req, res) => {
    try { 
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); 
        res.json({ version: pkg.version }); 
    } catch (e) { 
        res.json({ version: '1.6.2' }); 
    }
});

// 2. Estadísticas para las Gráficas
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        const totalRam = os.totalmem();
        const freeRam = os.freemem();
        const usedRam = totalRam - freeRam;
        
        // Simular tamaño de disco si es muy costoso calcularlo
        const diskUsed = getDirSize(SERVER_DIR); 

        res.json({
            cpu: cpuPercent * 100,
            ram_used: usedRam,
            ram_total: totalRam,
            disk_used: diskUsed,
            disk_total: 20 * 1024 * 1024 * 1024 // 20GB fijos para la barra
        });
    });
});

app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));

// 3. Whitelist y Propiedades
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
        if(mcServer.status === 'ONLINE') mcServer.sendCommand('whitelist reload');
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { 
    mcServer.writeProperties(req.body); 
    res.json({ success: true }); 
});

// 4. Energía y Comandos
app.post('/api/power/:action', async (req, res) => { 
    try { 
        const action = req.params.action;
        if (mcServer[action]) { await mcServer[action](); res.json({ success: true }); } 
        else { res.status(400).json({ error: 'Acción inválida' }); }
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

// 5. Archivos (Básico para que no se vea vacío)
app.get('/api/files', (req, res) => {
    const t = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''));
    if (!fs.existsSync(t)) return res.json([]);
    const files = fs.readdirSync(t, { withFileTypes: true }).map(f => ({
        name: f.name, isDir: f.isDirectory(), size: f.isDirectory() ? '-' : (fs.statSync(path.join(t, f.name)).size / 1024).toFixed(1) + ' KB'
    }));
    res.json(files);
});

// SOCKET IO
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`>>> Aether Panel V1.6.2 Corregido corriendo en puerto ${PORT}`));
