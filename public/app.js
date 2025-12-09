const socket = io();

// Variables globales
let cpuChart, ramChart;
const MAX_DATA_POINTS = 20;
let term, fitAddon;

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar Terminal
    if(document.getElementById('terminal')) {
        try {
            term = new Terminal({ 
                theme: { background: '#09090b', foreground: '#10b981' },
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14
            });
            fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term.open(document.getElementById('terminal'));
            term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');
            fitAddon.fit();
            
            // Eventos Socket
            socket.on('console_data', (data) => term.writeln(data));
            socket.on('logs_history', (logs) => term.write(logs));
            
            // Enviar comandos al presionar Enter
            term.onData(e => {
                // Implementación simple de input xterm requeriría más lógica, 
                // pero por ahora recibimos logs.
            });
        } catch(e){ console.error("Terminal error", e); }
    }

    // 2. Obtener Versión
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el) el.innerText = `v${data.version || '1.0.0'}`;
        })
        .catch(() => {});

    // 3. Cargar Preferencias Visuales
    updateThemeUI(localStorage.getItem('theme') || 'dark');
    setDesign(localStorage.getItem('design_mode') || 'glass');
    
    // 4. Iniciar
    initCharts();
    refreshDashboardData();
    setInterval(refreshDashboardData, 2000); // Refrescar cada 2s
});

// === PERSONALIZACIÓN VISUAL ===
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

// === DATOS & MONITOR ===
async function refreshDashboardData() {
    try {
        // Stats
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            
            document.getElementById('cpu-val').innerText = stats.cpu.toFixed(1) + '%';
            document.getElementById('ram-val').innerText = (stats.ram_used / 1024 / 1024 / 1024).toFixed(1) + ' GB';
            document.getElementById('disk-val').innerText = (stats.disk_used / 1024 / 1024).toFixed(0) + ' MB';
            document.getElementById('disk-bar').style.width = Math.min(((stats.disk_used / stats.disk_total) * 100), 100) + '%';

            if(cpuChart) updateChart(cpuChart, stats.cpu);
            if(ramChart) updateChart(ramChart, (stats.ram_used / stats.ram_total) * 100);
        }

        // Estado
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
    } catch (e) { console.error("Error dashboard", e); }
}

function initCharts() {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 }, line: { tension: 0.3 } },
        animation: false
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

// === CONFIGURACIÓN Y WHITELIST ===
function loadConfig() {
    fetch('/api/config').then(r => r.json()).then(data => {
        const container = document.getElementById('cfg-list');
        container.innerHTML = '';

        const isWhiteListEnabled = data['white-list'] === 'true';
        
        // 1. Sección Whitelist
        let html = `
        <div class="settings-card" style="border-color: ${isWhiteListEnabled ? 'var(--success)' : 'rgba(255,255,255,0.05)'}">
            <div class="setting-row">
                <span style="font-weight:bold"><i class="fa-solid fa-scroll"></i> Whitelist</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="wl-toggle" ${isWhiteListEnabled ? 'checked' : ''} onchange="toggleWhitelist(this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.05)">
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="wl-add-input" placeholder="Usuario de Minecraft..." style="flex:1; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:var(--text-main);">
                    <button class="btn btn-primary" onclick="addToWhitelist()">Añadir</button>
                </div>
                <div id="whitelist-names" style="display:flex; flex-wrap:wrap; gap:8px; max-height:150px; overflow-y:auto; padding:5px; background:rgba(0,0,0,0.2); border-radius:8px; min-height:40px;">
                    <span style="color:gray; font-size:0.8rem; padding:10px;">Cargando...</span>
                </div>
            </div>
        </div>
        <div class="card-subtitle" style="margin-top:25px;">Propiedades del Servidor</div>
        `;

        // 2. Generador de inputs dinámicos
        Object.entries(data).forEach(([key, value]) => {
            if(key === 'white-list') return; // Ya mostrada arriba
            
            let inputHtml = '';
            if(value === 'true' || value === 'false') {
                inputHtml = `
                <select class="cfg-in" data-key="${key}" style="background:rgba(0,0,0,0.3); color:var(--text-main); border:1px solid rgba(255,255,255,0.1); padding:5px; border-radius:6px;">
                    <option value="true" ${value==='true'?'selected':''}>True</option>
                    <option value="false" ${value==='false'?'selected':''}>False</option>
                </select>`;
            } else {
                inputHtml = `<input class="cfg-in" data-key="${key}" value="${value}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); padding:8px 12px; border-radius:8px; width:200px; text-align:right;">`;
            }

            html += `
            <div class="setting-row" style="border-bottom:1px solid rgba(255,255,255,0.05); padding:8px 0;">
                <label style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.85rem">${key}</label>
                ${inputHtml}
            </div>`;
        });

        container.innerHTML = html;
        loadWhitelistUsers();
    });
}

// Funciones Whitelist
async function loadWhitelistUsers() {
    try {
        const res = await fetch('/api/whitelist');
        const users = await res.json();
        const div = document.getElementById('whitelist-names');
        if(!div) return;
        
        div.innerHTML = users.length === 0 ? '<span style="color:gray; font-size:0.8rem; padding:5px;">Lista vacía</span>' : '';
        
        users.forEach(u => {
            const tag = document.createElement('div');
            tag.className = 'status-badge info';
            tag.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px 10px; cursor:default; background:rgba(59, 130, 246, 0.15); color:#60a5fa; border:1px solid rgba(59, 130, 246, 0.3); border-radius:6px;';
            tag.innerHTML = `<span>${u.name}</span> <i class="fa-solid fa-xmark" style="cursor:pointer; color:#ef4444; margin-left:5px;" onclick="removeFromWhitelist('${u.name}')" title="Eliminar"></i>`;
            div.appendChild(tag);
        });
    } catch(e) { console.error("Error whitelist load", e); }
}

async function addToWhitelist() {
    const input = document.getElementById('wl-add-input');
    const name = input.value.trim();
    if(!name) return;

    try {
        const res = await fetch('/api/whitelist');
        const current = await res.json();
        
        // Evitar duplicados
        if(current.some(u => u.name.toLowerCase() === name.toLowerCase())) {
            Toastify({text: "El usuario ya está en la lista", style:{background:"#f59e0b"}}).showToast();
            return;
        }

        const newEntry = { uuid: crypto.randomUUID(), name: name };
        current.push(newEntry);
        
        await fetch('/api/whitelist', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(current)
        });
        
        input.value = '';
        loadWhitelistUsers();
        Toastify({text: `Usuario ${name} añadido`, style:{background:"#10b981"}}).showToast();
    } catch(e) { console.error(e); }
}

async function removeFromWhitelist(name) {
    try {
        const res = await fetch('/api/whitelist');
        const current = await res.json();
        const newLists = current.filter(u => u.name !== name);
        
        await fetch('/api/whitelist', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(newLists)
        });
        loadWhitelistUsers();
        Toastify({text: `Usuario ${name} eliminado`, style:{background:"#ef4444"}}).showToast();
    } catch(e) { console.error(e); }
}

function toggleWhitelist(enabled) {
    // Hack visual rápido
    const cfg = {};
    document.querySelectorAll('.cfg-in').forEach(i => cfg[i.dataset.key] = i.value);
    cfg['white-list'] = enabled ? 'true' : 'false';
    
    api('config', cfg).then(() => {
        Toastify({text: `Whitelist ${enabled ? 'ACTIVADA' : 'DESACTIVADA'}`, style:{background: enabled ? "#10b981" : "#f59e0b"}}).showToast();
        loadConfig(); // Recargar para actualizar UI
    });
}

function saveCfg() {
    const newConfig = {};
    document.querySelectorAll('.cfg-in').forEach(input => newConfig[input.dataset.key] = input.value);
    
    // Asegurar que el toggle de whitelist se guarde también
    const wlToggle = document.getElementById('wl-toggle');
    if(wlToggle) newConfig['white-list'] = wlToggle.checked ? 'true' : 'false';

    api('config', newConfig).then(() => {
        Toastify({text: "Configuración Guardada", style:{background:"#10b981"}}).showToast();
    });
}

// === GENERAL UTILS ===
function api(ep, body){ 
    return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
        .then(r => r.ok ? r.json() : Promise.reject("API Error")); 
}

function setTab(t) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    
    const target = document.getElementById('tab-' + t);
    const btn = document.getElementById(`nav-${t}`);
    
    if(target) target.classList.add('active');
    if(btn) btn.classList.add('active');
    
    if(t==='config') loadConfig();
    if(t==='console' && fitAddon) setTimeout(()=>fitAddon.fit(), 100);
}

function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); }
function apiPower(action) { api('power/'+action).then(() => Toastify({text: "Comando enviado: "+action}).showToast()); }
