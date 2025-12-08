const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
// const MCManager = require('./mc_manager'); 
const osUtils = require('os-utils');
const os = require('os');
const multer = require('multer');
const axios = require('axios');
const { exec, spawn } = require('child_process');

// --- SISTEMA DE DIAGNÓSTICO DE ERRORES ---
process.on('uncaughtException', (err) => {
    console.error('CRASH CRÍTICO DETECTADO:', err);
});

process.on('SIGTERM', () => {
    console.log('RECIBIDA SEÑAL DE APAGADO (SIGTERM).');
    process.exit(0);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});
const upload = multer({ dest: os.tmpdir() });

const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Cargar MCManager de forma segura
let mcServer;
try {
    const MCManager = require('./mc_manager');
    mcServer = new MCManager(io);
} catch (error) {
    console.error("Modo seguro: MCManager no cargado.");
    mcServer = {
        getStatus: () => ({ status: 'offline' }),
        readProperties: () => ({}),
        writeProperties: () => {},
        getRecentLogs: () => [],
        sendCommand: () => {}
    };
}

// ==========================================
// CONFIGURACIÓN DE CANAL
// ==========================================
let CHANNEL = 'stable';
try {
    if (fs.existsSync(path.join(__dirname, '.channel'))) {
        CHANNEL = fs.readFileSync(path.join(__dirname, '.channel'), 'utf8').trim();
    }
} catch (e) {
    console.error("Aviso: No se detectó archivo .channel, usando modo stable.");
}

const IS_PRE = CHANNEL === 'prerelease';
const REPO_USER = 'femby08';
const REPO_NAME = IS_PRE ? 'aether-panel-prerelease' : 'aether-panel';
const REPO_RAW = `https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/main`;

let localVer = '0.0.0';
try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    localVer = pkg.version;
} catch (e) {}

const apiClient = axios.create({ headers: { 'User-Agent': `Aether-Panel/${localVer}` } });

console.log(`>>> CANAL ACTIVO: ${CHANNEL.toUpperCase()}`);

// --- RUTAS API ---
app.get('/api/info', (req, res) => {
    res.json({ version: localVer, channel: CHANNEL });
});

app.get('/api/update/check', async (req, res) => {
    try {
        const remotePkg = (await apiClient.get(`${REPO_RAW}/package.json`)).data;
        if (remotePkg.version !== localVer) {
            return res.json({ type: 'hard', local: localVer, remote: remotePkg.version, channel: CHANNEL });
        }
        const files = ['public/index.html', 'public/style.css', 'public/app.js'];
        let hasChanges = false;
        for (const f of files) {
            try {
                const remoteContent = (await apiClient.get(`${REPO_RAW}/${f}`)).data;
                const localPath = path.join(__dirname, f);
                if (fs.existsSync(localPath)) {
                    const localContent = fs.readFileSync(localPath, 'utf8');
                    if (JSON.stringify(remoteContent).length !== JSON.stringify(localContent).length) {
                        hasChanges = true; break;
                    }
                }
            } catch(e) {}
        }
        if (hasChanges) return res.json({ type: 'soft', local: localVer, remote: remotePkg.version });
        res.json({ type: 'none' });
    } catch (e) { res.json({ type: 'error', msg: e.message }); }
});

app.post('/api/update/perform', async (req, res) => {
    const { type } = req.body;
    if (type === 'hard') {
        io.emit('toast', { type: 'warning', msg: `🔄 Actualizando sistema (${CHANNEL})...` });
        const updater = spawn('bash', ['/opt/aetherpanel/updater.sh'], { detached: true, stdio: 'ignore' });
        updater.unref();
        res.json({ success: true });
        setTimeout(() => process.exit(0), 1000);
    } else if (type === 'soft') {
        io.emit('toast', { type: 'info', msg: '🎨 Actualizando interfaz...' });
        try {
            const files = ['public/index.html', 'public/style.css', 'public/app.js'];
            for (const f of files) {
                const c = (await apiClient.get(`${REPO_RAW}/${f}`)).data;
                const contentToWrite = typeof c === 'object' ? JSON.stringify(c, null, 2) : c;
                fs.writeFileSync(path.join(__dirname, f), contentToWrite);
            }
            exec(`wget -q -O /opt/aetherpanel/public/logo.svg ${REPO_RAW}/public/logo.svg`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    }
});

app.get('/api/stats', (req, res) => { 
    osUtils.cpuUsage((c) => { 
        res.json({
            cpu: c * 100, 
            ram_used: (os.totalmem() - os.freemem()) / 1048576, 
            ram_total: os.totalmem() / 1048576, 
            disk_total: 20480 
        }); 
    }); 
});

app.post('/api/power/:a', async (req, res) => {
    try {
        if(mcServer[req.params.a]) await mcServer[req.params.a]();
        res.json({success:true});
    } catch(e) { res.status(500).json({error: e.message}); }
});

io.on('connection', (s) => {
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.getStatus ? mcServer.getStatus() : 'offline');
});

// --- INICIO DEL SERVIDOR ---
const PORT = 3000;

// Función para encontrar IPs locales
function getLocalIPs() {
    const nets = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Saltamos direcciones no IPv4 y loopbacks (127.0.0.1)
            if (net.family === 'IPv4' && !net.internal) {
                results.push(net.address);
            }
        }
    }
    return results;
}

// Escuchar en 0.0.0.0 habilita TANTO la IP Privada como la Pública
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ AETHER PANEL INICIADO`);
    console.log(`------------------------------------------------`);
    console.log(`🔌 Estado del Puerto: ABIERTO en ${PORT}`);
    console.log(`🏠 Acceso Local:      http://localhost:${PORT}`);
    
    const ips = getLocalIPs();
    if (ips.length > 0) {
        console.log(`🔐 Acceso Privado/LAN:`);
        ips.forEach(ip => {
            console.log(`   -> http://${ip}:${PORT}`);
        });
    } else {
        console.log(`⚠️ No se detectaron IPs privadas externas.`);
    }
    console.log(`------------------------------------------------\n`);
});
