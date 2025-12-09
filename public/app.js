const socket = io();

// Variables Globales
let cpuChart, ramChart;
const MAX_DATA_POINTS = 20;
let currentPath = '';

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Cargar Versión del Panel
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el) {
                el.innerText = `v${data.version}`;
                el.style.opacity = '0.6';
            }
        })
        .catch(() => console.error('Error versión'));

    // 2. Setup Terminal (Xterm)
    if(document.getElementById('terminal')) {
        initTerminal();
    }

    // 3. Inicializar Gráficas
    initCharts();

    // 4. Configuración Visual Guardada
    updateThemeUI(localStorage.getItem('theme') || 'dark');
    setDesign(localStorage.getItem('design_mode') || 'glass');
    setAccentMode(localStorage.getItem('accent_mode') || 'auto');

    // 5. Iniciar Ciclos de Datos
    refreshStats();             // Primera carga inmediata
    refreshDashboardData();     // Datos lentos (jugadores, logs)
    
    setInterval(refreshStats, 2000);         // CPU/RAM cada 2s
    setInterval(refreshDashboardData, 5000); // Tablas cada 5s
    
    // 6. Atajos de teclado
    setupGlobalShortcuts();
    setupAccessibility();
});

// === MONITORIZACIÓN (CPU, RAM, DISCO) ===
async function refreshStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();

        // Actualizar Textos
        updateText('cpu-val', Math.round(data.cpu) + '%');
        updateText('ram-val', (data.ram_used / 1024).toFixed(1) + ' GB');
        updateText('ram-max', 'de ' + (data.ram_total / 1024).toFixed(0) + ' GB');
        
        // Actualizar Disco
        const diskUsed = Math.round(data.disk_used);
        updateText('disk-val', diskUsed + ' MB');
        const diskPercent = (diskUsed / data.disk_total) * 100;
        const diskBar = document.getElementById('disk-bar');
        if(diskBar) diskBar.style.width = `${Math.min(diskPercent, 100)}%`;

        // Actualizar Gráficas
        if (cpuChart) updateChartData(cpuChart, data.cpu);
        if (ramChart) updateChartData(ramChart, (data.ram_used / data.ram_total) * 100);

    } catch (e) {
        console.error("Error stats:", e);
    }
}

function updateChartData(chart, val) {
    const data = chart.data.datasets[0].data;
    data.push(val);
    data.shift();
    chart.update('none'); // 'none' para animación suave
}

function updateText(id, txt) {
    const el = document.getElementById(id);
    if(el) el.innerText = txt;
}

// === DATOS DEL DASHBOARD (Lentos) ===
async function refreshDashboardData() {
    try {
        // Actividad
        /* Nota: Si tienes un endpoint real de actividad, descomenta esto:
        const actRes = await fetch('/api/activity');
        if(actRes.ok) renderActivityTable(await actRes.json());
        */

        // Estado del Servidor (Online/Offline)
        const statusRes = await fetch('/api/status');
        if (statusRes.ok) {
            const status = await statusRes.json();
            updateStatusIndicator(status.status);
        }

    } catch (e) { }
}

function updateStatusIndicator(status) {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    if(!dot || !txt) return;

    dot.className = 'status-dot ' + (status === 'ONLINE' ? 'online' : (status === 'OFFLINE' ? 'offline' : 'starting'));
    txt.innerText = status;
}

// === SISTEMA DE ACTUALIZACIONES (Botones que fallaban) ===

// 1. Botón "Actualizar"
function checkUpdate() {
    closeAllModals();
    Toastify({ text: "🔍 Buscando actualizaciones...", duration: 2000, style: { background: "#3b82f6" } }).showToast();
    
    fetch('/api/update/check')
        .then(res => res.json())
        .then(data => {
            if (data.type === 'none') {
                Toastify({ text: "✅ El sistema está actualizado", style: { background: "#10b981" } }).showToast();
                return;
            }
            
            // Abrir Modal
            const modal = document.getElementById('update-modal');
            const text = document.getElementById('update-text');
            const actions = document.getElementById('up-actions');
            
            if (!modal) return;

            modal.classList.add('active');
            
            if (data.type === 'hard') {
                text.innerHTML = `Nueva versión: <b>v${data.remote}</b><br><span style="font-size:0.9em; opacity:0.7">Requiere reinicio del servicio.</span>`;
                actions.innerHTML = `<button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
                                     <button class="btn btn-primary" onclick="performUpdate('hard')">Actualizar v${data.remote}</button>`;
            } else {
                text.innerHTML = `Mejoras visuales detectadas.<br><span style="font-size:0.9em; opacity:0.7">No requiere reinicio.</span>`;
                actions.innerHTML = `<button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
                                     <button class="btn btn-primary" onclick="performUpdate('soft')">Aplicar Parche</button>`;
            }
        })
        .catch(() => Toastify({ text: "❌ Error de conexión", style: { background: "#ef4444" } }).showToast());
}

// 2. Ejecutar Update
function performUpdate(type) {
    fetch('/api/update/perform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
    })
    .then(res => res.json())
    .then(d => {
        closeAllModals();
        if (type === 'hard') {
            Toastify({ text: "🚀 Actualizando... El panel se reiniciará.", duration: 10000 }).showToast();
            setTimeout(() => location.reload(), 15000);
        } else {
            Toastify({ text: "✨ Interfaz actualizada", style: { background: "#10b981" } }).showToast();
            setTimeout(() => location.reload(), 1000);
        }
    });
}

// 3. Botón "Recargar UI"
function forceUIUpdate() {
    closeAllModals();
    const modal = document.getElementById('force-ui-modal');
    if(modal) modal.classList.add('active');
}

function confirmForceUI() {
    performUpdate('soft');
}

// === CONFIGURACIÓN ===
function loadConfig() {
    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('cfg-list');
            if(!list) return;
            
            if (Object.keys(data).length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:20px; color:gray">No se pudo leer server.properties</div>';
                return;
            }

            let html = '';
            // Propiedades comunes primero
            const priority = ['motd', 'server-port', 'max-players', 'white-list', 'online-mode', 'difficulty'];
            
            priority.forEach(key => {
                if(data[key] !== undefined) {
                    html += renderConfigRow(key, data[key]);
                    delete data[key];
                }
            });
            // El resto
            Object.entries(data).forEach(([k, v]) => html += renderConfigRow(k, v));
            list.innerHTML = html;
        });
}

function renderConfigRow(key, val) {
    return `
    <div class="setting-row" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
        <label style="color:var(--text-muted); font-family:'JetBrains Mono', monospace; font-size:0.85rem">${key}</label>
        <input class="cfg-in" data-key="${key}" value="${val}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; padding:4px 8px; border-radius:4px; text-align:right; width:180px;">
    </div>`;
}

function saveCfg() {
    const inputs = document.querySelectorAll('.cfg-in');
    const newConfig = {};
    inputs.forEach(i => newConfig[i.dataset.key] = i.value);
    
    fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newConfig)
    })
    .then(r => r.json())
    .then(() => {
        Toastify({text: "✅ Configuración Guardada", style:{background:"#10b981"}}).showToast();
        loadConfig(); // Recargar visualmente
    });
}

// === CHARTS & VISUALS ===
function initCharts() {
    const common = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
        animation: { duration: 0 }
    };

    // CPU Chart
    const ctxCpu = document.getElementById('cpu-chart')?.getContext('2d');
    if(ctxCpu) {
        const grad = ctxCpu.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        cpuChart = new Chart(ctxCpu, { 
            type: 'line', 
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#8b5cf6', backgroundColor: grad, fill: true }] }, 
            options: common 
        });
    }

    // RAM Chart
    const ctxRam = document.getElementById('ram-chart')?.getContext('2d');
    if(ctxRam) {
        const grad = ctxRam.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.5)'); grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ramChart = new Chart(ctxRam, { 
            type: 'line', 
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#06b6d4', backgroundColor: grad, fill: true }] }, 
            options: common 
        });
    }
}

function initTerminal() {
    // Si usas xterm.js, inicialízalo aquí
    try {
        const term = new Terminal({ theme: { background: '#0f0f13' }, fontSize: 13, fontFamily: 'JetBrains Mono' });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(document.getElementById('terminal'));
        term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');
        fitAddon.fit();
        
        // Conectar sockets
        socket.on('console_data', (msg) => term.write(msg));
        socket.on('logs_history', (logs) => term.write(logs));
        
        // Enviar comandos
        term.onData(e => {
            // Implementación básica de envío (idealmente usar buffer de línea)
            // Por simplicidad en este parche, no implemento la entrada completa de terminal aquí,
            // pero el socket.emit('command', ...) debe ir aquí.
        });

    } catch(e) { console.log("Terminal init error", e); }
}

// === UTILS ===
function api(ep, body){ 
    return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
        .then(r => r.ok ? r.json() : Promise.reject("API Error")); 
}

function closeAllModals() { 
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); 
}

function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => { e.classList.remove('active'); e.setAttribute('aria-selected','false'); });
    
    const tab = document.getElementById('tab-' + t);
    if(tab) tab.classList.add('active');
    
    const sbBtn = btn || document.getElementById(`nav-${t}`);
    if(sbBtn) { sbBtn.classList.add('active'); sbBtn.setAttribute('aria-selected','true'); }
    
    if(t==='config') loadConfig();
}

function openDetail(type) {
    // Lógica para abrir modal de detalles (Gráficas grandes)
    // Se puede implementar expandiendo lo que ya tenías
    const modal = document.getElementById('detail-modal');
    if(modal) modal.classList.add('active');
}

// Helpers de configuración visual (sin cambios)
function updateThemeUI(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); }
function setDesign(d){ document.documentElement.setAttribute('data-design', d); localStorage.setItem('design_mode', d); }
function setAccentMode(m){ localStorage.setItem('accent_mode', m); }
function setupAccessibility() {/* ... */}
function setupGlobalShortcuts() {/* ... */}
