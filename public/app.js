const socket = io();
let cpuChart, ramChart, detailChart;
const MAX_DATA = 20;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Versión
    fetch('/api/info').then(r => r.json()).then(d => {
        const el = document.getElementById('version-display');
        if (el) { el.innerText = 'v' + (d.version || '1.0.0'); el.style.opacity = '0.7'; el.style.marginLeft = '8px'; }
    });
    // 2. Iniciar
    initCharts(); setInterval(updateStats, 2000); updateStats(); initTerminal();
    if (document.getElementById('tab-config')?.classList.contains('active')) loadConfig();
});

// FIX RAM LOCA: Formatea bytes a GB/MB
function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        // CPU
        if(document.getElementById('cpu-val')) document.getElementById('cpu-val').innerText = Math.round(data.cpu) + '%';

        // RAM (Con cálculo de LIBRE)
        if(document.getElementById('ram-val')) {
            document.getElementById('ram-val').innerText = formatBytes(data.ram_used);
            const free = data.ram_total - data.ram_used;
            document.getElementById('ram-free').innerText = `${formatBytes(free)} Libre (Total: ${formatBytes(data.ram_total)})`;
        }

        // DISCO (Con cálculo de LIBRE)
        if(document.getElementById('disk-val')) {
            document.getElementById('disk-val').innerText = formatBytes(data.disk_used);
            const freeD = data.disk_total - data.disk_used;
            document.getElementById('disk-free').innerText = `${formatBytes(freeD)} Libre`;
        }
        
        // Barra
        const bar = document.getElementById('disk-bar');
        if(bar) bar.style.width = Math.min((data.disk_used / data.disk_total) * 100, 100) + '%';

        if (cpuChart) pushData(cpuChart, data.cpu);
        if (ramChart) pushData(ramChart, (data.ram_used / data.ram_total) * 100);

        // Actualizar Modal si está abierto
        if (document.getElementById('detail-modal').classList.contains('active') && detailChart) {
            const title = document.getElementById('detail-title').innerText;
            const val = title.includes('CPU') ? data.cpu : (data.ram_used / data.ram_total) * 100;
            pushData(detailChart, val);
        }
    } catch (e) { }
}

function pushData(chart, val) {
    chart.data.datasets[0].data.push(val);
    chart.data.datasets[0].data.shift();
    chart.update('none');
}

// FUNCIONES GLOBALES
window.openDetail = function(type) {
    const modal = document.getElementById('detail-modal');
    modal.classList.add('active');
    
    let label = '', color = '';
    if(type === 'cpu') { label = 'Historial CPU'; color = '#8b5cf6'; }
    else if(type === 'ram') { label = 'Historial RAM'; color = '#06b6d4'; }
    else if(type === 'disk') { label = 'Historial Disco'; color = '#f59e0b'; }
    
    document.getElementById('detail-title').innerText = label;
    document.getElementById('detail-body').innerHTML = `<div class="chart-detail-wrapper"><canvas id="bigChart"></canvas></div><div style="text-align:center;margin-top:15px;color:#aaa">Monitorizando...</div>`;
    
    const ctx = document.getElementById('bigChart').getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,400); grad.addColorStop(0, color); grad.addColorStop(1, 'transparent');
    
    if(detailChart) detailChart.destroy();
    
    detailChart = new Chart(ctx, {
        type: 'line',
        data: { labels: Array(30).fill(''), datasets: [{ label, data: Array(30).fill(0), borderColor: color, backgroundColor: grad, fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: {display:false}, y: {beginAtZero:true, max:100} }, plugins: { legend: {display:false} }, animation: false }
    });
};

window.setAccentColor = function(color, el) {
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--primary-glow', color + '66');
    if(el && el.classList.contains('color-pill')) {
        document.querySelectorAll('.color-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
    }
    if(cpuChart) { cpuChart.destroy(); initCharts(); }
};

window.setTab = function(name) {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById('nav-' + name).classList.add('active');
    if (name === 'config') loadConfig();
    if (name === 'console') window.dispatchEvent(new Event('resize'));
};

window.loadConfig = function() {
    const list = document.getElementById('cfg-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">Cargando...</div>';
    fetch('/api/config').then(r => r.json()).then(data => {
        list.innerHTML = ''; 
        if (Object.keys(data).length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Sin config.</div>'; return; }
        Object.keys(data).forEach(key => {
            const val = data[key];
            const isBool = val === 'true' || val === 'false';
            let input = isBool 
                ? `<label class="toggle-switch"><input type="checkbox" class="cfg-bool" data-key="${key}" ${val==='true'?'checked':''}><span class="slider"></span></label>`
                : `<input class="cfg-in" data-key="${key}" value="${val}">`;
            list.innerHTML += `<div class="setting-row"><label>${key}</label>${input}</div>`;
        });
    });
};

window.saveCfg = function() {
    const d = {};
    document.querySelectorAll('.cfg-in').forEach(i => d[i.dataset.key] = i.value);
    document.querySelectorAll('.cfg-bool').forEach(i => d[i.dataset.key] = i.checked ? 'true' : 'false');
    fetch('/api/config', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d)})
    .then(() => { if(window.Toastify) Toastify({text: "Guardado", style:{background:"#10b981"}}).showToast(); window.loadConfig(); });
};

window.closeAllModals = function() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); };
window.api = function(ep) { fetch('/api/'+ep, {method:'POST'}); };
window.checkUpdate = () => { if(window.Toastify) Toastify({text:"Buscando...", style:{background:"#3b82f6"}}).showToast(); /* Logic here */ };
window.forceUIUpdate = () => location.reload();

function initCharts() {
    const commonOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }, elements: { point: { radius: 0 } }, animation: false };
    const ctxCpu = document.getElementById('cpu-chart');
    if (ctxCpu) {
        const grad = ctxCpu.getContext('2d').createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        cpuChart = new Chart(ctxCpu, { type: 'line', data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#8b5cf6', borderWidth: 2, fill: true, backgroundColor: grad }] }, options: commonOpts });
    }
    const ctxRam = document.getElementById('ram-chart');
    if (ctxRam) {
        const grad = ctxRam.getContext('2d').createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ramChart = new Chart(ctxRam, { type: 'line', data: { labels: Array(MAX_DATA).fill(''), datasets: [{ data: Array(MAX_DATA).fill(0), borderColor: '#3b82f6', borderWidth: 2, fill: true, backgroundColor: grad }] }, options: commonOpts });
    }
}
function initTerminal() { const t=document.getElementById('terminal'); if(t&&window.Terminal){t.innerHTML='';const term=new Terminal({theme:{background:'#0f0f13'}});const fit=new FitAddon.FitAddon();term.loadAddon(fit);term.open(t);fit.fit();term.writeln('>>> AETHER READY.\r\n');socket.on('console_data',d=>term.write(d));socket.on('logs_history',d=>term.write(d));term.onData(d=>{if(d==='\r')term.write('\r\n');socket.emit('command',d)}); } }
