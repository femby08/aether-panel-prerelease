// Inicializar Socket.io
const socket = io();

// Variables globales para gráficas
let cpuChart, ramChart;
const MAX_DATA_POINTS = 20;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. OBTENER VERSIÓN DEL PANEL (Arregla el "Cargando...")
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el) {
                el.innerText = 'v' + data.version;
                el.style.opacity = '0.7'; 
                el.style.marginLeft = '8px';
            }
        }).catch(e => console.log("Error version"));

    // 2. INICIALIZAR GRÁFICAS (Chart.js)
    initCharts();

    // 3. MONITORIZACIÓN (Polling cada 2 seg)
    setInterval(updateStats, 2000);
    updateStats(); // Ejecutar una vez al inicio

    // 4. TERMINAL (Si existe en el HTML)
    initTerminal();

    // 5. Configuración visual (Tu código original)
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
});

// === LÓGICA DE GRÁFICAS Y ESTADÍSTICAS ===
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // Actualizar Textos
        if(document.getElementById('cpu-val')) 
            document.getElementById('cpu-val').innerText = Math.round(data.cpu) + '%';
        
        if(document.getElementById('ram-val')) 
            document.getElementById('ram-val').innerText = (data.ram_used / 1024).toFixed(1) + ' GB';

        if(document.getElementById('disk-val'))
            document.getElementById('disk-val').innerText = Math.round(data.disk_used) + ' MB';

        // Actualizar Barra de Disco
        const diskBar = document.getElementById('disk-bar');
        if(diskBar) {
            const pct = (data.disk_used / data.disk_total) * 100;
            diskBar.style.width = pct + '%';
        }

        // Mover Gráficas
        if(cpuChart) updateChart(cpuChart, data.cpu);
        if(ramChart) updateChart(ramChart, (data.ram_used / data.ram_total) * 100);

    } catch(e) {}
}

function updateChart(chart, val) {
    const data = chart.data.datasets[0].data;
    data.push(val);
    data.shift();
    chart.update('none'); // 'none' para animación suave
}

function initCharts() {
    const commonOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 } }, animation: false
    };

    const ctxCpu = document.getElementById('cpu-chart');
    if(ctxCpu) {
        cpuChart = new Chart(ctxCpu.getContext('2d'), {
            type: 'line',
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#a855f7', borderWidth: 2, fill: true, backgroundColor: 'rgba(168, 85, 247, 0.2)' }] },
            options: commonOpts
        });
    }

    const ctxRam = document.getElementById('ram-chart');
    if(ctxRam) {
        ramChart = new Chart(ctxRam.getContext('2d'), {
            type: 'line',
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#3b82f6', borderWidth: 2, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.2)' }] },
            options: commonOpts
        });
    }
}

// === CONFIGURACIÓN (Arregla la lista vacía) ===
function loadConfig() {
    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('cfg-list');
            if(!list) return;
            list.innerHTML = '';
            
            Object.keys(data).forEach(key => {
                list.innerHTML += `
                <div class="setting-row" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                    <label style="color:#ccc; font-family:monospace;">${key}</label>
                    <input class="cfg-in" data-key="${key}" value="${data[key]}" style="background:rgba(0,0,0,0.3); border:1px solid #444; color:white; padding:5px; text-align:right; border-radius:4px;">
                </div>`;
            });
        });
}

function saveCfg() {
    const inputs = document.querySelectorAll('.cfg-in');
    const newConf = {};
    inputs.forEach(el => newConf[el.dataset.key] = el.value);

    fetch('/api/config', {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(newConf)
    })
    .then(r => r.json())
    .then(data => {
        loadConfig(); // Recargar visualmente
        if(window.Toastify) Toastify({text: "Guardado", style:{background:"green"}}).showToast();
    });
}

// === NAVEGACIÓN (Tabs) ===
function setTab(name) {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const tab = document.getElementById('tab-' + name);
    const nav = document.getElementById('nav-' + name);
    if(tab) tab.classList.add('active');
    if(nav) nav.classList.add('active');

    if(name === 'config') loadConfig();
    if(name === 'console') window.dispatchEvent(new Event('resize'));
}

// === TERMINAL ===
function initTerminal() {
    const termDiv = document.getElementById('terminal');
    if(termDiv && window.Terminal) {
        const term = new Terminal({ theme: { background: '#1e1e1e' } });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termDiv);
        fitAddon.fit();
        
        socket.on('console_data', (d) => term.write(d));
        socket.on('logs_history', (d) => term.write(d));
        
        term.onData(data => {
            // Aquí iría el envío de comandos al socket
            if(data === '\r') term.write('\r\n'); // Echo local simple
            // socket.emit('command', ...);
        });
    }
}

// === GLOBALES ===
// Funciones necesarias para los botones onclick del HTML
window.setTab = setTab;
window.saveCfg = saveCfg;
window.checkUpdate = () => alert("Update check simulado");
window.forceUIUpdate = () => location.reload();
window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
window.api = (ep) => fetch('/api/'+ep, {method:'POST'});
