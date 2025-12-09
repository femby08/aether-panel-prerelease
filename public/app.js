const socket = io();
let cpuChart, ramChart;
const MAX_DATA = 20;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Cargar Versión
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if(el) {
                el.innerText = 'v' + data.version;
                el.classList.remove('loading'); // Quitar estilo de carga si lo hubiera
            }
        });

    // 2. Iniciar Gráficas
    initCharts();

    // 3. Bucle de Monitorización (Cada 1s)
    setInterval(updateStats, 1000);

    // 4. Iniciar Terminal
    initTerminal();

    // 5. Cargar Configuración si estamos en la pestaña
    if(document.querySelector('#tab-config.active')) {
        loadConfig();
    }
});

// --- MONITOR ---
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // Textos
        document.getElementById('cpu-val').innerText = Math.round(data.cpu) + '%';
        document.getElementById('ram-val').innerText = (data.ram_used / 1024).toFixed(1) + ' GB';

        // Gráficas
        pushData(cpuChart, data.cpu);
        pushData(ramChart, (data.ram_used / data.ram_total) * 100);

    } catch(e) { console.error(e); }
}

function pushData(chart, val) {
    if(!chart) return;
    chart.data.datasets[0].data.push(val);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

function initCharts() {
    const opts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 } },
        animation: false
    };

    const ctxCpu = document.getElementById('cpu-chart').getContext('2d');
    cpuChart = new Chart(ctxCpu, {
        type: 'line',
        data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#a855f7', borderWidth: 2, fill: true, backgroundColor: 'rgba(168, 85, 247, 0.2)' }] },
        options: opts
    });

    const ctxRam = document.getElementById('ram-chart').getContext('2d');
    ramChart = new Chart(ctxRam, {
        type: 'line',
        data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#3b82f6', borderWidth: 2, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.2)' }] },
        options: opts
    });
}

// --- CONFIGURACIÓN ---
function loadConfig() {
    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('cfg-list');
            list.innerHTML = '';
            
            Object.keys(data).forEach(key => {
                list.innerHTML += `
                <div class="setting-row" style="margin-bottom:10px; display:flex; justify-content:space-between;">
                    <label style="color:#aaa">${key}</label>
                    <input class="cfg-input" data-key="${key}" value="${data[key]}" style="background:#222; border:1px solid #444; color:white; padding:5px; border-radius:4px;">
                </div>`;
            });
        });
}

function saveCfg() {
    const inputs = document.querySelectorAll('.cfg-input');
    const newCfg = {};
    inputs.forEach(i => newCfg[i.dataset.key] = i.value);

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCfg)
    })
    .then(r => r.json())
    .then(() => {
        loadConfig(); // Recargar para confirmar
        alert('Configuración guardada');
    });
}

// --- TERMINAL ---
function initTerminal() {
    // Configuración básica de xterm.js
    if(!window.Terminal) return;
    const term = new Terminal({ theme: { background: '#111' } });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    socket.on('console_data', (d) => term.write(d));
    socket.on('logs_history', (d) => term.write(d));

    term.onData(data => {
        if(data === '\r') { /* Enviar buffer al socket */ }
        // socket.emit('command', ...);
    });
}

// --- UTILIDADES ---
window.setTab = (name) => {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if(name === 'config') loadConfig();
};

window.api = (endpoint) => fetch('/api/' + endpoint, { method: 'POST' });
window.saveCfg = saveCfg;
