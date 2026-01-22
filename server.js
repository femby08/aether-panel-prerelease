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

// Ensure server.js does not crash on unhandled promise rejections (common with axios)
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

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

let cronTasks = [];

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
    } catch (e) { console.error('Error reading JWT secret:', e); }
    return 'default-secret-change-this';
}

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' })); // Increased limit for file uploads/saves

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
// Logic moved to unified loadCronTasks below


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

// Download file from URL (For Plugin Store)
app.post('/api/files/download', authenticateToken, async (req, res) => {
    const { url, path: subPath, filename } = req.body;
    if (!url || !subPath || !filename) return res.json({ success: false, error: 'Missing parameters' });

    try {
        const targetDir = path.join(SERVER_DIR, subPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const targetPath = path.join(targetDir, filename);
        const writer = fs.createWriteStream(targetPath);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        writer.on('finish', () => res.json({ success: true }));
        writer.on('error', (err) => res.json({ success: false, error: err.message }));
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.json({ success: false });
    const target = path.join(SERVER_DIR, (req.query.path || '').replace(/\.\./g, ''), req.file.originalname);
    fs.renameSync(req.file.path, target);
    res.json({ success: true });
});

app.post('/api/files/read', authenticateToken, (req, res) => {
    const filePath = path.join(SERVER_DIR, (req.body.path || '').replace(/\.\./g, ''));
    if (!fs.existsSync(filePath)) return res.json({ success: false, error: 'File not found' });
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, content });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/files/write', authenticateToken, (req, res) => {
    const filePath = path.join(SERVER_DIR, (req.body.path || '').replace(/\.\./g, ''));
    try {
        fs.writeFileSync(filePath, req.body.content || '');
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

const CRON_LOGS_FILE = path.join(__dirname, 'cron_logs.json');

app.get('/api/cron/logs', authenticateToken, (req, res) => {
    if (fs.existsSync(CRON_LOGS_FILE)) {
        try {
            const logs = JSON.parse(fs.readFileSync(CRON_LOGS_FILE, 'utf8'));
            res.json(logs);
        } catch (e) { res.json([]); }
    } else {
        res.json([]);
    }
});

function logCronExecution(taskName, status, message) {
    let logs = [];
    if (fs.existsSync(CRON_LOGS_FILE)) {
        try { logs = JSON.parse(fs.readFileSync(CRON_LOGS_FILE, 'utf8')); } catch (e) { }
    }
    logs.unshift({
        timestamp: Date.now(),
        task: taskName,
        status: status, // 'success', 'error', 'info'
        message: message
    });
    if (logs.length > 50) logs = logs.slice(0, 50);
    fs.writeFileSync(CRON_LOGS_FILE, JSON.stringify(logs, null, 2));
}

// Backups & Cron
app.get('/api/cron', authenticateToken, (req, res) => {
    if (fs.existsSync(CRON_FILE)) res.json(JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'))); else res.json([]);
});
app.post('/api/cron', authenticateToken, (req, res) => {
    fs.writeFileSync(CRON_FILE, JSON.stringify(req.body, null, 2));
    loadCronTasks();
    res.json({ success: true });
});

app.delete('/api/cron/:id', authenticateToken, (req, res) => {
    try {
        if (!fs.existsSync(CRON_FILE)) return res.json({ success: false });
        let tasks = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
        tasks = tasks.filter(t => t.id !== req.params.id);
        fs.writeFileSync(CRON_FILE, JSON.stringify(tasks, null, 2));
        loadCronTasks();
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});


function loadCronTasks() {
    // Stop existing tasks
    cronTasks.forEach(t => t.stop());
    cronTasks = [];

    if (!fs.existsSync(CRON_FILE)) return;
    try {
        const tasks = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
        tasks.forEach(task => {
            if (task.enabled && (task.schedule || task.expression)) {
                try {
                    const expr = task.schedule || task.expression;
                    if (!cron.validate(expr)) {
                        logCronExecution(task.name, 'error', `Invalid cron expression: ${expr}`);
                        return;
                    }

                    const job = cron.schedule(expr, async () => {
                        console.log(`[Cron] Executing: ${task.name}`);
                        logCronExecution(task.name, 'info', 'Started execution');
                        io.emit('toast', { type: 'info', msg: `⚙️ Cron: ${task.name}` });

                        try {
                            // Handle Internal Actions
                            if (task.action) {
                                if (task.action === 'restart') {
                                    await mcServer.restart();
                                    logCronExecution(task.name, 'success', 'Server restarted');
                                }
                                else if (task.action === 'stop') {
                                    await mcServer.stop();
                                    logCronExecution(task.name, 'success', 'Server stopped');
                                }
                                else if (task.action === 'start') {
                                    await mcServer.start();
                                    logCronExecution(task.name, 'success', 'Server started');
                                }
                                else if (task.action === 'backup') {
                                    const timestamp = Date.now();
                                    const name = `auto-${timestamp}.tar.gz`;
                                    exec(`tar -czf "${path.join(BACKUP_DIR, name)}" -C "${path.join(__dirname, 'servers')}" default`, (err) => {
                                        if (err) logCronExecution(task.name, 'error', 'Backup failed: ' + err.message);
                                        else logCronExecution(task.name, 'success', 'Backup created: ' + name);
                                    });
                                }
                                else if (task.action === 'prune') {
                                    // Delete backups older than 7 days
                                    const retentionDays = 7;
                                    const now = Date.now();
                                    let pruned = 0;
                                    if (fs.existsSync(BACKUP_DIR)) {
                                        fs.readdirSync(BACKUP_DIR).forEach(file => {
                                            if (file.endsWith('.tar.gz') || file.endsWith('.zip')) {
                                                const filePath = path.join(BACKUP_DIR, file);
                                                const stats = fs.statSync(filePath);
                                                const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
                                                if (ageDays > retentionDays) {
                                                    fs.unlinkSync(filePath);
                                                    pruned++;
                                                }
                                            }
                                        });
                                    }
                                    logCronExecution(task.name, 'success', `Pruned ${pruned} old backups`);
                                }
                            }

                            // Handle Console Commands
                            if (task.command) {
                                mcServer.sendCommand(task.command);
                                logCronExecution(task.name, 'success', `Command sent: ${task.command}`);
                            }
                        } catch (execErr) {
                            console.error(`[Cron] Error executing task ${task.name}:`, execErr);
                            logCronExecution(task.name, 'error', execErr.message);
                        }
                    });
                    cronTasks.push(job);
                } catch (err) {
                    console.error(`Invalid schedule for task ${task.name}: ${task.schedule}`);
                    logCronExecution(task.name, 'error', `Scheduling error: ${err.message}`);
                }
            }
        });
        console.log(`Loaded ${cronTasks.length} cron tasks.`);
    } catch (e) {
        console.error('Error loading cron tasks:', e);
    }
}
// Load tasks on startup
loadCronTasks();

// --- PLUGIN STORE ---
app.get('/api/plugins/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q;
        const response = await axios.get(`https://api.spiget.org/v2/search/resources/${query}?size=20&sort=-downloads`);
        const plugins = response.data.map(p => ({
            id: p.id,
            name: p.name,
            tag: p.tag,
            downloads: p.downloads,
            rating: p.rating ? p.rating.average : 0,
            icon: p.icon ? `https://www.spigotmc.org/${p.icon.url}` : null,
            testedVersions: p.testedVersions
        }));
        res.json({ plugins });
    } catch (e) { res.json({ plugins: [] }); }
});

// Search Mods (Modrinth)
app.get('/api/mods/search', authenticateToken, async (req, res) => {
    const query = req.query.q;
    try {
        // Search Modrinth API
        const response = await axios.get(`https://api.modrinth.com/v2/search?query=${query}&facets=[["project_type:mod"]]&limit=20`);

        const mods = response.data.hits.map(m => ({
            id: m.project_id, // Modrinth uses slug or project_id
            name: m.title,
            tag: m.description,
            downloads: m.downloads,
            rating: 5, // Modrinth doesn't give simple rating in search
            icon: m.icon_url,
            isMod: true,
            slug: m.slug
        }));
        res.json({ plugins: mods }); // Keep 'plugins' key for frontend compatibility or change logic
    } catch (e) {
        console.error("Modrinth Error:", e.message);
        res.json({ plugins: [] });
    }
});

app.post('/api/plugins/install', authenticateToken, async (req, res) => {
    const { id, version } = req.body;
    try {
        // Get download URL from Spigot API
        const response = await axios.get(`https://api.spiget.org/v2/resources/${id}/download`, { responseType: 'stream' });

        // Get generic info to name the file
        const info = await axios.get(`https://api.spiget.org/v2/resources/${id}`);
        const filename = `${info.data.name}.jar`;

        const pluginsDir = path.join(SERVER_DIR, 'plugins');
        if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });

        const writer = fs.createWriteStream(path.join(pluginsDir, filename));
        response.data.pipe(writer);

        writer.on('finish', () => res.json({ success: true }));
        writer.on('error', (e) => res.json({ success: false, error: e.message }));
    } catch (e) {
        console.error('Plugin install error:', e.message);
        res.json({ success: false, error: 'Failed to download plugin' });
    }
});

app.get('/api/plugins/installed', authenticateToken, (req, res) => {
    const pluginsDir = path.join(SERVER_DIR, 'plugins');
    if (!fs.existsSync(pluginsDir)) return res.json({ plugins: [] });

    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.jar')).map(f => ({
        name: f,
        size: (fs.statSync(path.join(pluginsDir, f)).size / 1024).toFixed(0) + ' KB'
    }));
    res.json({ plugins: files });
});

app.delete('/api/plugins/:name', authenticateToken, (req, res) => {
    try {
        const filePath = path.join(SERVER_DIR, 'plugins', req.params.name);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});


// --- WHITELIST MANAGER ---
app.get('/api/whitelist', authenticateToken, (req, res) => {
    const wlPath = path.join(SERVER_DIR, 'whitelist.json');

    // Check if whitelist is enabled in server.properties
    let enabled = false;
    try {
        const props = fs.readFileSync(path.join(SERVER_DIR, 'server.properties'), 'utf8');
        const match = props.match(/white-list=(true|false)/);
        if (match) enabled = match[1] === 'true';
    } catch (e) { }

    // Get whitelist players
    let players = [];
    if (fs.existsSync(wlPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(wlPath, 'utf8'));
            // Extract just the names from the array of {name, uuid} objects
            players = data.map(p => p.name);
        } catch { }
    }

    res.json({ enabled, players });
});

app.post('/api/whitelist', authenticateToken, (req, res) => {
    const { name, uuid } = req.body;
    const wlPath = path.join(SERVER_DIR, 'whitelist.json');
    let list = [];
    if (fs.existsSync(wlPath)) {
        try { list = JSON.parse(fs.readFileSync(wlPath, 'utf8')); } catch { }
    }

    // Check if exists
    if (list.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        return res.json({ success: false, error: 'Player already whitelisted' });
    }

    // Add new player (UUID should ideally be fetched from Mojang, but for now allow manual or blank)
    // If UUID is missing, maybe generate a dummy one or fetch it? 
    // Minecraft requires UUID. We'll use a placeholder if not provided, or let the server resolve it if running.
    // Ideally we should run `whitelist add name` if server is online.

    // For now, file manipulation:
    list.push({
        uuid: uuid || `offline-${Date.now()}`, // Fallback
        name: name
    });

    fs.writeFileSync(wlPath, JSON.stringify(list, null, 2));

    // If server is running, try to execute command
    // TODO: Integrating with RCON/Stdin would be better

    res.json({ success: true });
});

app.delete('/api/whitelist/:name', authenticateToken, (req, res) => {
    const name = req.params.name;
    const wlPath = path.join(SERVER_DIR, 'whitelist.json');
    if (!fs.existsSync(wlPath)) return res.json({ success: true });

    let list = [];
    try { list = JSON.parse(fs.readFileSync(wlPath, 'utf8')); } catch { }

    const newList = list.filter(p => p.name.toLowerCase() !== name.toLowerCase());
    fs.writeFileSync(wlPath, JSON.stringify(newList, null, 2));
    res.json({ success: true });
});

// Whitelist toggle endpoint
app.post('/api/whitelist/toggle', authenticateToken, (req, res) => {
    const { enabled } = req.body;
    try {
        const propsPath = path.join(SERVER_DIR, 'server.properties');
        if (!fs.existsSync(propsPath)) return res.json({ success: false, error: 'server.properties not found' });

        let props = fs.readFileSync(propsPath, 'utf8');
        props = props.replace(/white-list=(true|false)/, `white-list=${enabled}`);
        fs.writeFileSync(propsPath, props);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// Whitelist add endpoint
app.post('/api/whitelist/add', authenticateToken, (req, res) => {
    const { player } = req.body;
    const wlPath = path.join(SERVER_DIR, 'whitelist.json');
    let list = [];
    if (fs.existsSync(wlPath)) {
        try { list = JSON.parse(fs.readFileSync(wlPath, 'utf8')); } catch { }
    }

    // Check if exists
    if (list.find(p => p.name.toLowerCase() === player.toLowerCase())) {
        return res.json({ success: false, error: 'Player already whitelisted' });
    }

    // Add new player
    list.push({
        uuid: `offline-${Date.now()}`, // Fallback UUID
        name: player
    });

    fs.writeFileSync(wlPath, JSON.stringify(list, null, 2));
    res.json({ success: true });
});

// Whitelist remove endpoint  
app.post('/api/whitelist/remove', authenticateToken, (req, res) => {
    const { player } = req.body;
    const wlPath = path.join(SERVER_DIR, 'whitelist.json');
    if (!fs.existsSync(wlPath)) return res.json({ success: true });

    let list = [];
    try { list = JSON.parse(fs.readFileSync(wlPath, 'utf8')); } catch { }

    const newList = list.filter(p => p.name.toLowerCase() !== player.toLowerCase());
    fs.writeFileSync(wlPath, JSON.stringify(newList, null, 2));
    res.json({ success: true });
});

// --- WORLDS MANAGER ---
app.get('/api/worlds', authenticateToken, (req, res) => {
    try {
        // Get current world from server.properties
        let currentWorld = 'world';
        try {
            const props = fs.readFileSync(path.join(SERVER_DIR, 'server.properties'), 'utf8');
            const match = props.match(/level-name=(.+)/);
            if (match) currentWorld = match[1].trim();
        } catch (e) { }

        // List all world folders in the server directory
        const worlds = [];
        const entries = fs.readdirSync(SERVER_DIR, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const worldPath = path.join(SERVER_DIR, entry.name);
                // Check if it's a valid Minecraft world (has level.dat)
                const levelDatPath = path.join(worldPath, 'level.dat');
                if (fs.existsSync(levelDatPath)) {
                    const stats = fs.statSync(worldPath);
                    const size = getDirSize(worldPath);
                    worlds.push({
                        name: entry.name,
                        size: (size / 1024 / 1024).toFixed(2) + ' MB',
                        modified: stats.mtime.getTime()
                    });
                }
            }
        }

        res.json({ current: currentWorld, worlds });
    } catch (e) {
        console.error('Error loading worlds:', e);
        res.json({ current: 'world', worlds: [] });
    }
});

app.post('/api/worlds/activate', authenticateToken, (req, res) => {
    const { name } = req.body;
    try {
        const propsPath = path.join(SERVER_DIR, 'server.properties');
        if (!fs.existsSync(propsPath)) return res.json({ success: false, error: 'server.properties not found' });

        // Verify world exists
        const worldPath = path.join(SERVER_DIR, name);
        if (!fs.existsSync(worldPath) || !fs.existsSync(path.join(worldPath, 'level.dat'))) {
            return res.json({ success: false, error: 'World not found' });
        }

        let props = fs.readFileSync(propsPath, 'utf8');
        props = props.replace(/level-name=.+/, `level-name=${name}`);
        fs.writeFileSync(propsPath, props);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/worlds/create', authenticateToken, (req, res) => {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
        return res.json({ success: false, error: 'World name is required' });
    }

    try {
        const worldPath = path.join(SERVER_DIR, name.trim());
        if (fs.existsSync(worldPath)) {
            return res.json({ success: false, error: 'World already exists' });
        }

        // Create world directory - server will generate it on next start
        fs.mkdirSync(worldPath, { recursive: true });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// --- BACKUP MANAGER ENHANCED ---
const AdmZip = require('adm-zip');

app.get('/api/backups', authenticateToken, (req, res) => {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip'))
        .map(f => {
            const stats = fs.statSync(path.join(BACKUP_DIR, f));
            return {
                name: f,
                size: (stats.size / 1048576).toFixed(2) + ' MB',
                created: stats.birthtime,
                description: undefined // We could store metadata in a separate JSON if needed, for now filesystem only
            };
        });
    res.json(backups.sort((a, b) => b.created - a.created));
});

app.post('/api/backups/create', authenticateToken, async (req, res) => {
    const { name, type, description } = req.body;
    const timestamp = Date.now();
    const safeName = name ? name.replace(/[^a-zA-Z0-9-]/g, '') : `backup-${timestamp}`;
    const ext = type === 'zip' ? '.zip' : '.tar.gz';
    const filename = `${safeName}${ext}`;
    const targetPath = path.join(BACKUP_DIR, filename);

    try {
        if (type === 'zip') {
            const zip = new AdmZip();
            // Add all files from SERVER_DIR, excluding big folders if needed? No, user wants full backup.
            zip.addLocalFolder(SERVER_DIR);
            // If we had a metadata system, we'd save description here.
            // For now, simple implementation.
            zip.writeZip(targetPath);
            res.json({ success: true, name: filename });
        } else {
            const cmd = `tar -czf "${targetPath}" -C "${path.join(__dirname, 'servers')}" default`;
            exec(cmd, (err) => {
                if (err) return res.json({ success: false, error: err.message });
                res.json({ success: true, name: filename });
            });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/backups/delete', authenticateToken, (req, res) => {
    try {
        fs.unlinkSync(path.join(BACKUP_DIR, req.body.name));
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/backups/restore', authenticateToken, async (req, res) => {
    await mcServer.stop();
    // Cross-platform restore
    try {
        // Clear directory
        if (fs.existsSync(SERVER_DIR)) {
            fs.rmSync(SERVER_DIR, { recursive: true, force: true });
            fs.mkdirSync(SERVER_DIR, { recursive: true });
        }

        // Extract
        const tarCmd = IS_WIN ?
            `tar -xzf "${path.join(BACKUP_DIR, req.body.name)}" -C "${path.join(__dirname, 'servers')}"` :
            `tar -xzf "${path.join(BACKUP_DIR, req.body.name)}" -C "${path.join(__dirname, 'servers')}"`;

        exec(tarCmd, (e) => res.json({ success: !e }));
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
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

// --- VERSIONS MANAGEMENT (Keep Existing) ---

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

        // Save JWT secret if provided
        if (newSettings.jwt_secret) updatedSettings.jwt_secret = newSettings.jwt_secret;

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

// --- INTEGRATIONS (DISCORD WEBHOOK) ---
app.post('/api/integrations/discord', authenticateToken, (req, res) => {
    try {
        const { url, events } = req.body;
        let currentSettings = {};
        if (fs.existsSync(SETTINGS_FILE)) {
            currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
        currentSettings.discord = { url, events };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/integrations/discord', authenticateToken, (req, res) => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            res.json(settings.discord || {});
        } else {
            res.json({});
        }
    } catch (e) { res.json({}); }
});

function sendDiscordWebhook(event, message) {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    try {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        if (settings.discord && settings.discord.url && settings.discord.events && settings.discord.events[event]) {
            axios.post(settings.discord.url, {
                content: null,
                embeds: [{
                    title: `Server ${event === 'start' ? 'Started' : event === 'stop' ? 'Stopped' : 'Notification'}`,
                    description: message,
                    color: event === 'start' ? 5763719 : event === 'stop' ? 15548997 : 3447003
                }]
            }).catch(err => console.error('Discord Webhook Error:', err.message));
        }
    } catch (e) { console.error('Discord Error:', e); }
}

// Hook into MCManager events (Simplified injection)
const originalStart = mcServer.start;
mcServer.start = async () => {
    await originalStart.call(mcServer);
    sendDiscordWebhook('start', 'The server is now online!');
};
const originalStop = mcServer.stop;
mcServer.stop = async () => {
    await originalStop.call(mcServer);
    sendDiscordWebhook('stop', 'The server has stopped.');
};

// --- WORLD MANAGER ---
app.get('/api/worlds', authenticateToken, (req, res) => {
    try {
        let currentWorld = 'world';
        if (fs.existsSync(path.join(SERVER_DIR, 'server.properties'))) {
            const props = fs.readFileSync(path.join(SERVER_DIR, 'server.properties'), 'utf8');
            const match = props.match(/level-name=(.+)/);
            if (match) currentWorld = match[1].trim();
        }

        const worlds = fs.readdirSync(SERVER_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory() && fs.existsSync(path.join(SERVER_DIR, d.name, 'level.dat')))
            .map(d => {
                const wPath = path.join(SERVER_DIR, d.name);
                const stats = fs.statSync(wPath);
                return {
                    name: d.name,
                    size: (getDirSize(wPath) / (1024 * 1024)).toFixed(2) + ' MB',
                    modified: stats.mtimeMs
                };
            });

        res.json({ current: currentWorld, worlds });
    } catch (e) { res.json({ current: 'Unknown', worlds: [] }); }
});

app.post('/api/worlds/activate', authenticateToken, (req, res) => {
    const { name } = req.body;
    try {
        let props = fs.readFileSync(path.join(SERVER_DIR, 'server.properties'), 'utf8');
        props = props.replace(/level-name=.+/, `level-name=${name}`);
        fs.writeFileSync(path.join(SERVER_DIR, 'server.properties'), props);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/worlds/create', authenticateToken, (req, res) => {
    // Just creates a folder, server will generate level.dat on load if configured
    // Actually, we usually just set level-name to a new one and restart.
    const { name } = req.body;
    try {
        const target = path.join(SERVER_DIR, name);
        if (!fs.existsSync(target)) fs.mkdirSync(target);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// --- UPDATED STATS ---
// --- UPDATED STATS ---
let lastNetIn = 0;
let lastNetOut = 0;
// Basic pseudo-TPS tracking from logs or simple placeholder since we can't query server directly easily without RCON/Query
// Real implementation would parse 'Can't keep up' logs or use RCON 'tps' command.
let estimatedTPS = 20.0;

// --- UPDATED STATS ---
const si = require('systeminformation');

let lastNetTransferred = { result: 0, time: Date.now() };

async function sendStats(cpuPercent, diskBytes, res) {
    try {
        const [mem, currentLoad, netStats, fsSize, disksIO] = await Promise.all([
            si.mem(),
            si.currentLoad(),
            si.networkStats(),
            si.fsSize(),
            si.disksIO()
        ]);

        // Network I/O (Sum of all interfaces)
        let netIn = 0;
        let netOut = 0;
        if (netStats && netStats.length) {
            netStats.forEach(iface => {
                netIn += iface.rx_sec;
                netOut += iface.tx_sec;
            });
            // Convert to KB/s
            netIn = (netIn / 1024).toFixed(1);
            netOut = (netOut / 1024).toFixed(1);
        }

        // Disk (Root or specific drive)
        const drive = fsSize.find(d => d.mount === '/' || d.mount === 'C:') || fsSize[0];
        const totalDisk = drive ? drive.size : (20 * 1024 * 1024 * 1024);
        const usedDisk = diskBytes; // Use server folder size

        // Disk IO
        let diskRead = 0;
        let diskWrite = 0;
        if (disksIO) {
            diskRead = (disksIO.rIO_sec / 1024).toFixed(1); // KB/s
            diskWrite = (disksIO.wIO_sec / 1024).toFixed(1); // KB/s
        }

        res.json({
            cpu: currentLoad.currentLoad.toFixed(1),
            cpu_freq: 0, // Not critical
            ram_total: mem.total,
            ram_free: mem.free,
            ram_used: mem.active,
            disk_used: usedDisk,
            disk_total: totalDisk,
            disk_io: { read: diskRead, write: diskWrite },
            uptime: os.uptime(),
            node_version: process.version,
            os_platform: os.platform() + ' ' + os.release(),
            cpu_cores: os.cpus().length,
            network: { in: netIn, out: netOut },
            tps: estimatedTPS,
            players: 0 // Placeholder
        });
    } catch (e) {
        console.error('Stats Error:', e);
        // Fallback if systeminformation fails
        res.json({
            cpu: 0,
            ram_total: 0,
            ram_used: 0,
            disk_used: 0,
            disk_total: 0,
            disk_io: { read: 0, write: 0 },
            network: { in: 0, out: 0 },
            tps: 20
        });
    }
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
// Install Mod (Modrinth)
// Install Mod (Modrinth)
app.post('/api/mods/install', authenticateToken, async (req, res) => {
    const { id } = req.body;
    try {
        // 1. Get versions list for this project
        const versionsResp = await axios.get(`https://api.modrinth.com/v2/project/${id}/version`);
        const versions = versionsResp.data;

        if (!versions || versions.length === 0) {
            return res.status(404).json({ success: false, message: 'No versions found for this mod' });
        }

        // 2. Pick latest version (first in list usually)
        const latestVersion = versions[0];

        // 3. Get the primary file
        const file = latestVersion.files.find(f => f.primary) || latestVersion.files[0];

        if (!file) {
            return res.status(404).json({ success: false, message: 'No file found in version' });
        }

        const filename = file.filename;
        const downloadUrl = file.url;

        // 4. Ensure mods directory exists
        const modsDir = path.join(SERVER_DIR, 'mods');
        if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

        // 5. Download
        const writer = fs.createWriteStream(path.join(modsDir, filename));
        const downloadResp = await axios.get(downloadUrl, { responseType: 'stream' });

        downloadResp.data.pipe(writer);

        writer.on('finish', () => {
            res.json({ success: true, message: `Mod ${filename} installed via Modrinth!` });
        });

        writer.on('error', (err) => {
            console.error('File write error:', err);
            res.status(500).json({ success: false, message: 'Failed to save mod file' });
        });

    } catch (e) {
        console.error('Mod installation failed:', e.message);
        res.status(500).json({ success: false, message: 'Mod install failed: ' + e.message });
    }
});

// Activate World (Switch Level)
app.post('/api/worlds/activate', authenticateToken, (req, res) => {
    const { worldName } = req.body;
    if (!worldName) return res.status(400).json({ success: false, message: 'World name required' });

    const propsFile = path.join(SERVER_DIR, 'server.properties');
    if (fs.existsSync(propsFile)) {
        let props = fs.readFileSync(propsFile, 'utf8');
        // Replace level-name
        if (props.match(/level-name=/)) {
            props = props.replace(/level-name=.+/, `level-name=${worldName}`);
        } else {
            props += `\nlevel-name=${worldName}`;
        }
        fs.writeFileSync(propsFile, props);
        res.json({ success: true, message: `World changed to ${worldName}. Restart server to apply.` });
    } else {
        res.status(404).json({ success: false, message: 'server.properties not found' });
    }
});
// --- PERFORMANCE HISTORY ---
const STATS_HISTORY_FILE = path.join(__dirname, 'stats_history.json');
let statsHistory = [];

// Load history on startup
if (fs.existsSync(STATS_HISTORY_FILE)) {
    try { statsHistory = JSON.parse(fs.readFileSync(STATS_HISTORY_FILE, 'utf8')); } catch (e) { }
}

async function recordStats() {
    try {
        const [currentLoad, mem] = await Promise.all([
            si.currentLoad(),
            si.mem()
        ]);

        const statEntry = {
            timestamp: Date.now(),
            cpu: currentLoad.currentLoad.toFixed(1),
            ram_used: mem.active,
            ram_total: mem.total
        };

        statsHistory.push(statEntry);

        // Keep last 24 hours (assuming 1 min interval = 1440 entries)
        if (statsHistory.length > 1440) {
            statsHistory = statsHistory.slice(-1440);
        }

        // Save to file (throttled? or every time?)
        // Every time is fine for low frequency (1 min)
        fs.writeFileSync(STATS_HISTORY_FILE, JSON.stringify(statsHistory));

    } catch (e) {
        console.error('Error recording stats:', e);
    }
}

// Record stats every minute
setInterval(recordStats, 60 * 1000); // 1 minute
// Also record one immediately on startup
recordStats();

app.get('/api/stats/history', authenticateToken, (req, res) => {
    res.json(statsHistory);
});

// --- SYSTEM UPDATE MANAGER ---

// Check for updates
app.get('/api/update/:type', authenticateToken, async (req, res) => {
    const { type } = req.params; // 'ui' or 'system'
    try {
        // Fetch remote package.json to compare versions
        // Using raw content from the stable repo
        const remotePkgUrl = 'https://raw.githubusercontent.com/femby08/aether-panel/main/package.json';
        const response = await axios.get(remotePkgUrl);
        const remoteVersion = response.data.version;
        
        const localPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        const localVersion = localPkg.version;

        // Simple semver comparison (very basic)
        const updateAvailable = remoteVersion !== localVersion;

        res.json({
            available: updateAvailable,
            version: remoteVersion,
            current: localVersion
        });
    } catch (e) {
        console.error('Update check failed:', e.message);
        res.status(500).json({ error: 'Failed to check for updates' });
    }
});

// Install UI Update (Only public folder)
app.post('/api/update/ui/install', authenticateToken, async (req, res) => {
    const REPO_ZIP = "https://github.com/femby08/aether-panel/archive/refs/heads/main.zip";
    const TEMP_DIR = path.join(os.tmpdir(), `aether_ui_update_${Date.now()}`);
    
    try {
        // 1. Download Zip
        if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
        const writer = fs.createWriteStream(path.join(TEMP_DIR, 'update.zip'));
        const response = await axios.get(REPO_ZIP, { responseType: 'stream' });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 2. Extract
        const zip = new AdmZip(path.join(TEMP_DIR, 'update.zip'));
        zip.extractAllTo(TEMP_DIR, true);

        // 3. Find source folder (usually aether-panel-main)
        const entries = fs.readdirSync(TEMP_DIR);
        const sourceDir = entries.find(e => e.startsWith('aether-panel-'));
        if (!sourceDir) throw new Error('Invalid zip structure');

        const publicSource = path.join(TEMP_DIR, sourceDir, 'public');
        const publicDest = path.join(__dirname, 'public');

        // 4. Replace public folder
        // We can't easily rm -rf in node without extra libs or recursive, 
        // but let's try to overwrite files. Ideally we should clean specific old files.
        // For 'Reload web' style, we just overwrite.
        
        // Helper to copy recursively
        function copyRecursiveSync(src, dest) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest);
            fs.readdirSync(src).forEach(child => {
                const srcPath = path.join(src, child);
                const destPath = path.join(dest, child);
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    copyRecursiveSync(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            });
        }

        copyRecursiveSync(publicSource, publicDest);

        // Cleanup
        try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch(e){}

        res.json({ success: true });

    } catch (e) {
        console.error('UI Update failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Install System Update (Full + Restart)
app.post('/api/update/system/install', authenticateToken, (req, res) => {
    try {
        const isWin = process.platform === 'win32';
        const script = isWin ? 'updater.bat' : 'updater.sh';
        const scriptPath = path.join(__dirname, script);

        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({ success: false, error: 'Updater script not found' });
        }

        // Spawn detached process
        const child = require('child_process').spawn(
            isWin ? 'cmd.exe' : 'bash',
            isWin ? ['/c', script] : [script],
            {
                cwd: __dirname,
                detached: true,
                stdio: 'ignore'
            }
        );

        child.unref();

        // Respond then exit
        res.json({ success: true, message: 'Server restarting...' });
        
        // Give time for response to flush
        setTimeout(() => {
            process.exit(0);
        }, 1000);

    } catch (e) {
        console.error('System Update failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
