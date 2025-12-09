const socket = io();
let currentPath = '';

// Variables para Charts
let cpuChart, ramChart, detailChart;
const MAX_DATA_POINTS = 20;
let SERVER_MODE = 'cracked'; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Xterm
    if(document.getElementById('terminal')) {
        try {
            window.term = new Terminal({ theme: { background: '#09090b' } });
            window.fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term.open(document.getElementById('terminal'));
            term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');
            setTimeout(() => fitAddon.fit(), 200);
            
            socket.on('console_data', (data) => term.write(data));
            socket.on('logs_history', (data) => term.write(data));
            
            term.onData(e => {
                if(e === '\r') socket.emit('command', currLine), currLine = '';
                else if(e === '\u007F') { if(currLine.length > 0) { currLine = currLine.slice(0, -1); term.write('\b \b'); } }
                else { currLine += e; term.write(e); }
            });
            let currLine = '';
        } catch(e){ console.log("Terminal error", e); }
    }

    // 2. Info Servidor (ARREGLADO: usa /api/info)
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el && data.version) el.innerText = `v${data.version}`;
        })
        .catch(() => console.log('Error cargando versión'));

    // 3. Init Config Visual (NUEVO: Lógica de Temas)
    const storedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(storedTheme); // Aplicar tema al iniciar
    
    setDesign(localStorage.getItem('design_mode') || 'glass');

    // 4. Inicializar Sistemas
    setupGlobalShortcuts();
    setupAccessibility();
    initCharts();
    
    // Carga inicial
    refreshDashboardData();
    setInterval(refreshDashboardData, 3000);
});

// --- THEME LOGIC (NUEVO) ---
function setTheme(theme) {
    if (theme === 'auto') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Actualizar botones visuales
    document.querySelectorAll('.segment-box button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`theme-btn-${localStorage.getItem('theme') || 'auto'}`);
    if(btn) btn.classList.add('active');
}

function setDesign(mode) {
    document.documentElement.setAttribute('data-design', mode);
    localStorage.setItem('design_mode', mode);
    
    document.getElementById('modal-btn-glass')?.classList.remove('active');
    document.getElementById('modal-btn-material')?.classList.remove('active');
    document.getElementById(`modal-btn-${mode}`)?.classList.add('active');
}

// --- DATA FETCHING (REAL) ---
async function refreshDashboardData() {
    try {
        // 1. Stats (REALES)
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            
            // Actualizar Gráficas
            updateChart(cpuChart, stats.cpu);
            const ramPercent = (stats.ram_used / stats.ram_total) * 100;
            updateChart(ramChart, ramPercent);
            
            // Textos
            document.getElementById('cpu-val').innerText = stats.cpu.toFixed(1) + '%';
            document.getElementById('ram-val').innerText = (stats.ram_used / 1024 / 1024 / 1024).toFixed(1) + ' GB';
            document.getElementById('ram-max').innerText = 'de ' + (stats.ram_total / 1024 / 1024 / 1024).toFixed(1) + ' GB';
            
            // Disco
            const diskPercent = (stats.disk_used / stats.disk_total) * 100;
            document.getElementById('disk-val').innerText = (stats.disk_used / 1024 / 1024).toFixed(0) + ' MB';
            document.getElementById('disk-bar').style.width = diskPercent + '%';
        }

        // 2. Jugadores (REALES)
        const playersRes = await fetch('/api/players');
        if (playersRes.ok) {
            const players = await playersRes.json();
            updateDashboardAvatars(players);
            document.getElementById('players-val').innerText = `${players.length}`; 
        }

    } catch (e) { console.error("Error fetching data", e); }
}

// --- RENDERIZADO DE TABLAS Y AVATARES ---
function getAvatarHTML(name, size = 'sm') {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const color = colors[name.length % colors.length];
    
    // Fallback simple: siempre iniciales si no hay online mode seguro
    const initial = name.charAt(0).toUpperCase();
    return `<div class="avatar-initial ${size}" style="background-color: ${color}">${initial}</div>`;
}

function updateDashboardAvatars(playersList) {
    const container = document.getElementById('players-preview');
    if (!container) return;
    
    let html = '';
    if (playersList.length === 0) {
        html = '<span style="font-size:0.8rem; color:var(--text-muted); margin-left:10px">Nadie en línea</span>';
    } else {
        playersList.slice(0, 3).forEach((p, i) => {
            html += `<div class="avatar-stack-item" style="z-index: ${4-i}">${getAvatarHTML(p, 'sm')}</div>`;
        });
        if(playersList.length > 3) {
            html += `<div class="avatar-stack-item count" style="z-index: 0">+${playersList.length - 3}</div>`;
        }
    }
    container.innerHTML = html;
}

// --- CONFIG & WHITELIST ---
function loadConfig() {
    // Cargar properties
    api('config').then(data => {
        let html = '<h4 style="margin:20px 0 10px; color:var(--primary-light)">Server Properties</h4>';
        // Añadir campos más comunes primero
        const common = ['server-port', 'max-players', 'motd', 'white-list', 'online-mode', 'difficulty', 'gamemode'];
        
        common.forEach(key => {
            if(data[key] !== undefined) {
                html += createConfigRow(key, data[key]);
                delete data[key]; // Remover para no duplicar
            }
        });
        
        // El resto
        Object.entries(data).forEach(([key, value]) => {
            html += createConfigRow(key, value);
        });
        
        document.getElementById('cfg-list').innerHTML = html + getWhitelistUI();
        loadWhitelistData(); // Cargar datos de la whitelist
    }).catch(err => {
        document.getElementById('cfg-list').innerHTML = '<p style="color:red">Error cargando configuración.</p>';
    });
}

function createConfigRow(key, value) {
    return `
    <div class="setting-row" style="margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px;">
        <label style="font-weight:600; color:var(--text-muted); font-family:var(--font-mono); font-size:0.85rem">${key}</label>
        <input class="cfg-in" data-key="${key}" value="${value}" 
               style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px 12px; border-radius:8px; width:200px; text-align:right;">
    </div>`;
}

function getWhitelistUI() {
    return `
    <div style="margin-top:40px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px">
            <h4 style="margin:0; color:var(--primary-light)">Whitelist</h4>
            <div style="display:flex; gap:10px">
                <input id="wl-add-input" type="text" placeholder="Nombre de usuario" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white; padding:6px 12px; border-radius:6px;">
                <button class="btn btn-primary" onclick="addToWhitelist()" style="padding:6px 12px; font-size:0.8rem">Añadir</button>
            </div>
        </div>
        <div id="whitelist-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:12px; min-height:50px;">
            <p style="color:gray; font-size:0.8rem; grid-column:1/-1; text-align:center">Cargando...</p>
        </div>
    </div>
    `;
}

function loadWhitelistData() {
    fetch('/api/whitelist').then(r => r.json()).then(list => {
        const container = document.getElementById('whitelist-container');
        if(list.length === 0) {
            container.innerHTML = '<p style="color:gray; font-size:0.8rem; grid-column:1/-1; text-align:center">Lista vacía</p>';
            return;
        }
        let html = '';
        list.forEach(u => {
            html += `
            <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600; font-size:0.9rem">${u.name}</span>
                <button onclick="removeFromWhitelist('${u.name}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        container.innerHTML = html;
    });
}

function addToWhitelist() {
    const name = document.getElementById('wl-add-input').value;
    if(!name) return;
    api('whitelist', { action: 'add', name }).then(() => {
        document.getElementById('wl-add-input').value = '';
        loadWhitelistData();
    });
}

function removeFromWhitelist(name) {
    if(confirm(`¿Eliminar a ${name}?`)) {
        api('whitelist', { action: 'remove', name }).then(() => loadWhitelistData());
    }
}

function saveConfig() {
    const inputs = document.querySelectorAll('.cfg-in');
    const newConfig = {};
    inputs.forEach(input => newConfig[input.dataset.key] = input.value);
    
    api('config', newConfig).then(res => {
        Toastify({text: "Configuración Guardada", style:{background:"#10b981"}}).showToast();
    });
}


// --- CHARTS SYSTEM ---
function initCharts() {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
        animation: { duration: 0 }
    };

    const ctxCpu = document.getElementById('cpu-chart')?.getContext('2d');
    if(ctxCpu) {
        const grad = ctxCpu.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        cpuChart = new Chart(ctxCpu, { type: 'line', data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#8b5cf6', backgroundColor: grad, fill: true }] }, options: commonOptions });
    }

    const ctxRam = document.getElementById('ram-chart')?.getContext('2d');
    if(ctxRam) {
        const grad = ctxRam.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.5)'); grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ramChart = new Chart(ctxRam, { type: 'line', data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#06b6d4', backgroundColor: grad, fill: true }] }, options: commonOptions });
    }
}

function updateChart(chart, value) {
    if(!chart) return;
    const data = chart.data.datasets[0].data;
    data.push(value); data.shift();
    chart.update();
}

// --- UTILS BÁSICOS ---
function api(ep, body){ 
    return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
        .then(r => r.ok ? r.json() : Promise.reject("API Error")); 
}

function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key >= '1' && e.key <= '5') {
            e.preventDefault();
            const tabs = ['stats','console','versions','labs','config'];
            setTab(tabs[e.key-1]);
        }
    });
}

function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => { e.classList.remove('active'); e.setAttribute('aria-selected','false'); });
    document.getElementById('tab-' + t).classList.add('active');
    const sbBtn = btn || document.querySelector(`#nav-${t}`);
    if(sbBtn) { sbBtn.classList.add('active'); }
    if(t==='console' && window.fitAddon) setTimeout(()=>fitAddon.fit(),100);
    if(t==='config') loadConfig();
}

// Modales
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); }

// Dummy functions para evitar errores si no se usan aún
function loadFiles(){}
function uploadFile(){}
function createBackup(){}
function loadBackups(){}
function openDetail(){}
function checkUpdate(){}
function forceUIUpdate(){}
function setupAccessibility(){}
function saveCfg(){ saveConfig(); }
