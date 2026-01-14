const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const MCManager = require('./mc_manager');
const osUtils = require('os-utils');
const os = require('os');
const multer = require('multer');
const { exec } = require('child_process');
const stream = require('stream');
const { promisify } = require('util');
const cron = require('node-cron');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// --- INICIALIZACIÓN ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const upload = multer({ dest: os.tmpdir() });

const IS_WIN = process.platform === 'win32';
const SERVER_DIR = path.join(__dirname, 'servers', 'default');
const BACKUP_DIR = path.join(__dirname, 'backups');
const CRON_FILE = path.join(__dirname, 'cron_tasks.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Asegurar directorios
if (!fs.existsSync(SERVER_DIR)) fs.mkdirSync(SERVER_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Obtener Secreto JWT
function getJwtSecret() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const s = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            return s.jwt_secret || 'default-secret-change-this';
        }
    } catch (e) { }
    return 'default-secret-change-this';
}

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helpers de Auth Simplificada
function getAllUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        // Support both old single-user format and new array format
        if (Array.isArray(data)) return data;
        // Convert old format to new
        return [{ ...data, role: 'admin', permissions: [], created: Date.now() }];
    } catch (e) { return []; }
}

function getAdminUser() {
    const users = getAllUsers();
    return users.find(u => u.role === 'admin') || users[0] || null;
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUserByUsername(username) {
    return getAllUsers().find(u => u.username === username);
}

function hashPassword(password, salt) {
    if (!salt) salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

function verifyPassword(password, storedHash, salt) {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === storedHash;
}

// Middleware de Autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, getJwtSecret(), (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- GESTOR MINECRAFT ---
const mcServer = new MCManager(io);

// --- SISTEMA CRON ---
let scheduledTasks = [];
function loadCronTasks() {
    scheduledTasks.forEach(t => t.task.stop());
    scheduledTasks = [];
    if (!fs.existsSync(CRON_FILE)) return;
    try {
        const tasks = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
        tasks.forEach(t => {
            if (t.enabled) {
                const job = cron.schedule(t.expression, async () => {
                    io.emit('toast', { type: 'info', msg: `⚙️ Tarea Auto: ${t.name}` });
                    if (t.action === 'restart') await mcServer.restart();
                    else if (t.action === 'backup') exec(`tar -czf "${path.join(BACKUP_DIR, 'auto-' + Date.now() + '.tar.gz')}" -C "${path.join(__dirname, 'servers')}" default`);
                    else if (t.action === 'stop') await mcServer.stop();
                    else if (t.action === 'start') await mcServer.start();
                });
                scheduledTasks.push({ id: t.id, task: job });
            }
        });
    } catch (e) { console.error("Error Cron:", e); }
}
loadCronTasks();

// --- RUTAS API AUTH (SIMPLIFICADO) ---

// Estado de la instalación (¿Hay usuario creado?)
app.get('/api/auth/status', (req, res) => {
    const admin = getAdminUser();
    res.json({ setupRequired: !admin });
});

// Configuración Inicial (Setup)
app.post('/api/auth/setup', (req, res) => {
    if (getAdminUser()) return res.status(403).json({ error: 'El panel ya está configurado.' });

    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos.' });

    const { salt, hash } = hashPassword(password);
    const user = { username, salt, hash, created: Date.now() };

    fs.writeFileSync(USERS_FILE, JSON.stringify(user));

    // Auto login
    const token = jwt.sign({ username: user.username }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ success: true, token, username: user.username });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = findUserByUsername(username);

    if (!user) return res.status(401).json({ error: 'Usuario incorrecto.' });

    if (verifyPassword(password, user.hash, user.salt)) {
        const token = jwt.sign({
            username: user.username,
            role: user.role || 'admin'
        }, getJwtSecret(), { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            username: user.username,
            role: user.role || 'admin',
            permissions: user.permissions || []
        });
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta.' });
    }
});

app.get('/api/auth/check', authenticateToken, (req, res) => {
    const user = findUserByUsername(req.user.username);
    if (!user) return res.status(404).json({ authenticated: false });

    res.json({
        authenticated: true,
        user: {
            username: req.user.username,
            role: user.role || 'admin',
            permissions: user.permissions || []
        }
    });
});

// Account Management Endpoints
app.post('/api/account/username', authenticateToken, (req, res) => {
    const { username } = req.body;

    if (!username || username.trim().length < 3) {
        return res.json({ success: false, error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }

    try {
        const users = getAllUsers();
        const userIndex = users.findIndex(u => u.username === req.user.username);
        if (userIndex === -1) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        // Check if new username already exists
        if (users.some(u => u.username === username.trim() && u.username !== req.user.username)) {
            return res.json({ success: false, error: 'El nombre de usuario ya existe' });
        }

        users[userIndex].username = username.trim();
        saveUsers(users);

        // Generate new token with updated username
        const token = jwt.sign({
            username: users[userIndex].username,
            role: users[userIndex].role || 'admin'
        }, getJwtSecret(), { expiresIn: '7d' });

        res.json({ success: true, token });
    } catch (error) {
        console.error('Error updating username:', error);
        res.json({ success: false, error: 'Error al actualizar el nombre de usuario' });
    }
});

app.post('/api/account/password', authenticateToken, (req, res) => {
    const { password } = req.body;

    if (!password || password.length < 4) {
        return res.json({ success: false, error: 'La contraseña debe tener al menos 4 caracteres' });
    }

    try {
        const users = getAllUsers();
        const userIndex = users.findIndex(u => u.username === req.user.username);
        if (userIndex === -1) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        const { salt, hash } = hashPassword(password);
        users[userIndex].salt = salt;
        users[userIndex].hash = hash;

        saveUsers(users);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating password:', error);
        res.json({ success: false, error: 'Error al actualizar la contraseña' });
    }
});

// ===== USER MANAGEMENT ENDPOINTS =====

// Get all users (admin only)
app.get('/api/users/list', authenticateToken, (req, res) => {
    try {
        // Check if current user is admin
        const currentUser = findUserByUsername(req.user.username);
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ error: 'Only administrators can view users' });
        }

        const users = getAllUsers();
        // Don't send passwords/hashes to frontend
        const safeUsers = users.map(u => ({
            username: u.username,
            role: u.role || 'user',
            permissions: u.permissions || [],
            created: u.created || Date.now()
        }));

        res.json(safeUsers);
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Error loading users' });
    }
});

// Create new user (admin only)
app.post('/api/users/create', authenticateToken, (req, res) => {
    try {
        const { username, password, role, permissions } = req.body;

        // Check if current user is admin
        const currentUser = findUserByUsername(req.user.username);
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only administrators can create users' });
        }

        // Validate input
        if (!username || !password) {
            return res.json({ success: false, error: 'Username and password are required' });
        }

        if (username.trim().length < 3) {
            return res.json({ success: false, error: 'Username must be at least 3 characters' });
        }

        if (password.length < 4) {
            return res.json({ success: false, error: 'Password must be at least 4 characters' });
        }

        // Check if user already exists
        const users = getAllUsers();
        if (users.find(u => u.username === username)) {
            return res.json({ success: false, error: 'User already exists' });
        }

        // Create new user
        const { salt, hash } = hashPassword(password);
        const newUser = {
            username: username.trim(),
            salt,
            hash,
            role: role || 'user',
            permissions: permissions || [],
            created: Date.now()
        };

        users.push(newUser);
        saveUsers(users);

        res.json({ success: true, message: `User ${username} created successfully` });
    } catch (error) {
        console.error('Error creating user:', error);
        res.json({ success: false, error: 'Error creating user' });
    }
});

// Delete user (admin only)
app.post('/api/users/delete', authenticateToken, (req, res) => {
    try {
        const { username } = req.body;

        // Check if current user is admin
        const currentUser = findUserByUsername(req.user.username);
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only administrators can delete users' });
        }

        // Can't delete yourself
        if (currentUser.username === username) {
            return res.json({ success: false, error: 'You cannot delete your own account' });
        }

        const users = getAllUsers();
        const userIndex = users.findIndex(u => u.username === username);

        if (userIndex === -1) {
            return res.json({ success: false, error: 'User not found' });
        }

        users.splice(userIndex, 1);
        saveUsers(users);

        res.json({ success: true, message: `User ${username} deleted successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.json({ success: false, error: 'Error deleting user' });
    }
});

// Update user (admin only)
app.post('/api/users/update', authenticateToken, (req, res) => {
    try {
        const { username, role, permissions } = req.body;

        // Check if current user is admin
        const currentUser = findUserByUsername(req.user.username);
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only administrators can update users' });
        }

        // Validate input
        if (!username) {
            return res.json({ success: false, error: 'Username is required' });
        }

        const users = getAllUsers();
        const userIndex = users.findIndex(u => u.username === username);

        if (userIndex === -1) {
            return res.json({ success: false, error: 'User not found' });
        }

        // Update user role and permissions
        if (role) users[userIndex].role = role;
        if (permissions !== undefined) users[userIndex].permissions = permissions;

        saveUsers(users);

        res.json({ success: true, message: `User ${username} updated successfully` });
    } catch (error) {
        console.error('Error updating user:', error);
        res.json({ success: false, error: 'Error updating user' });
    }
});



// --- RUTAS PROTEGIDAS ---

// Info Básica
app.get('/api/info', (req, res) => {
    try { const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); res.json({ version: pkg.version }); }
    catch (e) { res.json({ version: 'Unknown' }); }
});

app.get('/api/network', authenticateToken, (req, res) => {
    let port = 25565; let customDomain = null;
    try {
        const props = fs.readFileSync(path.join(SERVER_DIR, 'server.properties'), 'utf8');
        const match = props.match(/server-port=(\d+)/);
        if (match) port = match[1];
        if (fs.existsSync(SETTINGS_FILE)) {
            const s = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            customDomain = s.custom_domain;
        }
    } catch (e) { }
    res.json({ ip: getIP(), port: port, custom_domain: customDomain });
});

function getIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return '127.0.0.1';
}

// Stats & Power
app.get('/api/stats', authenticateToken, (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        sendStats(cpuPercent, getDirSize(SERVER_DIR), res);
    });
});
app.get('/api/status', authenticateToken, (req, res) => res.json(mcServer.getStatus()));
app.post('/api/power/:a', authenticateToken, async (req, res) => {
    if (mcServer[req.params.a]) await mcServer[req.params.a]();
    res.json({ success: true });
});

// Config & Files
app.get('/api/config', authenticateToken, (req, res) => res.json(mcServer.readProperties()));
app.post('/api/config', authenticateToken, (req, res) => {
    mcServer.writeProperties(req.body);
    res.json({ success: true });
});

app.get('/api/files', authenticateToken, (req, res) => {
    const t = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''));
    if (!fs.existsSync(t)) return res.json([]);
    const files = fs.readdirSync(t, { withFileTypes: true }).map(f => ({
        name: f.name, isDir: f.isDirectory(), size: f.isDirectory() ? '-' : (fs.statSync(path.join(t, f.name)).size / 1024).toFixed(1) + ' KB'
    }));
    res.json(files.sort((a, b) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1));
});

app.delete('/api/files', authenticateToken, (req, res) => {
    const filePath = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''));
    if (!fs.existsSync(filePath)) return res.json({ success: false, error: 'Archivo no encontrado' });
    try { fs.unlinkSync(filePath); res.json({ success: true }); } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.json({ success: false });
    const target = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''), req.file.originalname);
    fs.renameSync(req.file.path, target);
    res.json({ success: true });
});

// Backups & Cron
app.get('/api/cron', authenticateToken, (req, res) => {
    if (fs.existsSync(CRON_FILE)) res.json(JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'))); else res.json([]);
});
app.post('/api/cron', authenticateToken, (req, res) => {
    fs.writeFileSync(CRON_FILE, JSON.stringify(req.body, null, 2)); loadCronTasks(); res.json({ success: true });
});

app.get('/api/backups', authenticateToken, (req, res) => {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
    res.json(fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.tar.gz')).map(f => ({ name: f, size: (fs.statSync(path.join(BACKUP_DIR, f)).size / 1048576).toFixed(2) + ' MB' })));
});
app.post('/api/backups/create', authenticateToken, (req, res) => {
    exec(`tar -czf "${path.join(BACKUP_DIR, 'backup-' + Date.now() + '.tar.gz')}" -C "${path.join(__dirname, 'servers')}" default`, (e) => res.json({ success: !e }));
});
app.post('/api/backups/delete', authenticateToken, (req, res) => {
    fs.unlinkSync(path.join(BACKUP_DIR, req.body.name)); res.json({ success: true });
});
app.post('/api/backups/restore', authenticateToken, async (req, res) => {
    await mcServer.stop();
    exec(`rm -rf "${SERVER_DIR}"/* && tar -xzf "${path.join(BACKUP_DIR, req.body.name)}" -C "${path.join(__dirname, 'servers')}"`, (e) => res.json({ success: !e }));
});
app.post('/api/backups/explore', authenticateToken, (req, res) => {
    const filePath = path.join(BACKUP_DIR, req.body.name);
    if (!fs.existsSync(filePath)) return res.json({ success: false, error: "Archivo no encontrado" });
    const cmd = IS_WIN ? `tar -tf "${filePath}"` : `tar -ztf "${filePath}"`;
    exec(cmd, (err, stdout) => {
        if (err) return res.json({ success: false, content: ["Error al leer archivo."] });
        const lines = stdout.split('\n').filter(l => l.trim() !== '');
        // Árbol simple para el cliente
        const tree = {};
        lines.forEach(line => {
            const parts = line.split('/');
            let current = tree;
            parts.forEach((part, index) => {
                if (!part) return;
                if (index === parts.length - 1) { if (!current.files) current.files = []; current.files.push(part); }
                else { if (!current.dirs) current.dirs = {}; if (!current.dirs[part]) current.dirs[part] = { dirs: {}, files: [] }; current = current.dirs[part]; }
            });
        });
        res.json({ success: true, tree, flat: lines });
    });
});

// --- NEBULA / VERSIONS MANAGEMENT ---

app.post('/api/nebula/versions', authenticateToken, async (req, res) => {
    const { type } = req.body;
    try {
        let versions = [];
        if (type === 'vanilla') {
            const response = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
            versions = response.data.versions.filter(v => v.type === 'release').map(v => ({ id: v.id, url: v.url }));
        } else if (type === 'paper') {
            const response = await axios.get('https://api.papermc.io/v2/projects/paper');
            versions = response.data.versions.reverse().map(v => ({ id: v }));
        } else if (type === 'fabric') {
            const response = await axios.get('https://meta.fabricmc.net/v2/versions/game');
            versions = response.data.filter(v => v.stable).map(v => ({ id: v.version }));
        } else if (type === 'forge') {
            const response = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
            const promos = response.data.promos;
            const gameVersions = new Set();
            Object.keys(promos).forEach(k => {
                const part = k.split('-')[0];
                if (part && !isNaN(parseInt(part[0]))) gameVersions.add(part);
            });
            // Ordenar versiones (simple string sort por ahora, idealmente semver)
            versions = Array.from(gameVersions).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map(v => ({ id: v }));
        }
        res.json(versions);
    } catch (error) {
        console.error('Error fetching versions:', error.message);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

app.post('/api/nebula/resolve-vanilla', authenticateToken, async (req, res) => {
    const { url } = req.body;
    try {
        const response = await axios.get(url);
        const serverUrl = response.data.downloads?.server?.url;
        if (serverUrl) res.json({ url: serverUrl });
        else res.status(404).json({ error: 'Server download not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resolve vanilla version' });
    }
});

app.post('/api/nebula/resolve-forge', authenticateToken, async (req, res) => {
    const { version } = req.body;
    try {
        const response = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
        const promos = response.data.promos;
        const forgeVer = promos[`${version}-recommended`] || promos[`${version}-latest`];

        if (!forgeVer) return res.status(404).json({ error: 'No compatible Forge version found' });

        const longVersion = `${version}-${forgeVer}`;
        const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${longVersion}/forge-${longVersion}-installer.jar`;
        res.json({ url });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resolve forge version' });
    }
});

app.post('/api/install', authenticateToken, async (req, res) => {
    const { url, filename } = req.body;
    try {
        await mcServer.installJar(url, filename);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// --- SETTINGS MANAGEMENT ---

app.post('/api/settings', authenticateToken, (req, res) => {
    try {
        const newSettings = req.body;
        let currentSettings = {};

        if (fs.existsSync(SETTINGS_FILE)) {
            try {
                currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            } catch (e) { }
        }

        // Merge existing settings with new ones
        const updatedSettings = { ...currentSettings, ...newSettings };

        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updatedSettings, null, 2));

        // Update MCManager RAM if present
        if (newSettings.ram) {
            mcServer.ram = newSettings.ram;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.json({ success: false, error: 'Error saving settings' });
    }
});

// Utility
const getDirSize = (dirPath) => {
    let size = 0;
    try {
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            files.forEach(file => {
                const stats = fs.statSync(path.join(dirPath, file));
                if (stats.isDirectory()) size += getDirSize(path.join(dirPath, file)); else size += stats.size;
            });
        }
    } catch (e) { }
    return size;
};

function sendStats(cpuPercent, diskBytes, res) {
    const cpus = os.cpus();
    res.json({
        cpu: cpuPercent * 100,
        cpu_freq: cpus.length > 0 ? cpus[0].speed : 0,
        ram_total: os.totalmem(),
        ram_free: os.freemem(),
        ram_used: os.totalmem() - os.freemem(),
        disk_used: diskBytes,
        disk_total: 20 * 1024 * 1024 * 1024
    });
}

// Socket IO con Auth simple
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token no proporcionado'));
    jwt.verify(token, getJwtSecret(), (err, decoded) => {
        if (err) return next(new Error('Token inválido'));
        socket.user = decoded;
        next();
    });
});

io.on('connection', (s) => {
    s.emit('logs_history', mcServer.getRecentLogs());
    s.emit('status_change', mcServer.status);
    s.on('command', (c) => mcServer.sendCommand(c));
});

server.listen(3000, () => console.log('Aether Panel Lite running on port 3000'));