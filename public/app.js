const socket = io();
let currentPath = '';

// Variables para Charts
let cpuChart, ramChart;
const MAX_DATA_POINTS = 20;

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Xterm
    if(document.getElementById('terminal')) {
        try {
            const term = new Terminal({ theme: { background: '#09090b' } });
            const fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term.open(document.getElementById('terminal'));
            term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');
            fitAddon.fit();
            
            // Socket Listeners
            socket.on('console_data', (data) => term.writeln(data));
            socket.on('logs_history', (logs) => term.write(logs));
        } catch(e){ console.error("Terminal error", e); }
    }

    // 2. Info Servidor (Arreglado: Usa /api/info en vez de package.json)
    fetch('/api/info')
        .then(response => response.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el) el.innerText = `v${data.version || '1.0.0'}`;
        })
        .catch(() => {});

    // 3. Init Config Visual (Arreglado: Funciones implementadas abajo)
    updateThemeUI(localStorage.getItem('theme') || 'dark');
    setDesign(localStorage.getItem('design_mode') || 'glass');
    
    // 4. Inicializar Gráficas
    initCharts();
    
    // 5. Ciclo de datos
    refreshDashboardData();
    setInterval(refreshDashboardData, 2000); // 2 segundos para más fluidez
});

// === LOGICA DE TEMA & DISEÑO (ARREGLADO) ===
function setTheme(theme) {
    if(theme === 'auto') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeUI(theme);
}

function updateThemeUI(theme) {
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

// === DATOS EN TIEMPO REAL (ARREGLADO) ===
async function refreshDashboardData() {
    try {
        // 1. Estadísticas (CPU/RAM/DISCO)
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            
            // Actualizar textos
            document.getElementById('cpu-val').innerText = stats.cpu.toFixed(1) + '%';
            document.getElementById('ram-val').innerText = (stats.ram_used / 1024 / 1024 / 1024).toFixed(1) + ' GB';
            document.getElementById('disk-val').innerText = (stats.disk_used / 1024 / 1024).toFixed(0) + ' MB';
            document.getElementById('disk-bar').style.width = ((stats.disk_used / stats.disk_total) * 100) + '%';

            // Actualizar Gráficas
            if(cpuChart) updateChart(cpuChart, stats.cpu);
            if(ramChart) updateChart(ramChart, (stats.ram_used / stats.ram_total) * 100);
        }

        // 2. Estado del Servidor
        const statusRes = await fetch('/api/status');
        if(statusRes.ok) {
            const data = await statusRes.json();
            const dot = document.getElementById('status-dot');
            const txt = document.getElementById('status-text');
            
            txt.innerText = data.status;
            dot.className = 'status-dot ' + (data.status === 'ONLINE' ? 'online' : (data.status === 'OFFLINE' ? 'offline' : 'starting'));
        }

    } catch (e) { console.error("Error dashboard", e); }
}

// === GRÁFICAS ===
function initCharts() {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 }, line: { tension: 0.3 } },
        animation: false // Desactivar animación para rendimiento real
    };

    const ctxCpu = document.getElementById('cpu-chart')?.getContext('2d');
    if(ctxCpu) {
        cpuChart = new Chart(ctxCpu, { 
            type: 'line', 
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#8b5cf6', borderWidth: 2, fill: true, backgroundColor: '#8b5cf633' }] }, 
            options: commonOptions 
        });
    }

    const ctxRam = document.getElementById('ram-chart')?.getContext('2d');
    if(ctxRam) {
        ramChart = new Chart(ctxRam, { 
            type: 'line', 
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#06b6d4', borderWidth: 2, fill: true, backgroundColor: '#06b6d433' }] }, 
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

// === CONFIGURACIÓN Y WHITELIST (ARREGLADO) ===
function loadConfig() {
    // Cargar Server Properties
    fetch('/api/config').then(r => r.json()).then(data => {
        const container = document.getElementById('cfg-list');
        container.innerHTML = '';

        // Separar Whitelist del resto para mostrarla arriba
        const isWhiteListEnabled = data['white-list'] === 'true';
        
        // 1. Cabecera Whitelist
        let html = `
        <div class="settings-card" style="border-color: ${isWhiteListEnabled ? 'var(--success)' : 'var(--glass-border)'}">
            <div class="setting-row">
                <span><i class="fa-solid fa-scroll"></i> Whitelist (Lista Blanca)</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="wl-toggle" ${isWhiteListEnabled ? 'checked' : ''} onchange="toggleWhitelist(this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <div style="margin-top:10px;">
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="wl-add-input" placeholder="Nombre de usuario..." style="flex:1; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:white;">
                    <button class="btn btn-primary" onclick="addToWhitelist()">Añadir</button>
                </div>
                <div id="whitelist-names" style="display:flex; flex-wrap:wrap; gap:8px; max-height:150px; overflow-y:auto; padding:5px; background:rgba(0,0,0,0.2); border-radius:8px;">
                    <span style="color:gray; font-size:0.8rem; padding:10px;">Cargando jugadores...</span>
                </div>
            </div>
        </div>
        <div class="card-subtitle" style="margin-top:20px;">Propiedades del Servidor (Server.properties)</div>
        `;

        // 2. Resto de Propiedades (Todas, no solo las hardcoded)
        Object.entries(data).forEach(([key, value]) => {
            if(key === 'white-list') return; // Ya la manejamos arriba
            
            // Detectar booleanos para poner switches o dropdowns
            let inputHtml = '';
            if(value === 'true' || value === 'false') {
                inputHtml = `
                <select class="cfg-in" data-key="${key}" style="background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); padding:5px; border-radius:6px;">
                    <option value="true" ${value==='true'?'selected':''}>True</option>
                    <option value="false" ${value==='false'?'selected':''}>False</option>
                </select>`;
            } else {
                inputHtml = `<input class="cfg-in" data-key="${key}" value="${value}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px 12px; border-radius:8px; width:200px; text-align:right;">`;
            }

            html += `
            <div class="setting-row" style="border-bottom:1px solid rgba(255,255,255,0.05); padding:8px 0;">
                <label style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.85rem">${key}</label>
                ${inputHtml}
            </div>`;
        });

        container.innerHTML = html;
        loadWhitelistUsers(); // Cargar nombres
    });
}

// === GESTIÓN WHITELIST ===
async function loadWhitelistUsers() {
    const res = await fetch('/api/whitelist');
    const users = await res.json();
    const div = document.getElementById('whitelist-names');
    if(!div) return;
    
    div.innerHTML = users.length === 0 ? '<span style="color:gray; font-size:0.8rem; padding:5px;">Lista vacía</span>' : '';
    
    users.forEach(u => {
        const tag = document.createElement('div');
        tag.className = 'status-badge info';
        tag.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px 10px; cursor:default';
        tag.innerHTML = `<span>${u.name}</span> <i class="fa-solid fa-xmark" style="cursor:pointer; color:var(--danger)" onclick="removeFromWhitelist('${u.name}')"></i>`;
        div.appendChild(tag);
    });
}

async function addToWhitelist() {
    const input = document.getElementById('wl-add-input');
    const name = input.value.trim();
    if(!name) return;

    // Obtener lista actual y añadir
    const res = await fetch('/api/whitelist');
    const current = await res.json();
    
    // Generar UUID falso para offline mode o usar api externa (aquí simplificado)
    const newEntry = { uuid: crypto.randomUUID(), name: name };
    current.push(newEntry);
    
    await fetch('/api/whitelist', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(current)
    });
    
    input.value = '';
    loadWhitelistUsers();
    Toastify({text: `Usuario ${name} añadido`, style:{background:"#10b981"}}).showToast();
}

async function removeFromWhitelist(name) {
    const res = await fetch('/api/whitelist');
    const current = await res.json();
    const newLists = current.filter(u => u.name !== name);
    
    await fetch('/api/whitelist', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newLists)
    });
    loadWhitelistUsers();
}

function toggleWhitelist(enabled) {
    // Cambiar solo el valor en server.properties sin guardar todo lo demás aun
    // Esto es un "hack" visual, lo ideal es guardar todo, pero para UX rápida:
    const inputs = document.querySelectorAll('.cfg-in');
    // Creamos objeto config actual
    const cfg = {};
    inputs.forEach(i => cfg[i.dataset.key] = i.value);
    cfg['white-list'] = enabled ? 'true' : 'false';
    
    api('config', cfg).then(() => {
        Toastify({text: `Whitelist ${enabled ? 'Activada' : 'Desactivada'}`, style:{background: enabled ? "#10b981" : "#f59e0b"}}).showToast();
        // Recargar estilo del borde
        loadConfig(); 
    });
}

function saveCfg() {
    const inputs = document.querySelectorAll('.cfg-in');
    const newConfig = {};
    inputs.forEach(input => newConfig[input.dataset.key] = input.value);
    
    // Mantener estado whitelist que no está en inputs clase .cfg-in
    const wlToggle = document.getElementById('wl-toggle');
    if(wlToggle) newConfig['white-list'] = wlToggle.checked ? 'true' : 'false';

    api('config', newConfig).then(() => {
        Toastify({text: "Configuración Guardada y Server Actualizado", style:{background:"#10b981"}}).showToast();
    });
}

// === UTILS ===
function api(ep, body){ 
    return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
        .then(r => r.ok ? r.json() : Promise.reject("API Error")); 
}

function setTab(t) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-' + t).classList.add('active');
    const btn = document.getElementById(`nav-${t}`);
    if(btn) btn.classList.add('active');
    
    if(t==='config') loadConfig();
}

function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); }
function apiPower(action) { api('power/'+action).then(() => Toastify({text: "Comando enviado: "+action}).showToast()); }
