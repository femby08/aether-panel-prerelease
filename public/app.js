const socket = io();
let cpuChart, ramChart;
const MAX_DATA = 20;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Aether Panel UI Loaded");

    // 1. Cargar Versión limpia
    fetch('/api/info').then(r => r.json()).then(d => {
        const el = document.getElementById('version-display');
        if (el) {
            el.innerText = 'v' + (d.version || '1.0.0');
            el.style.opacity = '0.7'; el.style.marginLeft = '8px';
        }
    });

    // 2. Iniciar Gráficas
    initCharts();

    // 3. Monitor
    setInterval(updateStats, 2000);
    updateStats();

    // 4. Terminal
    initTerminal();

    // 5. Cargar Config si estamos en esa pestaña
    if (document.getElementById('tab-config')?.classList.contains('active')) {
        loadConfig();
    }
});

// ==========================================
// CONFIGURACIÓN (EDITOR DE PROPERTIES)
// ==========================================
window.loadConfig = function() {
    const list = document.getElementById('cfg-list');
    if (!list) return;
    
    // Mostrar indicador de carga
    list.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">Cargando propiedades...</div>';

    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            list.innerHTML = ''; // Limpiar

            if (Object.keys(data).length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">No se encontró server.properties. Inicia el servidor primero.</div>';
                return;
            }

            // Ordenar: Primero las importantes, luego el resto alfabéticamente
            const priorityKeys = ['motd', 'server-port', 'max-players', 'white-list', 'online-mode', 'pvp', 'difficulty', 'level-name'];
            const sortedKeys = Object.keys(data).sort((a, b) => {
                const idxA = priorityKeys.indexOf(a);
                const idxB = priorityKeys.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            sortedKeys.forEach(key => {
                const value = data[key];
                const isBoolean = value === 'true' || value === 'false';
                
                let inputHtml = '';
                
                if (isBoolean) {
                    // Renderizar como Switch
                    const checked = value === 'true' ? 'checked' : '';
                    inputHtml = `
                        <div class="switch-wrapper">
                            <span class="switch-status">${value === 'true' ? 'ON' : 'OFF'}</span>
                            <label class="toggle-switch">
                                <input type="checkbox" class="cfg-bool" data-key="${key}" ${checked} onchange="this.previousElementSibling.innerText = this.checked ? 'ON' : 'OFF'">
                                <span class="slider"></span>
                            </label>
                        </div>
                    `;
                } else {
                    // Renderizar como Texto
                    inputHtml = `<input class="cfg-in" data-key="${key}" value="${value}" spellcheck="false">`;
                }

                // Añadir fila
                list.innerHTML += `
                <div class="setting-row" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                    <label style="color:#ccc; font-family:'JetBrains Mono', monospace; font-size:0.9rem;">${key}</label>
                    ${inputHtml}
                </div>`;
            });
        })
        .catch(e => {
            console.error(e);
            list.innerHTML = '<p style="color:red; text-align:center;">Error al cargar configuración.</p>';
        });
};

window.saveCfg = function() {
    const newConf = {};
    
    // Recoger Inputs de Texto
    document.querySelectorAll('.cfg-in').forEach(el => {
        newConf[el.dataset.key] = el.value;
    });

    // Recoger Switches (Booleanos)
    document.querySelectorAll('.cfg-bool').forEach(el => {
        newConf[el.dataset.key] = el.checked ? 'true' : 'false';
    });

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConf)
    })
    .then(r => r.json())
    .then(() => {
        if(window.Toastify) Toastify({text: "✅ Configuración guardada", style:{background:"#10b981"}}).showToast();
        window.loadConfig(); // Recargar visualmente
    });
};

// ==========================================
// GRÁFICAS Y DATOS
// ==========================================
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // Textos
        if(document.getElementById('cpu-val')) document.getElementById('cpu-val').innerText = Math.round(data.cpu) + '%';
        if(document.getElementById('ram-val')) document.getElementById('ram-val').innerText = (data.ram_used / 1024).toFixed(1) + ' GB';
        if(document.getElementById('disk-val')) document.getElementById('disk-val').innerText = Math.round(data.disk_used) + ' MB';
        
        // Barra Disco
        const bar = document.getElementById('disk-bar');
        if(bar) bar.style.width = ((data.disk_used / data.disk_total) * 100) + '%';

        // Gráficas
        if (cpuChart) pushData(cpuChart, data.cpu);
        if (ramChart) pushData(ramChart, (data.ram_used / data.ram_total) * 100);

    } catch (e) { }
}

function pushData(chart, val) {
    chart.data.datasets[0].data.push(val);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

function initCharts() {
    const commonOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 } }, animation: false
    };

    const ctxCpu = document.getElementById('cpu-chart');
    if (ctxCpu) {
        const grad = ctxCpu.getContext('2d').createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        
        cpuChart = new Chart(ctxCpu, {
            type: 'line',
            data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#a855f7', borderWidth: 2, fill: true, backgroundColor: grad }] },
            options: commonOpts
        });
    }

    const ctxRam = document.getElementById('ram-chart');
    if (ctxRam) {
        const grad = ctxRam.getContext('2d').createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ramChart = new Chart(ctxRam, {
            type: 'line',
            data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#3b82f6', borderWidth: 2, fill: true, backgroundColor: grad }] },
            options: commonOpts
        });
    }
}

// ==========================================
// UTILS
// ==========================================
window.setTab = function(name) {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const tab = document.getElementById('tab-' + name);
    const nav = document.getElementById('nav-' + name);
    if (tab) tab.classList.add('active');
    if (nav) nav.classList.add('active');

    // Cargar config al abrir la pestaña
    if (name === 'config') window.loadConfig();
    if (name === 'console') window.dispatchEvent(new Event('resize'));
};

window.checkUpdate = function() {
    closeAllModals();
    if(window.Toastify) Toastify({text: "🔍 Buscando...", style:{background:"#3b82f6"}}).showToast();
    fetch('/api/update/check').then(r => r.json()).then(d => {
        if (d.type !== 'none') {
            const modal = document.getElementById('update-modal');
            modal.classList.add('active');
            document.getElementById('update-text').innerText = `Versión disponible: ${d.remote}`;
            document.getElementById('up-actions').innerHTML = `<button class="btn btn-primary" onclick="performUpdate('${d.type}')">Actualizar</button>`;
        } else {
            if(window.Toastify) Toastify({text: "✅ Sistema actualizado", style:{background:"#10b981"}}).showToast();
        }
    });
};

window.performUpdate = function(type) {
    fetch('/api/update/perform', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type })
    }).then(r => r.json()).then(() => {
        closeAllModals();
        if(window.Toastify) Toastify({text: "🚀 Actualizando...", style:{background:"#f59e0b"}}).showToast();
        setTimeout(() => location.reload(), 2000);
    });
};

window.forceUIUpdate = function() {
    if(confirm("¿Recargar interfaz?")) location.reload();
};

window.closeAllModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
};

window.api = function(endpoint) {
    fetch('/api/' + endpoint, { method: 'POST' });
};

// Terminal
function initTerminal() {
    const termDiv = document.getElementById('terminal');
    if (termDiv && window.Terminal) {
        termDiv.innerHTML = '';
        const term = new Terminal({ theme: { background: '#0f0f13' }, fontFamily: 'monospace' });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termDiv);
        fitAddon.fit();
        term.writeln('\x1b[1;36m>>> AETHER PANEL CONECTADO.\x1b[0m\r\n');
        socket.on('console_data', (d) => term.write(d));
        socket.on('logs_history', (d) => term.write(d));
        term.onData(d => { if (d === '\r') term.write('\r\n'); socket.emit('command', d); });
    }
}
