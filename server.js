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
const apiClient = axios.create({ headers: { 'User-Agent': 'Aether-Panel/1.6.0' }, timeout: 10000 });

// --- UTILS ---
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

function sendStats(cpuPercent, diskBytes, res) {
    res.json({
        cpu: cpuPercent * 100,
        ram_total: os.totalmem(),
        ram_free: os.freemem(),
        ram_used: os.totalmem() - os.freemem(),
        disk_used: diskBytes,
        disk_total: 20 * 1024 * 1024 * 1024 // 20GB simulado
    });
}

// --- API ROUTES ---

// Info & Update
app.get('/api/info', (req, res) => {
    try { const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); res.json({ version: pkg.version }); } 
    catch (e) { res.json({ version: 'Unknown' }); }
});

// Stats
app.get('/api/stats', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        let diskBytes = 0;
        if(!IS_WIN) {
            exec(`du -sb ${SERVER_DIR}`, (error, stdout) => {
                if (!error && stdout) diskBytes = parseInt(stdout.split(/\s+/)[0]);
                sendStats(cpuPercent, diskBytes, res);
            });
        } else {
            sendStats(cpuPercent, getDirSize(SERVER_DIR), res);
        }
    });
});

// Players & Whitelist (NUEVO)
app.get('/api/players', (req, res) => {
    // Devuelve los jugadores rastreados por el Manager
    res.json(Array.from(mcServer.onlinePlayers));
});

app.get('/api/whitelist', (req, res) => {
    res.json(mcServer.getWhitelist());
});

app.post('/api/whitelist', (req, res) => {
    const { action, name } = req.body;
    const newList = mcServer.updateWhitelist(action, name);
    res.json({ success: true, list: newList });
});

// Settings
app.post('/api/settings', (req, res) => {
    try {
        const { ram } = req.body;
        let settings = {};
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (ram) settings.ram = ram;
        fs.writeFileSync(settingsPath, JSON.stringify(settings));
        mcServer.loadSettings();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/settings', (req, res) => {
    try { if(fs.existsSync(path.join(__dirname, 'settings.json'))) res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'))); else res.json({ ram: '4G' }); } catch(e) { res.json({ ram: '4G' }); }
});

// Config Properties
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { mcServer.writeProperties(req.body); res.json({ success: true }); });

// Control
app.get('/api/status', (req, res) => res.json(mcServer.getStatus()));
app.post('/api/power/:a', async (req, res) => { try { if (mcServer[req.params.a]) await mcServer[req.params.a](); res.json({ success: true }); } catch (e) { res.status(500).json({}); } });

// Versions & Install
app.post('/api/nebula/versions', async (req, res) => {
    try {
        const t = req.body.type; let l = [];
        if (t === 'vanilla') l = (await apiClient.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).data.versions.filter(v => v.type === 'release').map(v => ({ id: v.id, url: v.url, type: 'vanilla' }));
        else if (t === 'paper') l = (await apiClient.get('https://api.papermc.io/v2/projects/paper')).data.versions.reverse().map(v => ({ id: v, type: 'paper' }));
        else if (t === 'fabric') l = (await apiClient.get('https://meta.fabricmc.net/v2/versions/game')).data.filter(v => v.stable).map(v => ({ id: v.version, type: 'fabric' }));
        else if (t === 'forge') {
            const p = (await apiClient.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).data.promos;
            const s = new Set(); Object.keys(p).forEach(k => { const v = k.split('-')[0]; if (v.match(/^\d+\.\d+(\.\d+)?$/)) s.add(v); });
            l = Array.from(s).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })).map(v => ({ id: v, type: 'forge' }));
        }
        res.json(l);
    } catch (e) { res.status(500).json({ error: 'API Error' }); }
});
app.post('/api/nebula/resolve-vanilla', async (req, res) => { try { const d = (await apiClient.get(req.body.url)).data; res.json({ url: d.downloads.server.url }); } catch (e) { res.status(500).json({}); } });
app.post('/api/nebula/resolve-forge', async (req, res) => {
    try {
        const version = req.body.version;
        const promos = (await apiClient.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).data.promos;
        let forgeBuild = promos[`${version}-recommended`] || promos[`${version}-latest`];
        if (!forgeBuild) throw new Error("Versión no encontrada");
        res.json({ url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeBuild}/forge-${version}-${forgeBuild}-installer.jar` });
    } catch (e) { res.status(500).json({ error: 'Forge Resolve Failed' }); }
});
app.post('/api/install', async (req, res) => { try { await mcServer.installJar(req.body.url, req.body.filename); res.json({ success: true }); } catch (e) { res.status(500).json({}); } });

// Files
app.get('/api/files', (req, res) => {
    const t = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''));
    if (!fs.existsSync(t)) return res.json([]);
    const files = fs.readdirSync(t, { withFileTypes: true }).map(f => ({
        name: f.name, isDir: f.isDirectory(), size: f.isDirectory() ? '-' : (fs.statSync(path.join(t, f.name)).size / 1024).toFixed(1) + ' KB'
    }));
    res.json(files.sort((a, b) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1));
});
app.post('/api/files/read', (req, res) => { const p = path.join(SERVER_DIR, req.body.file.replace(/\.\./g, '')); if (fs.existsSync(p)) res.json({ content: fs.readFileSync(p, 'utf8') }); else res.status(404).json({}); });
app.post('/api/files/save', (req, res) => { fs.writeFileSync(path.join(SERVER_DIR, req.body.file.replace(/\.\./g, '')), req.body.content); res.json({ success: true }); });
app.post('/api/files/upload', upload.single('file'), (req, res) => { if (req.file) { fs.renameSync(req.file.path, path.join(SERVER_DIR, req.file.originalname)); res.json({ success: true }); } else res.json({ success: false }); });

io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

server.listen(3000, () => console.log('Aether Panel running on port 3000'));
