const socket = io();
let currentPath = '';

// Variables para Charts
let cpuChart, ramChart;
const MAX_DATA_POINTS = 20;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Xterm
    if(document.getElementById('terminal')) {
        try {
            term.open(document.getElementById('terminal'));
            term.loadAddon(fitAddon);
            term.writeln('\x1b[1;36m>>> AETHER PANEL (PREMIUM).\x1b[0m\r\n');
            setTimeout(() => fitAddon.fit(), 200);
        } catch(e){}
    }

    // 2. Info Servidor (Lógica Mejorada: Lee package.json)
    fetch('package.json')
        .then(response => {
            if (!response.ok) throw new Error("No package.json");
            return response.json();
        })
        .then(data => {
            // Prioridad: Versión del package.json
            const el = document.getElementById('version-display');
            if (el && data.version) el.innerText = `v${data.version}`;
        })
        .catch(() => {
            // Fallback: Si falla, usa la API antigua
            fetch('/api/info').then(r => r.json()).then(d => {
                const el = document.getElementById('version-display');
                if(el) el.innerText = `v${d.version} ${d.channel || ''}`;
            });
        });

    // 3. Init Config Visual
    updateThemeUI(localStorage.getItem('theme') || 'dark');
    setDesign(localStorage.getItem('design_mode') || 'glass');
    setAccentMode(localStorage.getItem('accent_mode') || 'auto');

    // 4. Inicializar Sistemas
    setupGlobalShortcuts();
    setupAccessibility();
    initCharts();
});

// --- CHARTS SYSTEM ---
function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
        animation: { duration: 0 }
    };

    const ctxCpu = document.getElementById('cpu-chart')?.getContext('2d');
    if(ctxCpu) {
        const grad = ctxCpu.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.5)');
        grad.addColorStop(1, 'rgba(139, 92, 246, 0)');

        cpuChart = new Chart(ctxCpu, {
            type: 'line',
            data: { labels: Array(MAX_DATA_POINTS).fill(''), datasets: [{ data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#8b5cf6', backgroundColor: grad, fill: true }] },
            options: commonOptions
        });
    }

    const ctxRam = document.getElementById('ram-chart')?.getContext('2d');
    if(ctxRam) {
        const grad = ctxRam.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0)');

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

// --- ACCESIBILIDAD ---
function setupAccessibility() {
    document.body.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
            e.preventDefault(); e.target.click();
        }
    });
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('keydown', (e) => {
            if(e.key === 'Escape') closeAllModals();
            if(e.key === 'Tab') trapFocus(e, modal);
        });
    });
}

function trapFocus(e, modal) {
    const els = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
}

// --- ATAJOS ---
function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.altKey) {
            const tabs = {'1':'stats','2':'console','3':'versions','4':'labs','5':'config'};
            if(tabs[e.key]) { e.preventDefault(); setTab(tabs[e.key]); }
        }
        if (document.activeElement.classList.contains('nav-item')) {
            if (e.key === 'ArrowDown') { e.preventDefault(); navigateSidebar(1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); navigateSidebar(-1); }
        }
    });
}
function navigateSidebar(dir) {
    const btns = Array.from(document.querySelectorAll('.nav-item'));
    const idx = btns.indexOf(document.activeElement);
    const start = idx === -1 ? btns.indexOf(document.querySelector('.nav-item.active')) : idx;
    let next = start + dir;
    if (next >= btns.length) next = 0; if (next < 0) next = btns.length - 1;
    btns[next].focus();
}

// --- STATS UPDATE ---
setInterval(()=>{
    if(!document.getElementById('tab-stats').classList.contains('active')) return;
    fetch('/api/stats').then(r=>r.json()).then(d=>{
        document.getElementById('cpu-val').innerText = d.cpu.toFixed(1)+'%';
        document.getElementById('ram-val').innerText = (d.ram_used/1024).toFixed(1) + ' GB';
        const db = document.getElementById('disk-bar');
        if(db) db.style.width = Math.min((d.disk_used/d.disk_total)*100, 100)+'%';
        document.getElementById('disk-val').innerText = (d.disk_used/1024).toFixed(0)+' MB';
        updateChart(cpuChart, d.cpu);
        updateChart(ramChart, (d.ram_used/d.ram_total)*100);
    }).catch(()=>{});
}, 1000);

// --- RESTO DE FUNCIONES ---
socket.on('status_change', s => {
    const el = document.getElementById('status-text');
    const dot = document.getElementById('status-dot');
    const statusMap = {'ONLINE':'EN LÍNEA','OFFLINE':'DESCONECTADO','STARTING':'INICIANDO','STOPPING':'APAGANDO','RESTARTING':'REINICIANDO'};
    if(el) { el.innerText = statusMap[s] || s; if(s==='ONLINE')el.style.color='#10b981'; else if(s==='OFFLINE')el.style.color='#ef4444'; else el.style.color='#f59e0b'; }
    if(dot) { dot.className='status-dot'; if(s==='ONLINE')dot.classList.add('online'); else if(s==='OFFLINE')dot.classList.add('offline'); else dot.classList.add('starting'); }
});

function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => { e.classList.remove('active'); e.setAttribute('aria-selected','false'); });
    const target = document.getElementById('tab-' + t);
    if(target) target.classList.add('active');
    const sbBtn = btn || document.querySelector(`#nav-${t}`);
    if(sbBtn) { sbBtn.classList.add('active'); sbBtn.setAttribute('aria-selected','true'); if(!btn) sbBtn.focus(); }
    if(t==='console') setTimeout(()=>fitAddon.fit(),100);
    if(t==='files') loadFiles('');
    if(t==='config') loadConfig();
    if(t==='backups') loadBackups();
}

function api(ep, body){ return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(r=>r.json()); }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); document.querySelector('.sidebar-footer button')?.focus(); }

function checkUpdate(){
    Toastify({text:'Buscando...',style:{background:'#8b5cf6'}}).showToast();
    fetch('/api/update/check').then(r=>r.json()).then(d=>{
        if(d.type!=='none'){
            const m=document.getElementById('update-modal');
            document.getElementById('update-text').innerText=`Versión ${d.remote} disponible.`;
            document.getElementById('up-actions').innerHTML=`<button onclick="doUpdate('${d.type}')" class="btn btn-primary">ACTUALIZAR</button><button onclick="closeAllModals()" class="btn btn-secondary">Cancelar</button>`;
            m.classList.add('active'); m.querySelector('button').focus();
        } else Toastify({text:'Sistema actualizado.',style:{background:'#10b981'}}).showToast();
    }).catch(e=>{});
}
function forceUIUpdate(){ document.getElementById('force-ui-modal').classList.add('active'); document.querySelector('#force-ui-modal button.btn-secondary').focus(); }
function confirmForceUI(){ closeAllModals(); Toastify({text:'Reinstalando...',style:{background:'#8b5cf6'}}).showToast(); setTimeout(()=>location.reload(),1500); }
function doUpdate(type){ closeAllModals(); Toastify({text:'Actualizando...',style:{background:'#10b981'}}).showToast(); }

const term = new Terminal({ fontFamily: 'JetBrains Mono', theme: { background: '#00000000' }, fontSize: 13, convertEol: true });
const fitAddon = new FitAddon.FitAddon();
window.onresize = ()=>fitAddon.fit();

let pendingVer = null;
async function loadVersions(type){
    showModal(`Versiones (${type})`, '<p style="text-align:center;">Cargando...</p>');
    try {
        const list = await api('nebula/versions', {type});
        let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">';
        list.forEach(v => { html += `<div class="glass-panel ver-card" onclick="preInstall('${v.id}','${v.type}','${v.url}')" role="button" tabindex="0"><div style="font-weight:700;">${v.id}</div><div style="font-size:0.8rem; opacity:0.7">${v.type}</div></div>`; });
        html += '</div>'; document.getElementById('modal-body').innerHTML = html;
    } catch(e){}
}
function showModal(title, html) { document.getElementById('modal-title').innerText=title; document.getElementById('modal-body').innerHTML=html; const m=document.getElementById('version-modal'); m.classList.add('active'); m.querySelector('.btn-icon-sm').focus(); }
function preInstall(id, type, url){ pendingVer = {id, type, url}; showModal(`Instalar ${type} ${id}`, `<p>RAM (GB):</p><input type="range" id="ram-sl" min="1" max="16" step="0.5" value="4"><button class="btn btn-primary" style="width:100%; margin-top:15px" onclick="doInstall()">INSTALAR</button>`); }
function doInstall(){ closeAllModals(); Toastify({text: "Instalando...", style:{background:"#3b82f6"}}).showToast(); }

function loadFiles(p){ currentPath = p; document.getElementById('breadcrumb').innerText='/home/container'+(p?'/'+p:''); api('files?path='+encodeURIComponent(p)).then(list=>{ let html=p?`<div class="file-row" onclick="loadFiles('${p.split('/').slice(0,-1).join('/')}')" role="button" tabindex="0"><span><i class="fa-solid fa-arrow-up"></i> ..</span></div>`:''; list.forEach(f=>{ html+=`<div class="file-row ${f.isDir?'folder':''}" onclick="${f.isDir?`loadFiles('${(p?p+'/':'')+f.name}')`:`alert('WIP')`}" role="button" tabindex="0"><span><i class="fa-solid ${f.isDir?'fa-folder':'fa-file'}"></i> ${f.name}</span><span>${f.size}</span></div>`; }); document.getElementById('file-list').innerHTML=html; }); }
function uploadFile(){ const i=document.createElement('input'); i.type='file'; i.onchange=e=>{ const fd=new FormData(); fd.append('file',e.target.files[0]); fetch('/api/files/upload',{method:'POST',body:fd}).then(()=>loadFiles(currentPath)); }; i.click(); }

const modsDB=[{name:"Jei",url:"#",icon:"fa-book",color:"#2ecc71"},{name:"JourneyMap",url:"#",icon:"fa-map",color:"#3498db"}];
function openModStore(){ showModal('Mods', '<div id="mod-store-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:15px"></div>'); const l=document.getElementById('mod-store-grid'); modsDB.forEach(m=>{ l.innerHTML+=`<div class="glass-panel" style="padding:15px; text-align:center"><i class="fa-solid ${m.icon}" style="color:${m.color}; font-size:2rem; margin-bottom:10px"></i><h4>${m.name}</h4><button class="btn btn-secondary" onclick="closeAllModals()">Instalar</button></div>`; }); }

function createBackup(){ api('backups/create').then(()=>loadBackups()); }
function loadBackups(){ api('backups').then(list=>{ let html=''; list.forEach(b=>html+=`<div class="file-row"><span>${b.name}</span><button class="btn btn-secondary">Restaurar</button></div>`); document.getElementById('backup-list').innerHTML=html; }); }
function loadConfig(){ api('config').then(d=>{ let html=''; Object.entries(d).forEach(([k,v])=>html+=`<div style="margin-bottom:10px"><label style="font-size:0.8rem; opacity:0.7">${k}</label><input class="cfg-in" data-k="${k}" value="${v}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px; border-radius:8px"></div>`); document.getElementById('cfg-list').innerHTML=html; }); }
function saveCfg(){ Toastify({text: "Guardado", style:{background:"#10b981"}}).showToast(); }
function copyIP(){ navigator.clipboard.writeText(document.getElementById('ip-display').innerText); Toastify({text: "Copiada!", style: {background: "#10b981"}}).showToast(); }
