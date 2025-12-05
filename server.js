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

// CONFIGURACIÓN DE GITHUB (Dinámica)
// Detectamos si estamos en prerelease mirando el package.json o una variable de entorno
const pkgLocal = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const IS_PRE = pkgLocal.version.includes('beta') || pkgLocal.version.includes('pre');

const REPO_USER = 'femby08';
const REPO_NAME = IS_PRE ? 'aether-panel-prerelease' : 'aether-panel';
const REPO_RAW = `https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/main`;

const apiClient = axios.create({ headers: { 'User-Agent': `Aether-Panel/${pkgLocal.version}` } });

console.log(`>>> MODO: ${IS_PRE ? 'EXPERIMENTAL (Pre-release)' : 'ESTABLE'}`);
console.log(`>>> REPO ORIGEN: ${REPO_RAW}`);

// --- API: INFO DEL PANEL ---
app.get('/api/info', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        res.json({ version: pkg.version, channel: IS_PRE ? 'prerelease' : 'stable' });
    } catch (e) { res.json({ version: 'Unknown' }); }
});

// --- API: CHECK UPDATES (Smart Logic) ---
app.get('/api/update/check', async (req, res) => {
    try {
        const localPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const remotePkg = (await apiClient.get(`${REPO_RAW}/package.json`)).data;
        
        // 1. Hard Update (Cambio de Versión)
        if (remotePkg.version !== localPkg.version) {
            return res.json({ 
                type: 'hard', 
                local: localPkg.version, 
                remote: remotePkg.version,
                channel: IS_PRE ? 'prerelease' : 'stable'
            });
        }

        // 2. Soft Update (Cambios Visuales en /public)
        const files = ['public/index.html', 'public/style.css', 'public/app.js'];
        let hasChanges = false;
        
        for (const f of files) {
            try {
                const remoteContent = (await apiClient.get(`${REPO_RAW}/${f}`)).data;
                const localPath = path.join(__dirname, f);
                if (fs.existsSync(localPath)) {
                    const localContent = fs.readFileSync(localPath, 'utf8');
                    if (JSON.stringify(remoteContent) !== JSON.stringify(localContent)) {
                        hasChanges = true; break;
                    }
                }
            } catch(e) {}
        }

        if (hasChanges) return res.json({ type: 'soft', local: localPkg.version, remote: remotePkg.version });
        res.json({ type: 'none' });

    } catch (e) { res.json({ type: 'error' }); }
});

// --- API: EJECUTAR UPDATE ---
app.post('/api/update/perform', async (req, res) => {
    const { type } = req.body;
    
    // HARD UPDATE: Pasa el flag al updater.sh
    if (type === 'hard') {
        const flag = IS_PRE ? '-pre' : '-stable';
        io.emit('toast', { type: 'warning', msg: `🔄 Actualizando canal ${IS_PRE ? 'EXPERIMENTAL' : 'ESTABLE'}...` });
        
        const updater = spawn('bash', ['/opt/aetherpanel/updater.sh', flag], { detached: true, stdio: 'ignore' });
        updater.unref();
        res.json({ success: true, mode: 'hard' });
        setTimeout(() => process.exit(0), 1000);
    } 
    // SOFT UPDATE
    else if (type === 'soft') {
        io.emit('toast', { type: 'info', msg: '🎨 Actualizando visuales...' });
        try {
            const files = ['public/index.html', 'public/style.css', 'public/app.js'];
            for (const f of files) {
                const c = (await apiClient.get(`${REPO_RAW}/${f}`)).data;
                fs.writeFileSync(path.join(__dirname, f), typeof c === 'string' ? c : JSON.stringify(c));
            }
            exec(`wget -q -O /opt/aetherpanel/public/logo.svg ${REPO_RAW}/public/logo.svg`);
            exec(`wget -q -O /opt/aetherpanel/public/logo.ico ${REPO_RAW}/public/logo.ico`);
            
            res.json({ success: true, mode: 'soft' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    }
});

// --- API: VERSIONES MINECRAFT ---
app.post('/api/nebula/versions', async (req, res) => {
    try {
        const t = req.body.type;
        let l = [];
        if(t==='vanilla') l = (await apiClient.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).data.versions.filter(v=>v.type==='release').map(v=>({id:v.id, url:v.url, type:'vanilla'}));
        else if(t==='paper') l = (await apiClient.get('https://api.papermc.io/v2/projects/paper')).data.versions.reverse().map(v=>({id:v, type:'paper'}));
        else if(t==='fabric') l = (await apiClient.get('https://meta.fabricmc.net/v2/versions/game')).data.filter(v=>v.stable).map(v=>({id:v.version, type:'fabric'}));
        else if(t==='forge') {
            const p = (await apiClient.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).data.promos;
            const s = new Set(); Object.keys(p).forEach(k=>{const v=k.split('-')[0]; if(v.match(/^\d+\.\d+(\.\d+)?$/)) s.add(v)});
            l = Array.from(s).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true,sensitivity:'base'})).map(v=>({id:v, type:'forge'}));
        }
        res.json(l);
    } catch(e) { res.status(500).json({error:'API Error'}); }
});

// Resolver URL real de Vanilla
app.post('/api/nebula/resolve-vanilla', async (req, res) => { 
    try { 
        res.json({url: (await apiClient.get(req.body.url)).data.downloads.server.url}); 
    } catch(e){res.status(500).json({});} 
});

// --- API: INSTALADOR DE MODS ---
app.post('/api/mods/install', async (req, res) => {
    const { url, name } = req.body;
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, ''); // Sanitización
    if (!safeName) return res.status(400).json({success: false, error: 'Nombre inválido'});

    const d = path.join(SERVER_DIR, 'mods');
    if(!fs.existsSync(d)) fs.mkdirSync(d);
    
    io.emit('toast', {type:'info', msg:`Instalando ${safeName}...`});
    
    exec(`wget -q -O "${path.join(d, safeName + '.jar')}" "${url}"`, (e)=>{
        if(e) io.emit('toast',{type:'error', msg:'Error al descargar mod'}); 
        else io.emit('toast',{type:'success', msg:'Mod Instalado'});
    });
    res.json({success:true});
});

// --- API: MONITOR Y ESTADO ---
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

// --- API: CONTROLES DE ENERGÍA ---
app.post('/api/power/:a', async (req, res) => { 
    const action = req.params.a;
    const ALLOWED_ACTIONS = ['start', 'stop', 'restart', 'kill'];
    if (!ALLOWED_ACTIONS.includes(action)) return res.status(403).json({ error: 'Acción no permitida' });

    try{
        if(mcServer[action]) await mcServer[action]();
        res.json({success:true});
    } catch(e){ res.status(500).json({}); }
});

// --- API: GESTOR DE ARCHIVOS ---
app.get('/api/files', (req, res) => { 
    const t = path.join(SERVER_DIR, (req.query.path||'').replace(/\.\./g, '')); 
    if(!fs.existsSync(t)) return res.json([]); 
    
    res.json(fs.readdirSync(t,{withFileTypes:true}).map(f=>({
        name: f.name, 
        isDir: f.isDirectory(), 
        size: f.isDirectory() ? '-' : (fs.statSync(path.join(t,f.name)).size/1024).toFixed(1)+' KB'
    })).sort((a,b)=>a.isDir===b.isDir?0:a.isDir?-1:1)); 
});
app.post('/api/files/read', (req, res) => { 
    const p = path.join(SERVER_DIR, req.body.file.replace(/\.\./g,'')); 
    if(fs.existsSync(p)) res.json({content: fs.readFileSync(p,'utf8')}); 
    else res.status(404).json({}); 
});
app.post('/api/files/save', (req, res) => { 
    fs.writeFileSync(path.join(SERVER_DIR, req.body.file.replace(/\.\./g,'')), req.body.content); 
    res.json({success:true}); 
});
app.post('/api/files/upload', upload.single('file'), (req, res) => { 
    if(req.file){
        const safeName = path.basename(req.file.originalname);
        fs.renameSync(req.file.path, path.join(SERVER_DIR, safeName)); 
        res.json({success:true});
    } else res.json({success:false}); 
});

// --- API: CONFIGURACIÓN ---
app.get('/api/config', (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', (req, res) => { mcServer.writeProperties(req.body); res.json({success:true}); });

// --- API: INSTALACIÓN JAR ---
app.post('/api/install', async (req, res) => { 
    try{
        await mcServer.installJar(req.body.url, req.body.filename);
        res.json({success:true});
    } catch(e){ res.status(500).json({}); }
});

// --- API: BACKUPS ---
app.get('/api/backups', (req, res) => { 
    if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR); 
    res.json(fs.readdirSync(BACKUP_DIR).filter(f=>f.endsWith('.tar.gz')).map(f=>({
        name: f, 
        size: (fs.statSync(path.join(BACKUP_DIR,f)).size/1048576).toFixed(2)+' MB'
    }))); 
});
app.post('/api/backups/create', (req, res) => { 
    exec(`tar -czf "${path.join(BACKUP_DIR, 'backup-'+Date.now()+'.tar.gz')}" -C "${path.join(__dirname,'servers')}" default`, (e)=>res.json({success:!e})); 
});
app.post('/api/backups/delete', (req, res) => { 
    fs.unlinkSync(path.join(BACKUP_DIR, req.body.name)); 
    res.json({success:true}); 
});
app.post('/api/backups/restore', async (req, res) => { 
    await mcServer.stop(); 
    exec(`rm -rf "${SERVER_DIR}"/* && tar -xzf "${path.join(BACKUP_DIR, req.body.name)}" -C "${path.join(__dirname,'servers')}"`, (e)=>res.json({success:!e})); 
});

// --- WEBSOCKETS ---
io.on('connection', (s) => { 
    s.emit('logs_history', mcServer.getRecentLogs()); 
    s.emit('status_change', mcServer.status); 
    s.on('command', (c) => mcServer.sendCommand(c)); 
});

server.listen(3000, () => console.log('Aether Panel Running on 3000'));