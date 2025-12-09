const socket = io();
let cpuChart, ramChart;
const MAX_DATA = 20;

// === INICIO ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("Aether Panel: Pre-Release UI Loaded");

    // 1. Versión
    fetch('/api/info').then(r => r.json()).then(d => {
        const el = document.getElementById('version-display');
        if(el) {
            el.innerText = 'v' + d.version;
            el.style.opacity = '0.7'; el.style.marginLeft = '8px';
        }
    });

    // 2. Iniciar Gráficas
    initCharts();

    // 3. Monitor
    setInterval(updateStats, 1500); // 1.5s refresco
    updateStats();

    // 4. Terminal
    initTerminal();

    // 5. Cargar Config si estamos en esa pestaña
    if(document.querySelector('#tab-config.active')) loadConfig();
});

// === GRÁFICAS Y DATOS ===
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // Textos
        if(document.getElementById('cpu-val')) document.getElementById('cpu-val').innerText = Math.round(data.cpu) + '%';
        if(document.getElementById('ram-val')) document.getElementById('ram-val').innerText = (data.ram_used / 1073741824).toFixed(1) + ' GB';
        if(document.getElementById('disk-val')) document.getElementById('disk-val').innerText = (data.disk_used / 1048576).toFixed(0) + ' MB';
        
        // Barra Disco
        const bar = document.getElementById('disk-bar');
        if(bar) bar.style.width = Math.min((data.disk_used / data.disk_total) * 100, 100) + '%';

        // Gráficas
        if(cpuChart) pushData(cpuChart, data.cpu);
        if(ramChart) pushData(ramChart, (data.ram_used / data.ram_total) * 100);

    } catch(e) {}
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

    // ADAPTACIÓN: Buscamos 'cpu-chart' (tu HTML) o 'cpuChart' (original)
    const ctxCpu = document.getElementById('cpu-chart') || document.getElementById('cpuChart');
    if (ctxCpu) {
        cpuChart = new Chart(ctxCpu.getContext('2d'), {
            type: 'line',
            data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#a855f7', borderWidth: 2, fill: true, backgroundColor: 'rgba(168, 85, 247, 0.2)' }] },
            options: commonOpts
        });
    }

    const ctxRam = document.getElementById('ram-chart') || document.getElementById('ramChart');
    if (ctxRam) {
        ramChart = new Chart(ctxRam.getContext('2d'), {
            type: 'line',
            data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#3b82f6', borderWidth: 2, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.2)' }] },
            options: commonOpts
        });
    }
}

// === CONFIGURACIÓN ===
window.loadConfig = function() {
    fetch('/api/config').then(r => r.json()).then(data => {
        const list = document.getElementById('cfg-list');
        if(!list) return;
        list.innerHTML = '';
        
        Object.keys(data).forEach(key => {
            // Estilo visual del repo estable
            list.innerHTML += `
            <div class="setting-row" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                <label style="color:#aaa; font-family:monospace;">${key}</label>
                <input class="cfg-in" data-key="${key}" value="${data[key]}" style="background:rgba(0,0,0,0.3); border:1px solid #444; color:white; padding:5px; text-align:right; border-radius:4px;">
            </div>`;
        });
    });
};

window.saveCfg = function() {
    const inputs = document.querySelectorAll('.cfg-in');
    const newConf = {};
    inputs.forEach(el => newConf[el.dataset.key] = el.value);

    fetch('/api/config', {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(newConf)
    }).then(() => {
        window.loadConfig();
        if(window.Toastify) Toastify({text: "Configuración Guardada", style:{background:"#10b981"}}).showToast();
    });
};

// === UPDATES (Botones que fallaban) ===
window.checkUpdate = function() {
    window.closeAllModals();
    if(window.Toastify) Toastify({text: "🔍 Buscando actualizaciones...", style:{background:"#3b82f6"}}).showToast();
    
    fetch('/api/update/check').then(r=>r.json()).then(d => {
        if(d.type !== 'none') {
            const m = document.getElementById('update-modal');
            const t = document.getElementById('update-text');
            const a = document.getElementById('up-actions');
            if(m && t && a) {
                m.classList.add('active');
                t.innerHTML = `Versión disponible: <b>${d.remote}</b>`;
                a.innerHTML = `<button class="btn btn-secondary" onclick="closeAllModals()">Cancelar</button>
                               <button class="btn btn-primary" onclick="performUpdate('${d.type}')">Actualizar</button>`;
            }
        } else {
             if(window.Toastify) Toastify({text: "✅ Sistema actualizado", style:{background:"#10b981"}}).showToast();
        }
    });
};

window.performUpdate = function(type) {
    fetch('/api/update/perform', {
        method:'POST', 
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type})
    }).then(r=>r.json()).then(d => {
        window.closeAllModals();
        if(window.Toastify) Toastify({text: "¡Actualización Simulada Exitosa!", style:{background:"#f59e0b"}}).showToast();
        setTimeout(() => location.reload(), 1500);
    });
};

window.forceUIUpdate = function() {
    if(confirm("¿Recargar Interfaz?")) location.reload();
};

// === UTILS ===
window.setTab = function(name) {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const tab = document.getElementById('tab-' + name);
    const nav = document.getElementById('nav-' + name); // Intenta buscar por ID
    
    if(tab) tab.classList.add('active');
    if(nav) nav.classList.add('active');
    else {
        // Fallback: busca el botón que llamó a la función
        const btn = document.querySelector(`button[onclick*="'${name}'"]`);
        if(btn) btn.classList.add('active');
    }

    if(name === 'config') window.loadConfig();
    if(name === 'console') window.dispatchEvent(new Event('resize'));
};

window.closeAllModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
};

window.api = (ep) => fetch('/api/'+ep, {method:'POST'});

// Terminal
function initTerminal() {
    const termDiv = document.getElementById('terminal');
    if(termDiv && window.Terminal) {
        termDiv.innerHTML = '';
        const term = new Terminal({ theme: { background: '#0f0f13' }, fontFamily: 'monospace' });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termDiv);
        fitAddon.fit();
        term.writeln('\x1b[1;36m>>> AETHER PANEL (PRE-RELEASE).\x1b[0m\r\n');
        
        socket.on('console_data', d => term.write(d));
        socket.on('logs_history', d => term.write(d));
        term.onData(d => { if(d==='\r') term.write('\r\n'); socket.emit('command', d); });
    }
}
