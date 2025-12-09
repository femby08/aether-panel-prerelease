const socket = io();
let cpuChart, ramChart;
const MAX_DATA = 20;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar Versión
    fetch('/api/info').then(r => r.json()).then(d => {
        const el = document.getElementById('version-display');
        if (el) {
            el.innerText = 'v' + (d.version || '1.0.0');
            el.style.opacity = '0.7'; el.style.marginLeft = '8px';
        }
    });

    // 2. Gráficas
    initCharts();

    // 3. Monitor
    setInterval(updateStats, 2000);
    updateStats();

    // 4. Terminal
    initTerminal();

    // 5. Configuración
    if (document.getElementById('tab-config')?.classList.contains('active')) {
        loadConfig();
    }
});

// ==========================================
// FORMATEO DE DATOS (FIX NÚMEROS LOCOS)
// ==========================================
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ==========================================
// ACTUALIZAR ESTADÍSTICAS
// ==========================================
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // CPU
        if(document.getElementById('cpu-val')) 
            document.getElementById('cpu-val').innerText = Math.round(data.cpu) + '%';

        // RAM (SOLUCIÓN NÚMEROS LARGOS)
        if(document.getElementById('ram-val')) {
            // data.ram_used viene en bytes, usamos formatBytes
            document.getElementById('ram-val').innerText = formatBytes(data.ram_used);
        }

        // DISCO
        if(document.getElementById('disk-val')) {
            // data.disk_used viene en bytes
            document.getElementById('disk-val').innerText = formatBytes(data.disk_used);
        }
        
        // BARRA DE DISCO
        const bar = document.getElementById('disk-bar');
        if(bar) {
            const percent = (data.disk_used / data.disk_total) * 100;
            bar.style.width = Math.min(percent, 100) + '%';
        }

        // GRÁFICAS
        if (cpuChart) pushData(cpuChart, data.cpu);
        if (ramChart) {
            // Calcular porcentaje RAM para la gráfica
            const ramPercent = (data.ram_used / data.ram_total) * 100;
            pushData(ramChart, ramPercent);
        }

    } catch (e) { }
}

function pushData(chart, val) {
    chart.data.datasets[0].data.push(val);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

// ==========================================
// CONFIGURACIÓN (EDITOR VISUAL MEJORADO)
// ==========================================
window.loadConfig = function() {
    const list = document.getElementById('cfg-list');
    if (!list) return;
    
    list.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">Cargando...</div>';

    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            list.innerHTML = ''; 

            if (Object.keys(data).length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Sin configuración. Inicia el servidor.</div>';
                return;
            }

            const priorityKeys = ['motd', 'server-port', 'max-players', 'white-list', 'online-mode', 'pvp', 'difficulty'];
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
                    const checked = value === 'true' ? 'checked' : '';
                    inputHtml = `
                        <label class="toggle-switch">
                            <input type="checkbox" class="cfg-bool" data-key="${key}" ${checked}>
                            <span class="slider"></span>
                        </label>
                    `;
                } else {
                    // INPUT DE TEXTO MEJORADO (Estilo en CSS)
                    inputHtml = `<input class="cfg-in" data-key="${key}" value="${value}" spellcheck="false">`;
                }

                list.innerHTML += `
                <div class="setting-row">
                    <label>${key}</label>
                    ${inputHtml}
                </div>`;
            });
        });
};

window.saveCfg = function() {
    const newConf = {};
    document.querySelectorAll('.cfg-in').forEach(el => newConf[el.dataset.key] = el.value);
    document.querySelectorAll('.cfg-bool').forEach(el => newConf[el.dataset.key] = el.checked ? 'true' : 'false');

    fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConf)
    }).then(() => {
        if(window.Toastify) Toastify({text: "Guardado", style:{background:"#10b981"}}).showToast();
        window.loadConfig();
    });
};

// ==========================================
// UTILS
// ==========================================
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
        cpuChart = new Chart(ctxCpu, { type: 'line', data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#a855f7', borderWidth: 2, fill: true, backgroundColor: grad }] }, options: commonOpts });
    }

    const ctxRam = document.getElementById('ram-chart');
    if (ctxRam) {
        const grad = ctxRam.getContext('2d').createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ramChart = new Chart(ctxRam, { type: 'line', data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#3b82f6', borderWidth: 2, fill: true, backgroundColor: grad }] }, options: commonOpts });
    }
}

window.setTab = function(name) {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const tab = document.getElementById('tab-' + name);
    const nav = document.getElementById('nav-' + name);
    if (tab) tab.classList.add('active');
    if (nav) nav.classList.add('active');

    if (name === 'config') window.loadConfig();
    if (name === 'console') window.dispatchEvent(new Event('resize'));
};

window.checkUpdate = function() {
    closeAllModals();
    if(window.Toastify) Toastify({text: "Buscando...", style:{background:"#3b82f6"}}).showToast();
    fetch('/api/update/check').then(r=>r.json()).then(d=>{
        if(d.type!=='none') {
            const m = document.getElementById('update-modal');
            m.classList.add('active');
            document.getElementById('update-text').innerText = `Nueva versión: ${d.remote}`;
            document.getElementById('up-actions').innerHTML = `<button class="btn btn-primary" onclick="performUpdate('${d.type}')">Actualizar</button>`;
        } else {
            if(window.Toastify) Toastify({text: "Sistema Actualizado", style:{background:"#10b981"}}).showToast();
        }
    });
};

window.performUpdate = function(type) {
    fetch('/api/update/perform', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type})})
    .then(() => { location.reload(); });
};

window.forceUIUpdate = function() { if(confirm("¿Recargar?")) location.reload(); };
window.closeAllModals = function() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); };
window.api = function(ep) { fetch('/api/'+ep, {method:'POST'}); };

function initTerminal() {
    const termDiv = document.getElementById('terminal');
    if (termDiv && window.Terminal) {
        termDiv.innerHTML = '';
        const term = new Terminal({ theme: { background: '#0f0f13' }, fontFamily: 'monospace' });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termDiv);
        fitAddon.fit();
        term.writeln('\x1b[1;36m>>> AETHER PANEL.\x1b[0m\r\n');
        socket.on('console_data', d => term.write(d));
        socket.on('logs_history', d => term.write(d));
        term.onData(d => { if(d==='\r') term.write('\r\n'); socket.emit('command', d); });
    }
}
