let socket = null;
let currentPath = '';
let selectedVerData = null;
let cronTasks = [];
let editingDashboard = false;
let currentBackupToRestore = null;
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// ===== PERMISSION SYSTEM =====
// ===== PERMISSION SYSTEM =====
function hasPermission(permission) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true; // Admins have all permissions
    return currentUser.permissions && currentUser.permissions.includes(permission);
}

function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

function applyPermissions() {
    // Hide/disable UI elements based on permissions
    const permissionMap = {
        'start': ['.power-btn-large.start', '.btn-control.start', '[onclick*="power/start"]'],
        'stop': ['.power-btn-large.stop', '.btn-control.stop', '[onclick*="power/stop"]'],
        'restart': ['.power-btn-large.restart', '.btn-control.restart', '[onclick*="power/restart"]'],
        'kill': ['.power-btn-large.kill', '.btn-control.kill', '[onclick*="power/kill"]'],
        'console': ['[onclick*="setTab(\'console\')"]', '.nav-btn[onclick*="console"]'],
        'files': ['[onclick*="setTab(\'files\')"]', '.nav-btn[onclick*="files"]'],
        'config': ['[onclick*="setTab(\'config\')"]', '.nav-btn[onclick*="config"]'],
        'backups': ['[onclick*="setTab(\'backups\')"]', '.nav-btn[onclick*="backups"]'],
        'whitelist': ['[onclick*="setTab(\'whitelist\')"]', '.nav-btn[onclick*="whitelist"]'],
        'versions': ['[onclick*="setTab(\'versions\')"]', '.nav-btn[onclick*="versions"]']
    };

    // Apply permissions
    Object.keys(permissionMap).forEach(perm => {
        const allowed = hasPermission(perm);
        permissionMap[perm].forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (!allowed) {
                    el.style.display = 'none'; // Hide completely // !important? inline style is strong enough usually
                } else {
                    el.style.display = ''; // Show
                }
            });
        });
    });

    // Handle Labs Tab visibility (Show if any lab feature is allowed)
    const labsAllowed = hasPermission('files') || hasPermission('backups') || hasPermission('scheduler') || hasPermission('logs');
    document.querySelectorAll('[onclick*="setTab(\'labs\')"], .nav-btn[onclick*="labs"]').forEach(el => {
        el.style.display = labsAllowed ? '' : 'none';
    });

    // Hide user management for non-admins
    const userManagementSection = document.getElementById('user-management-section');
    if (userManagementSection) {
        userManagementSection.style.display = isAdmin() ? '' : 'none';
    }

    // Update command palette to only show allowed commands
    // This function is not provided in the snippet, assuming it exists elsewhere or is a placeholder.
    if (typeof updateCommandPalettePermissions === 'function') {
        updateCommandPalettePermissions();
    }
}

// --- AUTENTICACIÓN SIMPLIFICADA ---
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Esta función maneja tanto el Setup como el Login normal
async function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('login-btn-submit');
    const isSetup = btn.dataset.mode === 'setup';

    const username = usernameInput.value;
    const password = passwordInput.value;

    errorDiv.style.display = 'none';

    try {
        const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (!result.success) {
            errorDiv.innerText = result.error || 'Error de autenticación';
            errorDiv.style.display = 'block';
            return;
        }

        // Guardar token y usuario
        localStorage.setItem('authToken', result.token);
        authToken = result.token;
        currentUser = {
            username: result.username,
            role: result.role || 'admin',
            permissions: result.permissions || []
        };

        // Apply permissions immediately
        applyPermissions();

        // Inicializar socket con token
        socket = io({ auth: { token: result.token } });

        // Ocultar login y mostrar app
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';

        initializeApp();

        Toastify({
            text: isSetup ? "¡Panel configurado correctamente!" : "Sesión iniciada",
            style: { background: "#10b981" }
        }).showToast();

    } catch (error) {
        errorDiv.innerText = 'Error de conexión: ' + error.message;
        errorDiv.style.display = 'block';
    }
}
// Toggle Password Visibility
function togglePassword() {
    const p = document.getElementById('login-password');
    const b = document.getElementById('toggle-pass-btn');
    if (p.type === 'password') {
        p.type = 'text';
        b.innerText = 'Hide';
    } else {
        p.type = 'password';
        b.innerText = 'Show';
    }
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    location.reload(); // Recargar para volver a comprobar estado
}

// Verificar autenticación y estado del servidor al cargar
async function checkAuth() {
    // 1. Comprobar si el servidor necesita Setup
    try {
        const statusReq = await fetch('/api/auth/status');
        const status = await statusReq.json();

        if (status.setupRequired) {
            // MOSTRAR PANTALLA DE SETUP
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('main-app').style.display = 'none';

            document.getElementById('login-title').innerText = "CONFIGURACIÓN INICIAL";
            document.getElementById('login-subtitle').innerText = "Crea tu cuenta de administrador";
            document.getElementById('login-btn-submit').innerHTML = 'CREAR CUENTA <i class="fa-solid fa-check"></i>';
            document.getElementById('login-btn-submit').dataset.mode = 'setup';
            return false;
        }
    } catch (e) {
        console.error("Error conectando con servidor", e);
        return false;
    }

    // 2. Si no requiere setup, comprobar si tenemos token válido
    if (!authToken) {
        showLoginScreen();
        return false;
    }

    try {
        const response = await fetch('/api/auth/check', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            localStorage.removeItem('authToken');
            showLoginScreen();
            return false;
        }

        const result = await response.json();
        currentUser = result.user;

        // Apply permissions after loading user
        applyPermissions();

        // 3. El usuario ya está autenticado, ocultar login y mostrar app
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';

        // 4. Actualizar vista con nombre
        document.getElementById('account-current-username').innerText = currentUser.username;
        document.getElementById('account-display').innerText = currentUser.username;

        initializeApp();
        return true;
    } catch (error) {
        localStorage.removeItem('authToken');
        showLoginScreen();
        return false;
    }
}

function showLoginScreen() {
    // Hide all overlays/modals that might be open
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');

    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';

    document.getElementById('login-title').innerHTML = 'AETHER PANEL <span id="login-version" style="opacity: 0.5; font-size: 0.6em;"></span>';
    // Re-fetch version to ensure it appears if this is called after load
    fetch('/api/version').then(r => r.json()).then(d => {
        const el = document.getElementById('login-version');
        if (el) el.innerText = d.version;
    }).catch(() => { });

    document.getElementById('login-subtitle').innerText = "Acceso Administrativo";
    document.getElementById('login-btn-submit').innerText = 'LOGIN';
    document.getElementById('login-btn-submit').dataset.mode = 'login';
}

function initializeApp() {
    // Update sidebar username
    updateSidebarUsername();

    // Inicializar socket listeners
    if (socket) {
        socket.on('connect_error', (error) => {
            if (error.message.includes('Token')) logout();
        });

        socket.on('logs_history', (data) => {
            if (term) {
                term.write(data);
                setTimeout(() => fitAddon?.fit(), 200);
            }
        });

        socket.on('status_change', (status) => {
            const w = document.getElementById('status-widget');
            if (w) {
                w.className = 'status-widget ' + status;
                document.getElementById('status-text').innerText = status;
            }
        });

        socket.on('console_data', (data) => {
            if (term) term.write(data);
        });

        socket.on('toast', (data) => {
            Toastify({
                text: data.msg,
                duration: 4000,
                style: {
                    background: data.type === 'success' ? '#10b981' : data.type === 'error' ? '#ef4444' : '#8b5cf6'
                }
            }).showToast();
        });
    }

    loadInitialData();
}

function loadInitialData() {
    fetch('/api/info', { headers: getAuthHeaders() }).then(r => r.json()).then(d => {
        const sb = document.getElementById('sidebar-version-text');
        if (sb) sb.innerText = 'V' + (d.version || '1.7.0');
    }).catch(() => { });

    fetch('/api/network', { headers: getAuthHeaders() }).then(r => r.json()).then(d => {
        const ipElem = document.getElementById('server-ip-display');
        if (ipElem) {
            const val = d.custom_domain ? `${d.custom_domain}:${d.port}` : `${d.ip}:${d.port}`;
            ipElem.innerText = val;
            ipElem.dataset.fullIp = val;
        }
    }).catch(() => { });

    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedDesign = localStorage.getItem('design_mode') || 'glass';
    updateThemeUI(savedTheme);
    setDesign(savedDesign);

    // Apply saved sidebar state
    const sidebarCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (sidebarCollapsed) {
        document.querySelector('.sidebar').classList.add('collapsed');
    }

    if (document.getElementById('terminal')) initializeTerminal();
    if (document.getElementById('cpuChart')) initializeCharts();
}

// Sidebar Toggle Logic
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    }
}

// Keyboard Shortcut for Sidebar
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        toggleSidebar();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Migrate old Nether/End themes to Dark
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'nether' || savedTheme === 'end') {
        localStorage.setItem('theme', 'dark');
    }

    // Apply saved theme
    const theme = localStorage.getItem('theme') || 'dark';
    const design = localStorage.getItem('design_mode') || 'glass';
    updateThemeUI(theme);
    setDesign(design);
    applyThemeToLogin(theme);

    // Apply saved accent color
    const accentColor = localStorage.getItem('accent_color');
    if (accentColor) {
        setAccentColor(accentColor);
    }

    // Apply custom background if exists
    const customBg = localStorage.getItem('custom_background');
    if (customBg) {
        applyBackground(customBg);
    }

    // Apply solid color background if exists
    const solidColor = localStorage.getItem('solid_color');
    if (solidColor && !customBg) {
        const colorSpace = localStorage.getItem('solid_color_space') || 'srgb';
        const adaptiveTheme = localStorage.getItem('adaptive_theme') === 'true';

        // Set UI values
        const colorInput = document.getElementById('solid-color-input');
        const colorPicker = document.getElementById('solid-color-picker');
        const colorSpaceSelect = document.getElementById('color-space-select');
        const adaptiveToggle = document.getElementById('adaptive-theme-toggle');

        if (colorInput) colorInput.value = solidColor;
        if (colorPicker) colorPicker.value = solidColor;
        if (colorSpaceSelect) colorSpaceSelect.value = colorSpace;
        if (adaptiveToggle) adaptiveToggle.checked = adaptiveTheme;

        // Apply the solid color
        const rgb = hexToRgb(solidColor);
        if (rgb) {
            let colorValue;
            if (colorSpace === 'display-p3') {
                const r = rgb.r / 255;
                const g = rgb.g / 255;
                const b = rgb.b / 255;
                colorValue = `color(display-p3 ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)})`;
            } else if (colorSpace === 'rec2020') {
                const r = rgb.r / 255;
                const g = rgb.g / 255;
                const b = rgb.b / 255;
                colorValue = `color(rec2020 ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)})`;
            } else {
                colorValue = solidColor;
            }

            document.body.style.backgroundColor = colorValue;

            if (adaptiveTheme) {
                generateAdaptiveTheme(rgb);
            }
        }
    }

    checkAuth();
});

// --- FUNCIONES UI Y DASHBOARD ---

function api(ep, body, method = 'POST') {
    return fetch('/api/' + ep, {
        method: method,
        headers: getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined
    })
        .then(async r => {
            if (r.status === 401 || r.status === 403) {
                logout();
                throw new Error('No autorizado');
            }
            return r.json();
        })
        .catch(err => {
            console.error("API Error:", err);
            throw err;
        });
}

function copyIP() {
    const ip = document.getElementById('server-ip-display').dataset.fullIp;
    navigator.clipboard.writeText(ip).then(() => Toastify({ text: '¡IP Copiada!', style: { background: '#10b981' } }).showToast());
}

function setTab(t, btn) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));

    const target = document.getElementById('tab-' + t);
    if (target) target.classList.add('active');

    if (btn) btn.classList.add('active');
    else {
        const autoBtn = document.querySelector(`.nav-btn[onclick*="'${t}'"]`);
        if (autoBtn) autoBtn.classList.add('active');
    }

    // Update page title dynamically
    const titleMap = {
        'stats': 'Monitor de Rendimiento',
        'console': 'Consola del Servidor',
        'versions': 'Selector de Núcleo',
        'labs': 'Aether Labs',
        'config': 'Configuración del Servidor',
        'files': 'Administrador de Archivos',
        'backups': 'Copias de Seguridad',
        'whitelist': 'Gestión de Whitelist',
        'scheduler': 'Programador de Tareas',
        'logs': 'Visor de Logs'
    };

    const headerTitle = document.querySelector('.server-title h1');
    if (headerTitle && titleMap[t]) {
        headerTitle.textContent = titleMap[t];
    }

    if (t === 'console') setTimeout(() => { if (fitAddon) fitAddon.fit(); document.getElementById('console-input')?.focus(); }, 100);
    if (t === 'files') loadFileBrowser('');
    if (t === 'config') loadCfg();
    if (t === 'backups') loadBackups();
    if (t === 'scheduler') loadCronTasks();
    if (t === 'whitelist') loadWhitelist();
    if (t === 'logs') loadLogs();

    // Labs Tabs
    if (t === 'plugins') loadPlugins();
    if (t === 'performance-lab') initPerfCharts();
    if (t === 'rcon') loadRcon();
    if (t === 'worlds') loadWorlds();
    if (t === 'discord-integration') loadDiscordSettings();
}

let term = null;
let fitAddon = null;

function initializeTerminal() {
    if (!document.getElementById('terminal')) return;
    if (term) return; // Evitar doble inicialización

    term = new Terminal({ fontFamily: 'JetBrains Mono, monospace', theme: { background: '#00000000' }, fontSize: 13, cursorBlink: true, convertEol: true });
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');

    term.onData(d => {
        if (socket) socket.emit('command', d);
    });

    window.addEventListener('resize', () => {
        if (document.getElementById('tab-console') && document.getElementById('tab-console').classList.contains('active')) {
            if (fitAddon) fitAddon.fit();
        }
    });
}

function sendConsoleCommand() {
    const i = document.getElementById('console-input');
    if (i && i.value.trim() && socket) {
        socket.emit('command', i.value);
        i.value = '';
    }
}

let cpuChart, ramChart, diskChart;

function initializeCharts() {
    if (!document.getElementById('cpuChart')) return;
    if (cpuChart) return;

    cpuChart = new Chart(document.getElementById('cpuChart').getContext('2d'), { type: 'line', data: { labels: Array(20).fill(''), datasets: [{ data: Array(20).fill(0), borderColor: '#8b5cf6', backgroundColor: '#8b5cf615', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, scales: { x: { display: false }, y: { min: 0, max: 100, grid: { display: false }, ticks: { display: false } } }, plugins: { legend: { display: false } } } });
    ramChart = new Chart(document.getElementById('ramChart').getContext('2d'), { type: 'line', data: { labels: Array(20).fill(''), datasets: [{ data: Array(20).fill(0), borderColor: '#3b82f6', backgroundColor: '#3b82f615', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, scales: { x: { display: false }, y: { min: 0, grid: { display: false }, ticks: { display: false } } }, plugins: { legend: { display: false } } } });
    diskChart = new Chart(document.getElementById('diskChart').getContext('2d'), { type: 'line', data: { labels: Array(20).fill(''), datasets: [{ data: Array(20).fill(0), borderColor: '#10b981', backgroundColor: '#10b98115', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, scales: { x: { display: false }, y: { min: 0, grid: { display: false }, ticks: { display: false } } }, plugins: { legend: { display: false } } } });

    setInterval(() => {
        if (!authToken) return;
        fetch('/api/stats', { headers: getAuthHeaders() }).then(r => r.json()).then(d => {
            if (cpuChart && ramChart && diskChart) {
                const cpuVal = parseFloat(d.cpu);
                cpuChart.data.datasets[0].data.shift();
                cpuChart.data.datasets[0].data.push(cpuVal);
                cpuChart.update();
                document.getElementById('cpu-val').innerText = cpuVal.toFixed(1) + '%';

                const ramTotalGB = parseFloat((d.ram_total / 1073741824).toFixed(1));
                const ramUsedGB = parseFloat((d.ram_used / 1073741824).toFixed(1));

                ramChart.options.scales.y.max = ramTotalGB;
                ramChart.data.datasets[0].data.shift();
                ramChart.data.datasets[0].data.push(ramUsedGB);
                ramChart.update();
                document.getElementById('ram-val').innerText = `${ramUsedGB} / ${ramTotalGB} GB`;

                // Disk Usage Formatting (MB/GB)
                const diskUsedMB = d.disk_used / 1048576;
                let diskDisplay;
                if (diskUsedMB > 1024) {
                    diskDisplay = (diskUsedMB / 1024).toFixed(2) + ' GB';
                } else {
                    diskDisplay = diskUsedMB.toFixed(0) + ' MB';
                }
                document.getElementById('disk-val').innerText = diskDisplay;
                document.getElementById('disk-fill').style.width = Math.min((d.disk_used / d.disk_total) * 100, 100) + '%';

                // Disk Activity Chart (Read + Write)
                const readKB = parseFloat(d.disk_io ? d.disk_io.read : 0);
                const writeKB = parseFloat(d.disk_io ? d.disk_io.write : 0);
                const totalActivity = readKB + writeKB;

                diskChart.data.datasets[0].data.shift();
                diskChart.data.datasets[0].data.push(totalActivity);
                diskChart.update();

                document.getElementById('disk-read').innerText = readKB + ' KB/s';
                document.getElementById('disk-write').innerText = writeKB + ' KB/s';
            }
        }).catch(() => { });
    }, 1000);
}

function setTheme(mode) {
    localStorage.setItem('theme', mode);
    updateThemeUI(mode);
    applyThemeToLogin(mode);
}

function updateThemeUI(mode) {
    let apply = mode;
    if (mode === 'auto') {
        apply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', apply);

    // Update theme buttons
    document.querySelectorAll('[id^="theme-btn-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`theme-btn-${mode}`);
    if (btn) btn.classList.add('active');

    // Update terminal theme
    if (term) {
        if (apply === 'light') {
            term.options.theme = { foreground: '#334155', background: '#ffffff', cursor: '#334155' };
        } else if (apply === 'amoled') {
            term.options.theme = { foreground: '#ffffff', background: '#000000', cursor: '#ffffff' };
        } else {
            term.options.theme = { foreground: '#ffffff', background: 'transparent', cursor: '#ffffff' };
        }
    }
}

function applyThemeToLogin(mode) {
    // Apply theme immediately to login screen as well
    let apply = mode;
    if (mode === 'auto') {
        apply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', apply);
}

function setDesign(mode) {
    document.documentElement.setAttribute('data-design', mode);
    localStorage.setItem('design_mode', mode);
    document.getElementById('modal-btn-glass')?.classList.toggle('active', mode === 'glass');
    document.getElementById('modal-btn-material')?.classList.toggle('active', mode === 'material');

    // Toggle glass blur control visibility
    const glassBlurControl = document.getElementById('glass-blur-control');
    if (glassBlurControl) {
        glassBlurControl.style.display = mode === 'glass' ? 'flex' : 'none';
    }
}

function setAccentColor(color) {
    document.documentElement.style.setProperty('--p', color);
    document.documentElement.style.setProperty('--p-light', color + '80');
    document.documentElement.style.setProperty('--p-dark', color);
    localStorage.setItem('accent_color', color);
}

function setAccentMode(mode) {
    if (mode === 'auto') {
        setAccentColor('#8b5cf6');
        localStorage.removeItem('accent_color');
    }
}

// Custom Background Functions
function uploadBackground(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const imageData = e.target.result;
        localStorage.setItem('custom_background', imageData);
        applyBackground(imageData);
        Toastify({
            text: "Fondo personalizado aplicado",
            style: { background: "#10b981" }
        }).showToast();
    };
    reader.readAsDataURL(file);
}

function removeBackground() {
    localStorage.removeItem('custom_background');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    Toastify({
        text: "Fondo personalizado eliminado",
        style: { background: "#10b981" }
    }).showToast();
}

function applyBackground(imageData) {
    if (imageData) {
        document.body.style.backgroundImage = `url(${imageData})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }
}

// Update System Functions
function updateUI() {
    document.getElementById('appearance-modal').style.display = 'none';
    const statusMsg = document.getElementById('update-status-msg');

    // Feedback visual inmediato
    Toastify({
        text: "Buscando actualizaciones de UI...",
        duration: 2000,
        gravity: "bottom",
        position: "right",
        style: { background: "rgba(30,30,35,0.8)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }
    }).showToast();

    if (statusMsg) statusMsg.innerText = 'Buscando actualizaciones...';



    // Check for UI updates - Handle API not existing
    fetch('/api/update/ui', { headers: getAuthHeaders() })
        .then(r => {
            if (r.status === 404) {
                throw new Error('API endpoint not available');
            }
            return r.json();
        })
        .then(data => {
            if (statusMsg) {
                if (data.available) {
                    statusMsg.innerText = `Actualización disponible: ${data.version}`;
                    showUpdateAlert('ui', data.version, installUIUpdate);
                } else {
                    statusMsg.innerText = 'La UI está actualizada';
                    Toastify({
                        text: "La UI está actualizada",
                        style: { background: "#10b981" }
                    }).showToast();
                }
            }
        })
        .catch(err => {
            if (statusMsg) statusMsg.innerText = 'Sistema de actualización no disponible';
            Toastify({
                text: "Sistema de actualización no disponible actualmente",
                style: { background: "#f59e0b" }
            }).showToast();
            console.log('Update API not available:', err);
        });
}

function installUIUpdate() {
    Toastify({
        text: "Instalando actualización de UI...",
        style: { background: "var(--p)" }
    }).showToast();

    fetch('/api/update/ui/install', {
        method: 'POST',
        headers: getAuthHeaders()
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                Toastify({
                    text: "UI actualizada. Recargando...",
                    style: { background: "#10b981" }
                }).showToast();
                setTimeout(() => location.reload(), 2000);
            }
        })
        .catch(err => {
            Toastify({
                text: "Error al instalar actualización",
                style: { background: "#ef4444" }
            }).showToast();
        });
}

function updateSystem() {
    document.getElementById('appearance-modal').style.display = 'none';
    const statusMsg = document.getElementById('update-status-msg');

    // Feedback visual inmediato
    Toastify({
        text: "Buscando actualizaciones de Sistema...",
        duration: 2000,
        gravity: "bottom",
        position: "right",
        style: { background: "rgba(30,30,35,0.8)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }
    }).showToast();

    if (statusMsg) statusMsg.innerText = 'Buscando actualizaciones del sistema...';



    // Check for system updates - Handle API not existing
    fetch('/api/update/system', { headers: getAuthHeaders() })
        .then(r => {
            if (r.status === 404) {
                throw new Error('API endpoint not available');
            }
            return r.json();
        })
        .then(data => {
            if (statusMsg) {
                if (data.available) {
                    statusMsg.innerText = `Actualización disponible: ${data.version}`;
                    showUpdateAlert('system', data.version, installSystemUpdate);
                } else {
                    statusMsg.innerText = 'El sistema está actualizado';
                    Toastify({
                        text: "El sistema está actualizado",
                        style: { background: "#10b981" }
                    }).showToast();
                }
            }
        })
        .catch(err => {
            if (statusMsg) statusMsg.innerText = 'Sistema de actualización no disponible';
            Toastify({
                text: "Sistema de actualización no disponible actualmente",
                style: { background: "#f59e0b" }
            }).showToast();
            console.log('Update API not available:', err);
        });
}

function installSystemUpdate() {
    Toastify({
        text: "Instalando actualización del sistema...",
        style: { background: "var(--p)" }
    }).showToast();

    fetch('/api/update/system/install', {
        method: 'POST',
        headers: getAuthHeaders()
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                Toastify({
                    text: "Sistema actualizado. Reiniciando servidor...",
                    style: { background: "#10b981" }
                }).showToast();
            }
        })
        .catch(err => {
            Toastify({
                text: "Error al instalar actualización",
                style: { background: "#ef4444" }
            }).showToast();
        });
}

// Solid Color Background Functions
function updateSolidColorPreview(color) {
    const input = document.getElementById('solid-color-input');
    if (input) input.value = color;
}

function updateSolidColorFromInput(value) {
    const picker = document.getElementById('solid-color-picker');
    if (picker && value.match(/^#[0-9A-F]{6}$/i)) {
        picker.value = value;
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function applySolidColor() {
    const colorInput = document.getElementById('solid-color-input').value || '#8b5cf6';
    const colorSpace = document.getElementById('color-space-select').value;
    const adaptiveTheme = document.getElementById('adaptive-theme-toggle').checked;

    const rgb = hexToRgb(colorInput);
    if (!rgb) {
        Toastify({
            text: "Color inválido. Usa formato HEX (#RRGGBB)",
            style: { background: "#ef4444" }
        }).showToast();
        return;
    }

    // Apply color to body background with color space
    let colorValue;
    if (colorSpace === 'display-p3') {
        // Convert sRGB to Display P3 (approximate)
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        colorValue = `color(display-p3 ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)})`;
    } else if (colorSpace === 'rec2020') {
        // Convert sRGB to Rec. 2020 (approximate)
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        colorValue = `color(rec2020 ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)})`;
    } else {
        // sRGB (default)
        colorValue = colorInput;
    }

    // Remove image backgrounds
    document.body.style.backgroundImage = '';
    localStorage.removeItem('custom_background');

    // Apply solid color
    document.body.style.backgroundColor = colorValue;

    // Save to localStorage
    localStorage.setItem('solid_color', colorInput);
    localStorage.setItem('solid_color_space', colorSpace);
    localStorage.setItem('adaptive_theme', adaptiveTheme);

    // Generate adaptive theme if enabled
    if (adaptiveTheme) {
        generateAdaptiveTheme(rgb);
    }

    Toastify({
        text: `Fondo sólido aplicado (${colorSpace.toUpperCase()})`,
        style: { background: "#10b981" }
    }).showToast();
}

function generateAdaptiveTheme(rgb) {
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Determine if background is light or dark
    const isLight = luminance > 0.5;

    // Generate adaptive colors
    const textColor = isLight ? '#1d1d1f' : '#ffffff';
    const mutedColor = isLight ? '#6b7280' : '#9ca3af';

    // Card backgrounds with better contrast
    const cardBg = isLight
        ? `hsl(${hsl.h}, ${Math.max(hsl.s - 20, 10)}%, ${Math.min(hsl.l + 15, 95)}%)`
        : `hsl(${hsl.h}, ${Math.max(hsl.s - 20, 10)}%, ${Math.max(hsl.l - 20, 5)}%)`;

    const cardHover = isLight
        ? `hsl(${hsl.h}, ${Math.max(hsl.s - 20, 10)}%, ${Math.min(hsl.l + 20, 98)}%)`
        : `hsl(${hsl.h}, ${Math.max(hsl.s - 20, 10)}%, ${Math.max(hsl.l - 15, 8)}%)`;

    // Apply theme
    document.documentElement.style.setProperty('--txt', textColor);
    document.documentElement.style.setProperty('--muted', mutedColor);
    document.documentElement.style.setProperty('--glass-gradient', cardBg);
    document.documentElement.style.setProperty('--glass-hover', cardHover);
    document.documentElement.style.setProperty('--input-bg', cardBg);
    document.documentElement.style.setProperty('--glass-btn', cardBg);
    document.documentElement.style.setProperty('--glass-btn-hover', cardHover);
}

function removeSolidColor() {
    document.body.style.backgroundColor = '';
    localStorage.removeItem('solid_color');
    localStorage.removeItem('solid_color_space');
    localStorage.removeItem('adaptive_theme');

    // Reset adaptive theme
    const theme = localStorage.getItem('theme') || 'dark';
    const design = localStorage.getItem('design_mode') || 'glass';
    updateThemeUI(theme);
    setDesign(design);

    Toastify({
        text: "Fondo sólido eliminado",
        style: { background: "#10b981" }
    }).showToast();
}

function loadFileBrowser(p) {
    currentPath = p;
    fetch('/api/files?path=' + p, { headers: getAuthHeaders() }).then(r => r.json()).then(data => {
        const list = document.getElementById('file-list');
        list.innerHTML = '';

        data.forEach(f => {
            const icon = f.isDir ? 'fa-folder' : 'fa-file';
            const iconColor = f.isDir ? 'var(--p)' : 'var(--muted)';
            const clickHandler = f.isDir ? `loadFileBrowser('${f.name}')` : '';
            const cursorStyle = f.isDir ? 'cursor:pointer' : 'cursor:default';

            list.innerHTML += `
                <div class="file-item" style="${cursorStyle}" ${clickHandler ? `onclick="${clickHandler}"` : ''}>
                    <i class="fa-solid ${icon}" style="color:${iconColor}; font-size:1.5rem"></i>
                    <div class="file-info">
                        <div class="file-name">${f.name}</div>
                        <div class="file-meta">${f.size}</div>
                    </div>
                    ${!f.isDir ? `
                        <div class="file-actions">
                            <button class="btn btn-ghost" onclick="event.stopPropagation(); deleteFile('${f.name}')" title="Eliminar" style="color:var(--danger)">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        if (data.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--muted)">
                    <i class="fa-solid fa-folder-open" style="font-size:3rem; opacity:0.3; margin-bottom:15px"></i>
                    <p>La carpeta está vacía</p>
                </div>
            `;
        }
    });
}

function deleteFile(filename) {
    if (!confirm(`¿Eliminar archivo "${filename}"?`)) return;
    fetch(`/api/files?path=${encodeURIComponent(currentPath ? currentPath + '/' + filename : filename)}`, {
        method: 'DELETE', headers: getAuthHeaders()
    }).then(r => r.json()).then(result => {
        if (result.success) { loadFileBrowser(currentPath); Toastify({ text: "Archivo eliminado", style: { background: "#10b981" } }).showToast(); }
        else Toastify({ text: result.error || "Error al eliminar", style: { background: "#ef4444" } }).showToast();
    });
}
function uploadFile() { const i = document.createElement('input'); i.type = 'file'; i.onchange = e => { const fd = new FormData(); fd.append('file', e.target.files[0]); fetch(`/api/files/upload?path=${currentPath}`, { method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${authToken}` } }).then(() => loadFileBrowser(currentPath)); }; i.click(); }
function loadCfg() {
    fetch('/api/config', { headers: getAuthHeaders() }).then(r => r.json()).then(d => {
        const c = document.getElementById('cfg-list');
        c.innerHTML = '';
        if (d.success === true) delete d.success;
        Object.entries(d).forEach(([k, v]) => {
            c.innerHTML += `<div class="cfg-item"><label class="cfg-label">${k}</label><input class="cfg-in" id="cfg-input-${k}" value="${v}"></div>`;
        });
    });
}
function saveCfg() { const inputs = document.querySelectorAll('.cfg-in'); const payload = {}; inputs.forEach(input => { const key = input.id.replace('cfg-input-', ''); payload[key] = input.value; }); api('config', payload).then(res => { if (res.success) Toastify({ text: "Configuración guardada", style: { background: "#10b981" } }).showToast(); }); }
function forceUIUpdate() { location.reload(); }

// Whitelist management functions
function loadWhitelist() {
    // Load whitelist status and players
    fetch('/api/whitelist', { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(data => {
            const checkbox = document.getElementById('whitelist-enabled');
            if (checkbox) checkbox.checked = data.enabled || false;

            const list = document.getElementById('whitelist-list');
            if (list) {
                if (!data.players || data.players.length === 0) {
                    list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted);">No hay jugadores en la whitelist</div>';
                } else {
                    list.innerHTML = data.players.map(player => `
                        <div class="file-row">
                            <span><i class="fa-solid fa-user" style="margin-right:10px; color:var(--p);"></i>${player}</span>
                            <button class="btn btn-ghost" style="padding:5px 10px; color:var(--danger);" onclick="removeWhitelistPlayer('${player}')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `).join('');
                }
            }
        })
        .catch(() => {
            const list = document.getElementById('whitelist-list');
            if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted);">Error al cargar whitelist</div>';
        });
}

function toggleWhitelist() {
    const enabled = document.getElementById('whitelist-enabled').checked;
    api('whitelist/toggle', { enabled })
        .then(() => {
            Toastify({ text: enabled ? 'Whitelist activada' : 'Whitelist desactivada', style: { background: '#10b981' } }).showToast();
        })
        .catch(() => {
            Toastify({ text: 'Error al cambiar estado', style: { background: '#ef4444' } }).showToast();
        });
}

function addWhitelistPlayer() {
    const input = document.getElementById('whitelist-player');
    const player = input.value.trim();

    if (!player) {
        Toastify({ text: 'Ingresa un nombre de jugador', style: { background: '#f59e0b' } }).showToast();
        return;
    }

    api('whitelist/add', { player })
        .then(res => {
            if (res.success) {
                input.value = '';
                loadWhitelist();
                Toastify({ text: `Jugador ${player} agregado`, style: { background: '#10b981' } }).showToast();
            } else {
                Toastify({ text: res.error || 'Error al agregar jugador', style: { background: '#ef4444' } }).showToast();
            }
        });
}

function removeWhitelistPlayer(player) {
    if (!confirm(`¿Eliminar a ${player} de la whitelist?`)) return;

    api('whitelist/remove', { player })
        .then(res => {
            if (res.success) {
                loadWhitelist();
                Toastify({ text: `Jugador ${player} eliminado`, style: { background: '#10b981' } }).showToast();
            } else {
                Toastify({ text: res.error || 'Error al eliminar jugador', style: { background: '#ef4444' } }).showToast();
            }
        });
}

function loadCron() {
    fetch('/api/cron', { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(data => {
            cronTasks = data;
            const list = document.getElementById('cron-list');
            if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted)">No hay tareas programadas (WIP)</div>';
        })
        .catch(() => {
            const list = document.getElementById('cron-list');
            if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted)">No hay tareas programadas (WIP)</div>';
        });
}

function loadLogs() {
    const container = document.getElementById('logs-container');
    if (container) {
        container.innerHTML = '<div style="color:var(--p)">> Cargando últimos logs del servidor...</div><br><div>[INFO] Servidor iniciado correctamente en puerto 25565</div><div>[INFO] Cargando mundo "world"...</div><div>[INFO] Hecho! Para ayuda, escribe "help"</div>';
    }
}
// Las funciones de instalación de versiones se mantienen igual pero usando api()
function loadVersions(type) { Toastify({ text: "Obteniendo versiones...", style: { background: "var(--p)" } }).showToast(); api('nebula/versions', { type }).then(data => { const list = document.getElementById('version-list'); list.innerHTML = ''; data.forEach(v => { const btn = document.createElement('button'); btn.className = 'btn btn-secondary'; btn.style.cssText = 'justify-content: space-between; font-family: "JetBrains Mono"; font-size: 0.9rem;'; btn.innerHTML = `<span>${v.id}</span> <i class="fa-solid fa-cloud-arrow-down"></i>`; btn.onclick = () => { selectedVerData = { ...v, type }; document.getElementById('version-modal').style.display = 'none'; document.getElementById('ram-modal').style.display = 'flex'; document.querySelector('#ram-modal h3').innerHTML = `<i class="fa-solid fa-microchip"></i> Instalar ${type} ${v.id}`; }; list.appendChild(btn); }); document.getElementById('version-modal').style.display = 'flex'; }); }
function confirmInstall() { if (!selectedVerData) return; const ramVal = parseFloat(document.getElementById('ram-slider').value); const ramMB = Math.floor(ramVal * 1024); const ramStr = ramMB + "M"; document.getElementById('ram-modal').style.display = 'none'; Toastify({ text: `Configurando ${ramStr} RAM e instalando...`, style: { background: "var(--p)" } }).showToast(); api('settings', { ram: ramStr }).then(() => { const type = selectedVerData.type; const ver = selectedVerData.id; const sendInstall = (url, filename) => { api('install', { url, filename }).then(res => { if (!res.success) Toastify({ text: "Error al iniciar instalación", style: { background: "#ef4444" } }).showToast(); }); }; if (type === 'vanilla') { api('nebula/resolve-vanilla', { url: selectedVerData.url }).then(res => { if (res.url) sendInstall(res.url, 'server.jar'); }); } else if (type === 'paper') { fetch(`https://api.papermc.io/v2/projects/paper/versions/${ver}`).then(r => r.json()).then(d => { const latestBuild = d.builds[d.builds.length - 1]; const jarName = `paper-${ver}-${latestBuild}.jar`; const url = `https://api.papermc.io/v2/projects/paper/versions/${ver}/builds/${latestBuild}/downloads/${jarName}`; sendInstall(url, 'server.jar'); }); } else if (type === 'fabric') { fetch('https://meta.fabricmc.net/v2/versions/loader').then(r => r.json()).then(d => { const stableLoader = d.find(l => l.stable).version; const url = `https://meta.fabricmc.net/v2/versions/loader/${ver}/${stableLoader}/server/jar`; sendInstall(url, 'server.jar'); }); } else if (type === 'forge') { api('nebula/resolve-forge', { version: ver }).then(res => { if (res.url) sendInstall(res.url, 'server.jar'); }); } }); }
function openModStore() { Toastify({ text: "La tienda de mods estará disponible en la V1.7.0", style: { background: "#3b82f6" } }).showToast(); }

// ===== COMMAND PALETTE & KEYBOARD SHORTCUTS =====

// Command registry with multi-language support
const COMMANDS = [
    {
        id: 'start',
        name: { es: 'Iniciar Servidor', en: 'Start Server', pt: 'Iniciar Servidor' },
        keywords: ['start', 'iniciar', 'començar', 'play'],
        icon: 'fa-play',
        shortcut: '',
        action: () => api('power/start')
    },
    {
        id: 'stop',
        name: { es: 'Detener Servidor', en: 'Stop Server', pt: 'Parar Servidor' },
        keywords: ['stop', 'detener', 'parar', 'halt'],
        icon: 'fa-stop',
        shortcut: '',
        action: () => api('power/stop')
    },
    {
        id: 'restart',
        name: { es: 'Reiniciar Servidor', en: 'Restart Server', pt: 'Reiniciar Servidor' },
        keywords: ['restart', 'reiniciar', 'reboot'],
        icon: 'fa-rotate',
        shortcut: '',
        action: () => api('power/restart')
    },
    {
        id: 'kill',
        name: { es: 'Forzar Apagado', en: 'Force Shutdown', pt: 'Forçar Desligamento' },
        keywords: ['kill', 'force', 'forzar'],
        icon: 'fa-skull',
        shortcut: '',
        action: () => api('power/kill')
    },
    {
        id: 'console',
        name: { es: 'Abrir Consola', en: 'Open Console', pt: 'Abrir Console' },
        keywords: ['console', 'consola', 'terminal'],
        icon: 'fa-terminal',
        shortcut: 'Alt+2',
        action: () => { closeCommandPalette(); setTab('console'); }
    },
    {
        id: 'monitor',
        name: { es: 'Abrir Monitor', en: 'Open Monitor', pt: 'Abrir Monitor' },
        keywords: ['monitor', 'dashboard', 'stats'],
        icon: 'fa-chart-pie',
        shortcut: 'Alt+1',
        action: () => { closeCommandPalette(); setTab('stats'); }
    },
    {
        id: 'files',
        name: { es: 'Gestor de Archivos', en: 'File Manager', pt: 'Gerenciador de Arquivos' },
        keywords: ['files', 'archivos', 'arquivos'],
        icon: 'fa-folder',
        shortcut: 'Alt+4',
        action: () => { closeCommandPalette(); setTab('files'); }
    },
    {
        id: 'backups',
        name: { es: 'Ver Backups', en: 'View Backups', pt: 'Ver Backups' },
        keywords: ['backup', 'backups', 'copias'],
        icon: 'fa-box-archive',
        shortcut: '',
        action: () => { closeCommandPalette(); setTab('backups'); }
    },
    {
        id: 'settings',
        name: { es: 'Configuración', en: 'Settings', pt: 'Configurações' },
        keywords: ['settings', 'configuración', 'configurações', 'ajustes', 'config'],
        icon: 'fa-sliders',
        shortcut: 'Alt+6',
        action: () => { closeCommandPalette(); setTab('config'); }
    },
    {
        id: 'labs',
        name: { es: 'Abrir Labs', en: 'Open Labs', pt: 'Abrir Labs' },
        keywords: ['labs', 'experimental'],
        icon: 'fa-flask',
        shortcut: 'Alt+5',
        action: () => { closeCommandPalette(); setTab('labs'); }
    },
    {
        id: 'theme',
        name: { es: 'Cambiar Tema', en: 'Toggle Theme', pt: 'Alternar Tema' },
        keywords: ['theme', 'tema', 'dark', 'light', 'oscuro', 'claro'],
        icon: 'fa-moon',
        shortcut: '',
        action: () => {
            const current = document.documentElement.getAttribute('data-theme');
            setTheme(current === 'dark' ? 'light' : 'dark');
            closeCommandPalette();
        }
    },
    {
        id: 'appearance',
        name: { es: 'Personalización', en: 'Personalization', pt: 'Personalização' },
        keywords: ['appearance', 'personalización', 'personalização', 'customize'],
        icon: 'fa-paintbrush',
        shortcut: '',
        action: () => {
            closeCommandPalette();
            setTimeout(() => document.getElementById('appearance-modal').style.display = 'flex', 100);
        }
    }
];

let commandPaletteOpen = false;
let selectedCommandIndex = 0;
let filteredCommands = [];

// Toggle command palette
function toggleCommandPalette() {
    const palette = document.getElementById('command-palette');
    if (!palette) return;

    if (commandPaletteOpen) {
        closeCommandPalette();
    } else {
        openCommandPalette();
    }
}

function openCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('command-input');
    const paletteContent = palette?.querySelector('.command-palette');
    if (!palette || !input) return;

    palette.style.display = 'flex';
    commandPaletteOpen = true;
    selectedCommandIndex = 0;

    // Start collapsed - only search bar visible
    if (paletteContent) paletteContent.classList.remove('expanded');

    // Clear input
    input.value = '';
    filteredCommands = [];

    // Focus input
    setTimeout(() => input.focus(), 100);
}

function closeCommandPalette() {
    const palette = document.getElementById('command-palette');
    const paletteContent = palette?.querySelector('.command-palette');
    if (!palette) return;

    palette.style.display = 'none';
    if (paletteContent) paletteContent.classList.remove('expanded');
    commandPaletteOpen = false;
    selectedCommandIndex = 0;
    filteredCommands = [];
}

// Fuzzy search commands
function searchCommands(query) {
    const results = document.getElementById('command-results');
    const palette = document.getElementById('command-palette');
    const paletteContent = palette?.querySelector('.command-palette');
    if (!results) return;

    // Toggle expanded state based on input
    if (paletteContent) {
        if (query.trim() || window.commandPaletteExpanded) {
            paletteContent.classList.add('expanded');
        } else {
            paletteContent.classList.remove('expanded');
        }
    }

    const lang = currentLanguage || 'es';
    query = query.toLowerCase().trim();

    // Map commands to required permissions
    const permissionMap = {
        'start': 'start',
        'stop': 'stop',
        'restart': 'restart',
        'kill': 'kill',
        'console': 'console',
        'files': 'files',
        'config': 'config',
        'backups': 'backups',
        'scheduler': 'scheduler',
        'logs': 'logs'
    };

    // Filter commands by fuzzy matching AND permissions
    filteredCommands = COMMANDS.filter(cmd => {
        // Check permission first
        const requiredPerm = permissionMap[cmd.id];
        if (requiredPerm && !hasPermission(requiredPerm)) {
            return false; // User doesn't have permission
        }

        const name = cmd.name[lang] || cmd.name.es;
        const searchText = name.toLowerCase() + ' ' + cmd.keywords.join(' ').toLowerCase();

        if (!query) return true; // Show all allowed if empty

        // Match if query is substring of searchText
        return searchText.includes(query);
    });

    // Render results
    if (filteredCommands.length === 0) {
        results.innerHTML = `
            <div class="command-empty">
                <i class="fa-solid fa-search"></i>
                <div>No se encontraron comandos</div>
            </div>
        `;
        return;
    }

    results.innerHTML = filteredCommands.map((cmd, index) => {
        const name = cmd.name[lang] || cmd.name.es;
        const isSelected = index === selectedCommandIndex;

        return `
            <div class="command-item ${isSelected ? 'selected' : ''}" data-index="${index}" onclick="executeCommand(${index})">
                <i class="fa-solid ${cmd.icon}"></i>
                <div class="command-item-text">
                    <div class="command-item-name">${name}</div>
                </div>
                ${cmd.shortcut ? `<span class="command-item-shortcut">${cmd.shortcut}</span>` : ''}
            </div>
        `;
    }).join('');

    // Scroll selected into view
    const selectedEl = results.querySelector('.command-item.selected');
    if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Navigate commands with arrow keys
function navigateCommands(direction) {
    if (filteredCommands.length === 0) return;

    if (direction === 'down') {
        selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
    } else if (direction === 'up') {
        selectedCommandIndex = selectedCommandIndex === 0 ? filteredCommands.length - 1 : selectedCommandIndex - 1;
    }

    searchCommands(document.getElementById('command-input')?.value || '');
}

// Execute selected command
function executeCommand(index = selectedCommandIndex) {
    if (!filteredCommands[index]) return;

    const cmd = filteredCommands[index];
    try {
        cmd.action();
        Toastify({
            text: `✓ ${cmd.name[currentLanguage || 'es']}`,
            duration: 2000,
            style: { background: '#10b981' }
        }).showToast();
    } catch (error) {
        console.error('Command error:', error);
    }
}

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Shift+Space - Toggle command palette
    if (e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        toggleCommandPalette();
        return;
    }

    // Ctrl+K - Alternative command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
    }

    // Escape - Close command palette or modals
    if (e.key === 'Escape') {
        e.preventDefault();

        // Close command palette first
        if (commandPaletteOpen) {
            closeCommandPalette();
            return;
        }

        // Close account menu if open
        if (accountMenuOpen) {
            toggleAccountMenu();
            return;
        }

        // Close all modals
        const modals = [
            'appearance-modal',
            'account-modal',
            'version-modal',
            'ram-modal',
            'backup-modal',
            'scheduler-modal'
        ];

        let modalClosed = false;
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
                modal.style.display = 'none';
                modalClosed = true;
            }
        });

        if (modalClosed) return;

        // If we're in a Lab feature (files, backups, scheduler, whitelist), go back to Labs
        const currentTab = document.querySelector('.tab-content.active');
        if (currentTab) {
            const labFeatures = ['tab-files', 'tab-backups', 'tab-scheduler', 'tab-whitelist', 'tab-logs'];
            if (labFeatures.includes(currentTab.id)) {
                // If in files and not at root, navigate up directory
                if (currentTab.id === 'tab-files' && currentPath && currentPath !== '/') {
                    navigateUp();
                } else {
                    // Otherwise go back to Labs
                    setTab('labs');
                }
                return;
            }
        }
    }

    // Sidebar Shortcuts (Alt + 1-6)
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch (e.key) {
            case '1': e.preventDefault(); setTab('stats'); break;     // Monitor
            case '2': e.preventDefault(); setTab('console'); break;   // Consola
            case '3': e.preventDefault(); setTab('versions'); break;  // Núcleos
            case '4': e.preventDefault(); setTab('whitelist'); break; // Whitelist
            case '5': e.preventDefault(); setTab('labs'); break;      // Labs
            case '6': e.preventDefault(); setTab('config'); break;    // Ajustes
        }
    }


    // Command palette navigation
    if (commandPaletteOpen) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateCommands('down');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateCommands('up');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeCommand();
            closeCommandPalette();
        }
        return;
    }

    // Alt+1-9 - Quick navigation (with permission check)
    if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabMap = {
            '1': { tab: 'stats', perm: null },     // Monitor (always allowed)
            '2': { tab: 'console', perm: 'console' },
            '3': { tab: 'versions', perm: null },  // Cores (always allowed)
            '4': { tab: 'files', perm: 'files' },
            '5': { tab: 'labs', perm: null },      // Labs (always allowed)
            '6': { tab: 'config', perm: 'config' },
            '7': { tab: 'backups', perm: 'backups' },
            '8': { tab: 'whitelist', perm: null }  // Whitelist (always allowed)
        };
        const mapping = tabMap[e.key];
        if (mapping) {
            // Check permission if required
            if (mapping.perm && !hasPermission(mapping.perm)) {
                Toastify({ text: 'You don\'t have permission to access this section', style: { background: '#ef4444' } }).showToast();
                return;
            }
            const btn = document.querySelector(`.nav-btn[onclick*="'${mapping.tab}'"]`);
            if (btn && btn.style.display !== 'none') {
                btn.click();
            }
        }
        return;
    }
});

// Command palette input listener
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('command-input');
    if (input) {
        input.addEventListener('input', (e) => {
            selectedCommandIndex = 0;
            searchCommands(e.target.value);
        });

        // Tab key to toggle results visibility
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const palette = document.getElementById('command-palette');
                const paletteContent = palette?.querySelector('.command-palette');
                if (paletteContent) {
                    window.commandPaletteExpanded = !window.commandPaletteExpanded;
                    if (window.commandPaletteExpanded) {
                        paletteContent.classList.add('expanded');
                        searchCommands(input.value); // Load results if expanded
                    } else {
                        paletteContent.classList.remove('expanded');
                    }
                }
            }
        });
    }

    // Click outside to close
    const overlay = document.getElementById('command-palette');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeCommandPalette();
            }
        });
    }
});

console.log('✅ Command Palette & Keyboard Shortcuts loaded');
console.log('📌 Press Shift+Space to open command palette');
console.log('📌 Press Alt+1-9 for quick navigation');


// ===== ACCOUNT MANAGEMENT =====

let accountMenuOpen = false;

// Toggle account dropdown menu
function toggleAccountMenu() {
    const dropdown = document.getElementById('account-dropdown');
    const trigger = document.querySelector('.account-trigger');

    if (!dropdown || !trigger) return;

    accountMenuOpen = !accountMenuOpen;

    if (accountMenuOpen) {
        dropdown.style.display = 'block';
        trigger.classList.add('active');
    } else {
        dropdown.style.display = 'none';
        trigger.classList.remove('active');
    }
}

// Close account menu when clicking outside
document.addEventListener('click', (e) => {
    const accountSection = document.querySelector('.account-section');
    if (accountSection && !accountSection.contains(e.target) && accountMenuOpen) {
        toggleAccountMenu();
    }
});

// Open account settings modal
function openAccountSettings() {
    const modal = document.getElementById('account-modal');
    if (!modal) return;

    // Close account dropdown
    if (accountMenuOpen) toggleAccountMenu();

    // Update current username display
    if (currentUser && currentUser.username) {
        const usernameDisplay = document.getElementById('account-current-username');
        if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
    }

    // Clear inputs
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';

    modal.style.display = 'flex';
}

// Close account settings modal
function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.style.display = 'none';
}

// ===== USER MANAGEMENT FUNCTIONS =====

// Toggle create user form
function toggleCreateUserForm() {
    const form = document.getElementById('create-user-form');
    if (form) {
        const isHidden = form.style.display === 'none';
        form.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            // Clear form
            document.getElementById('new-user-username').value = '';
            document.getElementById('new-user-password').value = '';
            document.getElementById('new-user-role').value = 'user';
            togglePermissionsForm();
        }
    }
}

// Toggle permissions form based on role
function togglePermissionsForm() {
    const role = document.getElementById('new-user-role').value;
    const permForm = document.getElementById('permissions-form');
    if (permForm) {
        permForm.style.display = role === 'admin' ? 'none' : 'block';
    }
}

// Load users list
function loadUsers() {
    api('users/list', null, 'GET')
        .then(users => {
            const list = document.getElementById('user-list');
            if (!list) return;

            if (!users || users.length === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted)">No users found</div>';
                return;
            }

            list.innerHTML = users.map(user => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid var(--glass-border)">
                    <div style="display:flex; align-items:center; gap:12px">
                        <i class="fa-solid fa-user" style="color:var(--p); font-size:1.2rem"></i>
                        <div>
                            <div style="font-weight:600">${user.username}</div>
                            <div style="font-size:0.85rem; color:var(--muted)">
                                ${user.role === 'admin' ? 'Administrator' : 'User'} 
                                ${user.permissions && user.permissions.length > 0 ? '• ' + user.permissions.length + ' permissions' : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px">
                        ${user.username !== currentUser?.username ? `
                            <button class="btn btn-ghost" style="padding:6px 12px; color:var(--p)" onclick="editUser('${user.username}')">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn btn-ghost" style="padding:6px 12px; color:var(--danger)" onclick="deleteUser('${user.username}')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        })
        .catch(err => {
            console.error('Error loading users:', err);
            const list = document.getElementById('user-list');
            if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--danger)">Error loading users</div>';
        });
}

// Create new user
function createUser() {
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    if (!username || !password) {
        Toastify({ text: 'Please fill all fields', style: { background: '#f59e0b' } }).showToast();
        return;
    }

    // Get selected permissions (only for non-admin)
    let permissions = [];
    if (role !== 'admin') {
        const checkboxes = document.querySelectorAll('#permissions-form input[name="perm"]:checked');
        permissions = Array.from(checkboxes).map(cb => cb.value);
    }

    api('users/create', { username, password, role, permissions })
        .then(res => {
            if (res.success) {
                Toastify({ text: `User ${username} created`, style: { background: '#10b981' } }).showToast();
                toggleCreateUserForm();
                loadUsers();
            } else {
                Toastify({ text: res.error || 'Error creating user', style: { background: '#ef4444' } }).showToast();
            }
        })
        .catch(err => {
            Toastify({ text: 'Error creating user', style: { background: '#ef4444' } }).showToast();
        });
}

// Edit user permissions (beautiful modal version)
function editUser(username) {
    // Get current user data
    api('users/list', null, 'GET')
        .then(users => {
            const user = users.find(u => u.username === username);
            if (!user) {
                Toastify({ text: 'User not found', style: { background: '#ef4444' } }).showToast();
                return;
            }

            // Populate modal with user data
            document.getElementById('edit-user-username').value = user.username;
            document.getElementById('edit-user-role').value = user.role || 'user';

            // Check/uncheck permissions based on user's current permissions
            const checkboxes = document.querySelectorAll('#edit-user-modal input[name="edit-perm"]');
            checkboxes.forEach(cb => {
                cb.checked = (user.permissions || []).includes(cb.value);
            });

            // Show/hide permissions form based on role
            toggleEditPermissionsForm();

            // Show modal
            document.getElementById('edit-user-modal').style.display = 'flex';
        });
}

// Toggle edit permissions form visibility
function toggleEditPermissionsForm() {
    const role = document.getElementById('edit-user-role').value;
    const permForm = document.getElementById('edit-permissions-form');
    if (permForm) {
        permForm.style.display = role === 'admin' ? 'none' : 'block';
    }
}

// Close edit user modal
function closeEditUserModal() {
    document.getElementById('edit-user-modal').style.display = 'none';
}

// Save user edits
function saveUserEdit() {
    const username = document.getElementById('edit-user-username').value;
    const role = document.getElementById('edit-user-role').value;

    // Get selected permissions
    let permissions = [];
    if (role !== 'admin') {
        const checkboxes = document.querySelectorAll('#edit-user-modal input[name="edit-perm"]:checked');
        permissions = Array.from(checkboxes).map(cb => cb.value);
    }

    // Update user
    api('users/update', { username, role, permissions })
        .then(res => {
            if (res.success) {
                Toastify({ text: `User ${username} updated`, style: { background: '#10b981' } }).showToast();
                closeEditUserModal();
                loadUsers();
            } else {
                Toastify({ text: res.error || 'Error updating user', style: { background: '#ef4444' } }).showToast();
            }
        });
}

// Delete user
function deleteUser(username) {
    if (!confirm(`Delete user "${username}"?`)) return;

    api('users/delete', { username })
        .then(res => {
            if (res.success) {
                Toastify({ text: `User ${username} deleted`, style: { background: '#10b981' } }).showToast();
                loadUsers();
            } else {
                Toastify({ text: res.error || 'Error deleting user', style: { background: '#ef4444' } }).showToast();
            }
        });
}

// Load users when opening account settings
const originalOpenAccountSettings = openAccountSettings;
if (typeof originalOpenAccountSettings === 'function') {
    openAccountSettings = function () {
        originalOpenAccountSettings();
        // Load users if admin
        if (currentUser && currentUser.role === 'admin') {
            loadUsers();
        } else {
            // Hide user management section for non-admins
            const userManagementSection = document.getElementById('user-management-section');
            if (userManagementSection) userManagementSection.style.display = 'none';
        }
    };
}


// Change username
async function changeUsername() {
    const newUsername = document.getElementById('new-username').value.trim();

    if (!newUsername) {
        Toastify({
            text: t('msg.error') + ': ' + 'Ingresa un nombre de usuario',
            style: { background: '#ef4444' }
        }).showToast();
        return;
    }

    if (newUsername === currentUser.username) {
        Toastify({
            text: 'El nombre de usuario es el mismo',
            style: { background: '#f59e0b' }
        }).showToast();
        return;
    }

    try {
        const response = await fetch('/api/account/username', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username: newUsername })
        });

        const result = await response.json();

        if (result.success) {
            currentUser.username = newUsername;

            // Update UI
            const sidebarUsername = document.getElementById('sidebar-username');
            const accountUsername = document.getElementById('account-current-username');
            if (sidebarUsername) sidebarUsername.textContent = newUsername;
            if (accountUsername) accountUsername.textContent = newUsername;

            document.getElementById('new-username').value = '';

            Toastify({
                text: t('msg.success') + ': Nombre actualizado',
                style: { background: '#10b981' }
            }).showToast();
        } else {
            Toastify({
                text: t('msg.error') + ': ' + (result.error || 'Error al actualizar'),
                style: { background: '#ef4444' }
            }).showToast();
        }
    } catch (error) {
        console.error('Error changing username:', error);
        Toastify({
            text: t('msg.error') + ': Error de conexión',
            style: { background: '#ef4444' }
        }).showToast();
    }
}

// Change password
async function changePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!newPassword || !confirmPassword) {
        Toastify({
            text: t('msg.error') + ': Completa todos los campos',
            style: { background: '#ef4444' }
        }).showToast();
        return;
    }

    if (newPassword !== confirmPassword) {
        Toastify({
            text: t('msg.error') + ': Las contraseñas no coinciden',
            style: { background: '#ef4444' }
        }).showToast();
        return;
    }

    if (newPassword.length < 4) {
        Toastify({
            text: t('msg.error') + ': La contraseña debe tener al menos 4 caracteres',
            style: { background: '#ef4444' }
        }).showToast();
        return;
    }

    try {
        const response = await fetch('/api/account/password', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ password: newPassword })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';

            Toastify({
                text: t('msg.success') + ': Contraseña actualizada',
                style: { background: '#10b981' }
            }).showToast();
        } else {
            Toastify({
                text: t('msg.error') + ': ' + (result.error || 'Error al actualizar'),
                style: { background: '#ef4444' }
            }).showToast();
        }
    } catch (error) {
        console.error('Error changing password:', error);
        Toastify({
            text: t('msg.error') + ': Error de conexión',
            style: { background: '#ef4444' }
        }).showToast();
    }
}

// Update sidebar username on login
function updateSidebarUsername() {
    if (currentUser && currentUser.username) {
        const sidebarUsername = document.getElementById('sidebar-username');
        if (sidebarUsername) {
            sidebarUsername.textContent = currentUser.username;
        }
    }
}

// Call this when user logs in or app initializes
document.addEventListener('DOMContentLoaded', () => {
    // Update username after a short delay to ensure currentUser is set
    setTimeout(updateSidebarUsername, 500);
});

console.log('✅ Account Management loaded');

// ==================== NAVIGATE UP (BACK BUTTON) ====================
function navigateUp() {
    // If we're in files tab and came from labs, go back to labs
    // Otherwise navigate up directory structure
    if (currentPath && currentPath !== '/') {
        const parts = currentPath.split('/').filter(p => p);
        parts.pop();
        const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
        loadFileBrowser(parentPath);
    } else {
        // At root, go back to labs
        setTab('labs');
    }
}

// ==================== BACKUPS SYSTEM ====================

function loadBackups() {
    const list = document.getElementById('backup-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted)">Cargando backups...</div>';

    api('backups', null, 'GET').then(backups => {
        if (!backups || backups.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--muted)">
                    <i class="fa-solid fa-box-open" style="font-size:3rem; opacity:0.3; margin-bottom:15px"></i>
                    <p>No hay copias de seguridad</p>
                </div>`;
            return;
        }

        list.innerHTML = backups.map(backup => `
            <div class="file-item" style="cursor:default">
                <i class="fa-solid fa-file-zipper" style="color:var(--p); font-size:1.5rem"></i>
                <div class="file-info">
                    <div class="file-name">${backup.name}</div>
                    <div class="file-meta">
                        ${new Date(backup.created).toLocaleString()} • ${(backup.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="restoreBackup('${backup.name}')" class="btn btn-secondary" title="Restaurar" style="padding:6px 12px">
                        <i class="fa-solid fa-rotate-left"></i> Restablecer
                    </button>
                    <button onclick="deleteBackup('${backup.name}')" class="btn btn-ghost" title="Eliminar" style="color:var(--danger)">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }).catch(err => {
        list.innerHTML = `<div style="color:var(--danger)">Error al cargar backups: ${err.message}</div>`;
    });
}

function openBackupModal() {
    document.getElementById('backup-modal').style.display = 'flex';
    document.getElementById('backup-name-input').value = '';
    document.getElementById('backup-name-input').focus();
}

function closeBackupModal() {
    document.getElementById('backup-modal').style.display = 'none';
}

function confirmCreateBackup() {
    const nameInput = document.getElementById('backup-name-input').value.trim();
    const btn = document.querySelector('#backup-modal .btn-primary');

    // Disable button to prevent double click
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Creando...';

    const payload = {};
    if (nameInput) payload.name = nameInput;

    api('backups/create', payload)
        .then(res => {
            if (res.success) {
                Toastify({ text: `Backup ${res.name} creado`, style: { background: '#10b981' } }).showToast();
                closeBackupModal();
                loadBackups();
            } else {
                Toastify({ text: res.error || 'Error al crear backup', style: { background: '#ef4444' } }).showToast();
            }
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerText = originalText;
        });
}

function deleteBackup(name) {
    if (!confirm(`¿Estás seguro de eliminar ${name}?`)) return;

    api('backups/delete', { name })
        .then(res => {
            if (res.success) {
                Toastify({ text: 'Backup eliminado', style: { background: '#10b981' } }).showToast();
                loadBackups();
            } else {
                Toastify({ text: res.error || 'Error', style: { background: '#ef4444' } }).showToast();
            }
        });
}

function restoreBackup(name) {
    if (!confirm(`⚠️ PRECAUCIÓN: Esto borrará el servidor actual y restaurará ${name}. ¿Continuar?`)) return;

    Toastify({ text: 'Iniciando restauración... El servidor se detendrá.', duration: 5000, style: { background: '#f59e0b' } }).showToast();

    api('backups/restore', { name })
        .then(res => {
            if (res.success) {
                Toastify({ text: 'Restauración completada. Reiniciando servidor...', style: { background: '#10b981' } }).showToast();
                // Wait a bit then refresh
                setTimeout(() => window.location.reload(), 3000);
            } else {
                Toastify({ text: res.error || 'Error en restauración', style: { background: '#ef4444' } }).showToast();
            }
        });
}

// ==================== SCHEDULER SYSTEM ====================

function loadCronTasks() {
    const list = document.getElementById('cron-list');
    if (!list) return;

    api('cron', null, 'GET').then(tasks => {
        if (!tasks || tasks.length === 0) {
            list.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--muted)">
                    <i class="fa-solid fa-clock" style="font-size:3rem; opacity:0.3; margin-bottom:15px"></i>
                    <p>No hay tareas programadas</p>
                </div>`;
            return;
        }

        list.innerHTML = tasks.map(task => {
            let icon = 'fa-calendar';
            let color = 'var(--p)';

            if (task.action === 'restart') { icon = 'fa-rotate'; color = '#3b82f6'; }
            if (task.action === 'stop') { icon = 'fa-stop'; color = '#ef4444'; }
            if (task.action === 'backup') { icon = 'fa-box-archive'; color = '#10b981'; }

            // Human readable frequency
            let freqMap = {
                '0 0 * * *': 'Diariamente (00:00)',
                '0 0 * * 1': 'Semanalmente (Lun)',
                '0 0 1 * *': 'Mensualmente (Día 1)',
                '0 */6 * * *': 'Cada 6 Horas'
            };
            let humanFreq = freqMap[task.expression || task.schedule] || (task.expression || task.schedule);

            return `
            <div class="card glass" style="margin:0; min-height:auto; border:1px solid var(--glass-border)">
                <div style="display:flex; justify-content:space-between; align-items:flex-start">
                    <div style="display:flex; gap:15px; align-items:center">
                        <div style="width:40px; height:40px; border-radius:10px; background:${color}20; display:flex; align-items:center; justify-content:center; color:${color}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:1.05rem">${task.name}</div>
                            <div style="font-size:0.85rem; color:var(--muted); margin-top:4px">
                                <i class="fa-solid fa-repeat" style="font-size:0.7rem"></i> ${humanFreq}
                            </div>
                        </div>
                    </div>
                    <button onclick="deleteTask('${task.id}')" class="btn btn-ghost" style="color:var(--danger); padding:5px 10px">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                ${task.action === 'command' ? `
                    <div style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.2); border-radius:6px; font-family:'JetBrains Mono'; font-size:0.8rem; color:var(--muted)">
                        > ${task.command || 'No command'}
                    </div>
                ` : ''}
            </div>
            `;
        }).join('');
    }).catch(err => {
        list.innerHTML = `<div style="color:var(--danger)">Error al cargar tareas: ${err.message}</div>`;
    });
}

function openSchedulerModal() {
    document.getElementById('scheduler-modal').style.display = 'flex';
}

function closeSchedulerModal() {
    document.getElementById('scheduler-modal').style.display = 'none';
}

function toggleTaskActionFields() {
    const action = document.getElementById('task-action').value;
    document.getElementById('task-command-field').style.display = action === 'command' ? 'block' : 'none';
}

function toggleTaskCustomCron() {
    const freq = document.getElementById('task-frequency').value;
    document.getElementById('task-cron-field').style.display = freq === 'custom' ? 'block' : 'none';
}

function saveTask() {
    const name = document.getElementById('task-name').value.trim();
    const action = document.getElementById('task-action').value;
    const freq = document.getElementById('task-frequency').value;
    const customCron = document.getElementById('task-cron').value.trim();
    const command = document.getElementById('task-command').value.trim();

    if (!name) return Toastify({ text: 'Nombre requerido', style: { background: '#ef4444' } }).showToast();

    let expression = freq === 'custom' ? customCron : freq;
    if (!expression) return Toastify({ text: 'Frecuencia requerida', style: { background: '#ef4444' } }).showToast();

    if (action === 'command' && !command) return Toastify({ text: 'Comando requerido', style: { background: '#ef4444' } }).showToast();

    // Load existing to append
    api('cron', null, 'GET').then(tasks => {
        const newTask = {
            id: Date.now().toString(),
            name: name,
            action: action,
            expression: expression,
            command: command,
            enabled: true
        };

        const updatedTasks = [...(tasks || []), newTask];

        api('cron', updatedTasks).then(res => {
            if (res.success) {
                Toastify({ text: 'Tarea guardada', style: { background: '#10b981' } }).showToast();
                closeSchedulerModal();
                loadCronTasks();
            } else {
                Toastify({ text: 'Error al guardar', style: { background: '#ef4444' } }).showToast();
            }
        });
    });
}

function deleteTask(id) {
    if (!confirm('¿Eliminar tarea?')) return;

    api('cron/' + id, null, 'DELETE').then(res => {
        if (res.success) {
            Toastify({ text: 'Tarea eliminada', style: { background: '#10b981' } }).showToast();
            loadCronTasks();
        } else {
            Toastify({ text: 'Error al eliminar', style: { background: '#ef4444' } }).showToast();
        }
    });
}

// ==================== GLASS BLUR CUSTOMIZATION ====================

function updateBlur(value) {
    const blurValue = document.getElementById('blur-value');
    if (blurValue) blurValue.textContent = value + 'px';

    // Update CSS variable instantly for preview
    document.documentElement.style.setProperty('--glass-blur', value + 'px');
}

function saveBlur(value) {
    // Save to localStorage
    localStorage.setItem('glassBlur', value);

    // Show feedback only on release
    Toastify({
        text: `Desenfoque ajustado: ${value}px`,
        duration: 1500,
        style: { background: 'var(--p)' }
    }).showToast();
}

// Load saved blur on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedBlur = localStorage.getItem('glassBlur');
    if (savedBlur) {
        document.documentElement.style.setProperty('--glass-blur', savedBlur + 'px');
        const slider = document.getElementById('blur-slider');
        const blurValue = document.getElementById('blur-value');
        if (slider) slider.value = savedBlur;
        if (blurValue) blurValue.textContent = savedBlur + 'px';
    }
});

// Initialize Sliders for the Tahoe 26 effect
function initSliders() {
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        const updateSlider = () => {
            const min = slider.min || 0;
            const max = slider.max || 100;
            const value = slider.value;
            const percentage = ((value - min) / (max - min)) * 100;
            slider.style.backgroundSize = `${percentage}% 100%`;
        };

        slider.addEventListener('input', updateSlider);
        updateSlider(); // Init
    });
}

// Ensure initSliders is called when content loads or modals open
document.addEventListener('DOMContentLoaded', initSliders);
// Also export for use in modals
window.initSliders = initSliders;

// Override open modal functions to init sliders (if they exist)
const existingOpenAppearance = window.openAppearanceModal;
window.openAppearanceModal = function () {
    if (document.getElementById('appearance-modal')) {
        document.getElementById('appearance-modal').style.display = 'flex';
        setTimeout(initSliders, 10);
    }
    if (existingOpenAppearance) existingOpenAppearance();
};
// --- DISCORD INTEGRATION ---
function loadDiscordSettings() {
    fetch('/api/integrations/discord', { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(data => {
            const urlInput = document.getElementById('discord-webhook-url');
            if (urlInput) urlInput.value = data.url || '';

            if (data.events) {
                if (document.getElementById('discord-evt-start')) document.getElementById('discord-evt-start').checked = data.events.start || false;
                if (document.getElementById('discord-evt-stop')) document.getElementById('discord-evt-stop').checked = data.events.stop || false;
                if (document.getElementById('discord-evt-join')) document.getElementById('discord-evt-join').checked = data.events.join || false;
            }
        })
        .catch(err => console.error('Error loading discord settings:', err));
}

function saveDiscordSettings() {
    const url = document.getElementById('discord-webhook-url').value;
    const events = {
        start: document.getElementById('discord-evt-start').checked,
        stop: document.getElementById('discord-evt-stop').checked,
        join: document.getElementById('discord-evt-join').checked
    };

    api('integrations/discord', { url, events })
        .then(() => {
            Toastify({
                text: t('msg.saved'),
                style: { background: "#10b981" }
            }).showToast();
        })
        .catch(err => {
            Toastify({
                text: t('msg.error'),
                style: { background: "#ef4444" }
            }).showToast();
        });
}

// Version Injection in Login
document.addEventListener('DOMContentLoaded', () => {
    const verSpan = document.getElementById('login-version');
    if (verSpan) {
        fetch('/api/version')
            .then(r => r.json())
            .then(data => {
                if (data && data.version) {
                    verSpan.innerText = data.version;
                } else {
                    verSpan.innerText = '1.7.0'; // Fallback
                }
            })
            .catch(() => {
                verSpan.innerText = '1.7.0'; // Fallback on error
            });
    }
});
