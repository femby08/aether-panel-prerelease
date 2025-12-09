const socket = io();
let currentPath = '';

// Variables para Charts
let cpuChart, ramChart;
const MAX_DATA_POINTS = 20;
let term, fitAddon;

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Xterm (Consola)
    if(document.getElementById('terminal')) {
        try {
            term = new Terminal({ 
                theme: { background: '#00000000', foreground: '#10b981' }, // Fondo transparente para glass
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                cursorBlink: true
            });
            fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term.open(document.getElementById('terminal'));
            term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');
            
            // Ajustar tamaño
            setTimeout(() => fitAddon.fit(), 200);
            window.addEventListener('resize', () => fitAddon.fit());

            // Listeners Socket
            socket.on('console_data', (data) => term.writeln(data));
            socket.on('logs_history', (logs) => term.write(logs));
        } catch(e){ console.error("Error Terminal", e); }
    }

    // 2. Info Servidor (ARREGLADO: Usa API en vez de archivo directo)
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el) el.innerText = `v${data.version || '1.6.2'}`;
        })
        .catch(() => {});

    // 3. Restaurar Preferencias Visuales (ARREGLADO)
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedDesign = localStorage.getItem('design_mode') || 'glass';
    setTheme(savedTheme);
    setDesign(savedDesign);

    // 4. Iniciar Gráficas y Ciclo de Datos
    initCharts();
    refreshDashboardData();
    setInterval(refreshDashboardData, 2000); // Actualizar cada 2s
});

// === LÓGICA DE APARIENCIA (ARREGLADO) ===
function setTheme(theme) {
    if(theme === 'auto') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Actualizar botones UI
    document.querySelectorAll('[id^="theme-btn-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`theme-btn-${theme}`);
    if(btn) btn.classList.add('active');
}

function setDesign(mode) {
    document.documentElement.setAttribute('data-design', mode);
    localStorage.setItem('design_mode', mode);
    document.querySelectorAll('[id^="modal-btn-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`modal-btn-${mode}`);
    if(btn) btn.classList.add('active');
}

function setAccentColor(color) {
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--primary-glow', color + '99');
}

// === DATOS EN TIEMPO REAL ===
async function refreshDashboardData() {
    try {
        // Stats
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            
            // Textos
            document.getElementById('cpu-val').innerText = stats.cpu.toFixed(1) + '%';
            document.getElementById('ram-val').innerText = (stats.ram_used / 1024 / 1024 / 1024).toFixed(1) + ' GB';
            document.getElementById('disk-val').innerText = (stats.disk_used / 1024 / 1024).toFixed(0) + ' MB';
            document.getElementById('disk-bar').style.width = Math.min(((stats.disk_used / stats.disk_total) * 100), 100) + '%';

            // Gráficas
            if(cpuChart) updateChart(cpuChart, stats.cpu);
            if(ramChart) updateChart(ramChart, (stats.ram_used / stats.ram_total) * 100);
        }

        // Estado Servidor
        const statusRes = await fetch('/api/status');
        if(statusRes.ok) {
            const data = await statusRes.json();
            const dot = document.getElementById('status-dot');
            const txt = document.getElementById('status-text');
            
            txt.innerText = data.status;
            let statusClass = 'offline';
            if(data.status === 'ONLINE') statusClass = 'online';
            else if(data.status === 'STARTING' || data.status === 'STOPPING') statusClass = 'starting';
            
            dot.className = 'status-dot ' + statusClass;
        }
    } catch (e) {}
}

// === SISTEMA DE GRÁFICAS ===
function initCharts() {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 }, line: { tension: 0.3, borderWidth: 2 } },
        animation: false
    };

    const ctxCpu = document.getElementById('cpu-chart')?.getContext('2d');
    if(ctxCpu) {
        // Gradiente Púrpura
        const grad = ctxCpu.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        
        cpuChart = new Chart(ctxCpu, { 
            type: 'line', 
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#8b5cf6', backgroundColor: grad, fill: true }] }, 
            options: commonOptions 
        });
    }

    const ctxRam = document.getElementById('ram-chart')?.getContext('2d');
    if(ctxRam) {
        // Gradiente Azul
        const grad = ctxRam.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.5)'); grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        
        ramChart = new Chart(ctxRam, { 
            type: 'line', 
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#06b6d4', backgroundColor: grad, fill: true }] }, 
            options: commonOptions 
        });
    }
}

function updateChart(chart, value) {
    if(!chart) return;
    const data = chart.data.datasets[0].data;
    data.push(value); 
    data.shift();
    chart.update();
}

// === CONFIGURACIÓN Y WHITELIST (AQUÍ ESTÁ LO NUEVO) ===
function loadConfig() {
    fetch('/api/config').then(r => r.json()).then(data => {
        const container = document.getElementById('cfg-list');
        container.innerHTML = ''; // Limpiar

        const isWhiteListEnabled = data['white-list'] === 'true';

        // 1. INYECTAR PANEL WHITELIST (Visualmente integrado)
        let html = `
        <div class="settings-card" style="border-color: ${isWhiteListEnabled ? 'var(--success)' : 'rgba(255,255,255,0.05)'}; margin-bottom: 20px;">
            <div class="setting-row">
                <span style="font-weight:bold; color:var(--text-main)"><i class="fa-solid fa-scroll"></i> Whitelist (Lista Blanca)</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="wl-toggle" ${isWhiteListEnabled ? 'checked' : ''} onchange="toggleWhitelist(this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.05)">
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="wl-add-input" placeholder="Nombre de usuario..." style="flex:1; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:var(--text-main);">
                    <button class="btn btn-primary" onclick="addToWhitelist()"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div id="whitelist-names" style="display:flex; flex-wrap:wrap; gap:8px; max-height:150px; overflow-y:auto; padding:5px;">
                    <span style="color:gray; font-size:0.8rem;">Cargando jugadores...</span>
                </div>
            </div>
        </div>
        <div class="card-subtitle">Propiedades del Servidor (Server.properties)</div>
        `;

        // 2. GENERAR INPUTS DE PROPIEDADES
        Object.entries(data).forEach(([key, value]) => {
            if(key === 'white-list') return; // Ya está arriba

            let inputElement;
            if (value === 'true' || value === 'false') {
                inputElement = `
                <div class="segment-box" style="padding:2px">
                    <button class="seg-btn ${value==='true'?'active':''}" onclick="updatePropUI(this, 'true')" style="font-size:0.75rem; padding:4px 8px">ON</button>
                    <button class="seg-btn ${value==='false'?'active':''}" onclick="updatePropUI(this, 'false')" style="font-size:0.75rem; padding:4px 8px">OFF</button>
                    <input type="hidden" class="cfg-in" data-key="${key}" value="${value}">
                </div>`;
            } else {
                inputElement = `<input class="cfg-in" data-key="${key}" value="${value}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); padding:6px 12px; border-radius:8px; width:180px; text-align:right;">`;
            }

            html += `
            <div class="setting-row" style="border-bottom:1px solid rgba(255,255,255,0.05); padding:8px 0;">
                <label style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.85rem">${key}</label>
                ${inputElement}
            </div>`;
        });

        container.innerHTML = html;
        loadWhitelistUsers(); // Cargar lista de nombres
    });
}

// Helpers para inputs visuales
function updatePropUI(btn, val) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    parent.querySelector('input').value = val;
}

// === GESTIÓN WHITELIST (Lógica) ===
async function loadWhitelistUsers() {
    try {
        const res = await fetch('/api/whitelist');
        const users = await res.json();
        const div = document.getElementById('whitelist-names');
        if(!div) return;
        
        div.innerHTML = users.length === 0 ? '<span style="color:var(--text-muted); font-size:0.8rem; padding:5px; font-style:italic">Lista vacía. Añade un jugador.</span>' : '';
        
        users.forEach(u => {
            const tag = document.createElement('div');
            tag.className = 'status-badge info';
            tag.style.cssText = 'display:flex; align-items:center; gap:8px; padding:6px 12px; cursor:default; background:rgba(59, 130, 246, 0.15); color:#60a5fa; border:1px solid rgba(59, 130, 246, 0.3); border-radius:8px;';
            tag.innerHTML = `<span>${u.name}</span> <i class="fa-solid fa-xmark" style="cursor:pointer; color:#ef4444; margin-left:5px; opacity:0.7" onclick="removeFromWhitelist('${u.name}')"></i>`;
            div.appendChild(tag);
        });
    } catch(e) {}
}

async function addToWhitelist() {
    const input = document.getElementById('wl-add-input');
    const name = input.value.trim();
    if(!name) return;

    const res = await fetch('/api/whitelist');
    const current = await res.json();
    current.push({ uuid: crypto.randomUUID(), name: name }); // UUID falso si no hay online mode
    
    await fetch('/api/whitelist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(current) });
    input.value = '';
    loadWhitelistUsers();
    Toastify({text: `+ ${name} añadido`, style:{background:"#10b981"}}).showToast();
}

async function removeFromWhitelist(name) {
    const res = await fetch('/api/whitelist');
    let current = await res.json();
    current = current.filter(u => u.name !== name);
    
    await fetch('/api/whitelist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(current) });
    loadWhitelistUsers();
    Toastify({text: `- ${name} eliminado`, style:{background:"#ef4444"}}).showToast();
}

function toggleWhitelist(enabled) {
    const cfg = {};
    document.querySelectorAll('.cfg-in').forEach(i => cfg[i.dataset.key] = i.value);
    cfg['white-list'] = enabled ? 'true' : 'false';
    api('config', cfg).then(() => {
        Toastify({text: `Whitelist: ${enabled?'ON':'OFF'}`, style:{background: enabled?"#10b981":"#f59e0b"}}).showToast();
        loadConfig(); // Recargar UI
    });
}

function saveCfg() {
    const newConfig = {};
    document.querySelectorAll('.cfg-in').forEach(input => newConfig[input.dataset.key] = input.value);
    
    // Asegurar whitelist toggle state
    const wl = document.getElementById('wl-toggle');
    if(wl) newConfig['white-list'] = wl.checked ? 'true' : 'false';

    api('config', newConfig).then(() => {
        Toastify({text: "Configuración Guardada", style:{background:"#10b981"}}).showToast();
    });
}

// === UTILS GENERALES ===
function api(ep, body){ 
    return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
        .then(r => r.ok ? r.json() : Promise.reject("API Error")); 
}

function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => { e.classList.remove('active'); });
    
    const target = document.getElementById('tab-' + t);
    const navBtn = btn || document.getElementById('nav-' + t);
    
    if(target) target.classList.add('active');
    if(navBtn) navBtn.classList.add('active');
    
    if(t==='config') loadConfig();
    if(t==='console' && fitAddon) setTimeout(()=>fitAddon.fit(), 100);
}

function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); }

// Modales vacíos o placeholders (para mantener compatibilidad con tu HTML)
function openModStore() { Toastify({text: "Tienda de Mods: Próximamente", style:{background:"#8b5cf6"}}).showToast(); }
function openDetail(type) { /* Lógica de detalles si la necesitas */ }
function loadVersions(type) { Toastify({text: "Versiones: Funcionalidad simulada", style:{background:"#3b82f6"}}).showToast(); }
function uploadFile() { Toastify({text: "Subir archivo...", style:{background:"#10b981"}}).showToast(); }
function createBackup() { Toastify({text: "Backup iniciado", style:{background:"#10b981"}}).showToast(); }
function checkUpdate() { Toastify({text: "Sistema actualizado", style:{background:"#10b981"}}).showToast(); }
function forceUIUpdate() { location.reload(); }
function copyIP() { navigator.clipboard.writeText(location.hostname); Toastify({text: "IP Copiada", style:{background:"#10b981"}}).showToast(); }

// Exponer funciones globalmente para el HTML
window.setTab = setTab;
window.setTheme = setTheme;
window.setDesign = setDesign;
window.setAccentColor = setAccentColor;
window.closeAllModals = closeAllModals;
window.api = api;
window.saveCfg = saveCfg;
window.toggleWhitelist = toggleWhitelist;
window.addToWhitelist = addToWhitelist;
window.removeFromWhitelist = removeFromWhitelist;
window.openModStore = openModStore;
window.loadVersions = loadVersions;
window.uploadFile = uploadFile;
window.createBackup = createBackup;
window.checkUpdate = checkUpdate;
window.forceUIUpdate = forceUIUpdate;
window.copyIP = copyIP;
