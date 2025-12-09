const socket = io();
let currentPath = '';

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Xterm
    if(document.getElementById('terminal')) {
        term.open(document.getElementById('terminal'));
        term.loadAddon(fitAddon);
        term.writeln('\x1b[1;36m>>> CONECTADO A AETHER PANEL.\x1b[0m\r\n');
        setTimeout(() => fitAddon.fit(), 200);
    }

    // 2. Info Servidor
    fetch('/api/info').then(r => r.json()).then(d => {
        const el = document.getElementById('version-display');
        if(el) el.innerText = `v${d.version} ${d.channel || ''}`;
    });

    // 3. Init Config
    updateThemeUI(localStorage.getItem('theme') || 'dark');
    setDesign(localStorage.getItem('design_mode') || 'glass');
    setAccentMode(localStorage.getItem('accent_mode') || 'auto');

    // 4. Setup Shortcuts
    setupGlobalShortcuts();
});

// --- STATUS MANAGER ---
socket.on('status_change', s => {
    const el = document.getElementById('status-text');
    const dot = document.getElementById('status-dot');
    
    // Traducción
    const statusMap = {
        'ONLINE': 'EN LÍNEA',
        'OFFLINE': 'DESCONECTADO',
        'STARTING': 'INICIANDO',
        'STOPPING': 'APAGANDO',
        'RESTARTING': 'REINICIANDO'
    };

    if(el) {
        el.innerText = statusMap[s] || s;
        if(s === 'ONLINE') el.style.color = '#10b981';
        else if(s === 'OFFLINE') el.style.color = '#ef4444';
        else el.style.color = '#f59e0b';
    }

    if(dot) {
        dot.className = 'status-dot'; // Reset
        if(s === 'ONLINE') dot.classList.add('online');
        else if(s === 'OFFLINE') dot.classList.add('offline');
        else if(s === 'STARTING') dot.classList.add('starting');
        else if(s === 'STOPPING') dot.classList.add('stopping');
        else if(s === 'RESTARTING') dot.classList.add('restarting');
        else dot.classList.add('starting');
    }
});

// --- ATAJOS Y NAVEGACIÓN ---
function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.altKey) {
            switch(e.key) {
                case '1': e.preventDefault(); setTab('stats'); break;
                case '2': e.preventDefault(); setTab('console'); break;
                case '3': e.preventDefault(); setTab('versions'); break;
                case '4': e.preventDefault(); setTab('labs'); break;
                case '5': e.preventDefault(); setTab('config'); break;
            }
        }
        
        if (e.key === 'Escape') closeAllModals();

        // Flechas para el menú (solo si no se escribe)
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            if (e.key === 'ArrowDown') { e.preventDefault(); navigateSidebar(1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); navigateSidebar(-1); }
        }
    });

    // Enter para activar botones con tabindex
    document.querySelectorAll('[tabindex="0"]').forEach(el => {
        el.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') el.click();
        });
    });
}

function navigateSidebar(direction) {
    const buttons = Array.from(document.querySelectorAll('.nav-item'));
    const current = document.activeElement;
    let idx = buttons.indexOf(current);

    if (idx === -1) {
        const active = document.querySelector('.nav-item.active');
        idx = buttons.indexOf(active);
    }

    let newIdx = idx + direction;
    if (newIdx >= buttons.length) newIdx = 0;
    if (newIdx < 0) newIdx = buttons.length - 1;

    buttons[newIdx].focus();
}

// --- PESTAÑAS ---
function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    
    const target = document.getElementById('tab-' + t);
    if(target) target.classList.add('active');
    
    // Activar botón y foco
    const sbBtn = btn || document.querySelector(`.nav-item[onclick*="'${t}'"]`);
    if(sbBtn) {
        sbBtn.classList.add('active');
        sbBtn.focus();
    }

    if(t==='console') setTimeout(()=>fitAddon.fit(),100);
    if(t==='files') loadFiles('');
    if(t==='config') loadConfig();
    if(t==='backups') loadBackups();
}

// --- UTILS ---
function api(ep, body){ return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(r=>r.json()); }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); }

// --- THEME ---
function setTheme(mode) { localStorage.setItem('theme', mode); updateThemeUI(mode); }
function updateThemeUI(mode) {
    let apply = mode; 
    if (mode === 'auto') apply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', apply);
    ['light','dark','auto'].forEach(m => document.getElementById(`theme-btn-${m}`)?.classList.toggle('active', mode === m));
}
function setDesign(mode) {
    document.documentElement.setAttribute('data-design', mode);
    localStorage.setItem('design_mode', mode);
    document.getElementById('modal-btn-glass')?.classList.toggle('active', mode === 'glass');
    document.getElementById('modal-btn-material')?.classList.toggle('active', mode === 'material');
}
function setAccentMode(mode) {
    localStorage.setItem('accent_mode', mode);
    document.getElementById('accent-mode-auto')?.classList.toggle('active', mode === 'auto');
    if(mode === 'auto') setAccentColor('#8b5cf6', false);
}
function setAccentColor(color, save = true) {
    if(save) { localStorage.setItem('accent_color_val', color); setAccentMode('manual'); }
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--primary-light', color); 
    document.documentElement.style.setProperty('--primary-glow', color + '66');
}

// --- SYSTEM ---
function checkUpdate(){
    Toastify({text:'Buscando actualizaciones...',style:{background:'#8b5cf6'}}).showToast();
    fetch('/api/update/check').then(r=>r.json()).then(d=>{
        if(d.type!=='none'){
            const m=document.getElementById('update-modal');
            document.getElementById('update-text').innerText=`Nueva versión ${d.remote} disponible.`;
            document.getElementById('up-actions').innerHTML=`<button onclick="doUpdate('${d.type}')" class="btn btn-primary">ACTUALIZAR</button><button onclick="closeAllModals()" class="btn btn-secondary">Cancelar</button>`;
            m.classList.add('active');
        } else {
            Toastify({text:'El sistema está actualizado.',style:{background:'#10b981'}}).showToast();
        }
    }).catch(e=>{});
}

function forceUIUpdate(){ document.getElementById('force-ui-modal').classList.add('active'); }
function confirmForceUI(){
    closeAllModals();
    Toastify({text:'Reinstalando interfaz...',style:{background:'#8b5cf6'}}).showToast();
    fetch('/api/update/perform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'soft'})}).then(r=>r.json()).then(d=>{
        if(d.success){ Toastify({text:'¡Listo! Recargando...',style:{background:'#10b981'}}).showToast(); setTimeout(()=>location.reload(),1500); }
    });
}
function doUpdate(type){
    closeAllModals();
    fetch('/api/update/perform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})}).then(r=>r.json()).then(d=>{
        if(d.mode){ Toastify({text:'Actualizando...',style:{background:'#10b981'}}).showToast(); setTimeout(()=>location.reload(),5000); }
    });
}

// --- TERMINAL ---
const term = new Terminal({ fontFamily: 'JetBrains Mono', theme: { background: '#00000000' }, fontSize: 13, convertEol: true });
const fitAddon = new FitAddon.FitAddon();
window.onresize = ()=>fitAddon.fit();
term.onData(d => socket.emit('command', d));
socket.on('console_data', d => term.write(d));
socket.on('logs_history', d => { term.write(d); setTimeout(()=>fitAddon.fit(), 200); });

// --- STATS ---
setInterval(()=>{
    if(!document.getElementById('tab-stats').classList.contains('active')) return;
    fetch('/api/stats').then(r=>r.json()).then(d=>{
        document.getElementById('cpu-val').innerText = d.cpu.toFixed(1)+'%';
        document.getElementById('cpu-bar').style.width = d.cpu+'%';
        document.getElementById('ram-val').innerText = (d.ram_used/1024).toFixed(1) + ' GB';
        document.getElementById('ram-bar').style.width = ((d.ram_used/d.ram_total)*100)+'%';
        document.getElementById('disk-val').innerText = (d.disk_used/1024).toFixed(0)+' MB';
        document.getElementById('disk-bar').style.width = Math.min((d.disk_used/d.disk_total)*100, 100)+'%';
    }).catch(()=>{});
}, 1000);

// --- VERSIONS & FILES ---
let pendingVer = null;
async function loadVersions(type){
    showModal(`Versiones (${type})`, '<p style="text-align:center; color:#a1a1aa">Cargando lista...</p>');
    try {
        const list = await api('nebula/versions', {type});
        let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">';
        list.forEach(v => {
            html += `<div class="glass-panel ver-card" onclick="preInstall('${v.id}','${v.type}','${v.url}')">
                        <div style="font-weight:700; font-size: 1.1rem;">${v.id}</div>
                        <div style="font-size:0.8rem; color:#a1a1aa">${v.type}</div>
                     </div>`;
        });
        html += '</div>';
        document.getElementById('modal-body').innerHTML = html;
    } catch(e) { document.getElementById('modal-body').innerHTML = '<p style="color:#ef4444">Error al cargar versiones.</p>'; }
}

function showModal(title, htmlContent) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = htmlContent;
    document.getElementById('version-modal').classList.add('active');
}

function preInstall(id, type, url){
    pendingVer = {id, type, url};
    const html = `<p>Asignar RAM (GB):</p><input type="range" id="ram-sl" min="1" max="16" step="0.5" value="4" oninput="document.getElementById('ram-txt').innerText=this.value+' GB'" style="width:100%; margin:10px 0"><div id="ram-txt" style="text-align:center; font-weight:bold; margin-bottom:20px; color:#8b5cf6">4 GB</div><button class="btn btn-primary" style="width:100%" onclick="doInstall()">INSTALAR AHORA</button>`;
    showModal(`Instalar ${type} ${id}`, html);
}

function doInstall(){
    if(!pendingVer) return;
    const ram = document.getElementById('ram-sl').value;
    closeAllModals();
    Toastify({text: "Iniciando instalación...", style:{background:"#3b82f6"}}).showToast();
    const v = pendingVer;
    if(v.type==='vanilla'){ api('nebula/resolve-vanilla',{url:v.url}).then(r=>finalInst(r.url,'server.jar',ram)); }
    else if(v.type==='paper'){ fetch(`https://api.papermc.io/v2/projects/paper/versions/${v.id}`).then(r=>r.json()).then(d=>{const b=d.builds[d.builds.length-1]; finalInst(`https://api.papermc.io/v2/projects/paper/versions/${v.id}/builds/${b}/downloads/paper-${v.id}-${b}.jar`,'server.jar',ram);}); }
}

function finalInst(url, name, ram){
    api('install', {url, filename: name});
    Toastify({text: "Descargando servidor...", style:{background:"#10b981"}}).showToast();
}

function loadFiles(p){
    currentPath = p;
    document.getElementById('breadcrumb').innerText = '/home/container' + (p?'/'+p:'');
    api('files?path='+encodeURIComponent(p)).then(list=>{
        let html = '';
        if(p) html += `<div class="file-row" onclick="loadFiles('${p.split('/').slice(0,-1).join('/')}')"><span><i class="fa-solid fa-arrow-up"></i> ..</span></div>`;
        list.forEach(f=>{
            html += `<div class="file-row ${f.isDir?'folder':''}" onclick="${f.isDir?`loadFiles('${(p?p+'/':'')+f.name}')`:`alert('Editor en desarrollo')`}"><span><i class="fa-solid ${f.isDir?'fa-folder':'fa-file'}"></i> ${f.name}</span><span style="font-size:0.8rem; color:#a1a1aa">${f.size}</span></div>`;
        });
        document.getElementById('file-list').innerHTML = html;
    });
}

function uploadFile(){
    const input = document.createElement('input'); input.type='file';
    input.onchange = e => {
        const fd = new FormData(); fd.append('file', e.target.files[0]);
        fetch('/api/files/upload', {method:'POST', body:fd}).then(r=>r.json()).then(d=>{if(d.success) loadFiles(currentPath);});
    };
    input.click();
}

// --- LABS FUNCTIONS ---
const modsDB=[{name:"Jei",fullName:"Just Enough Items",url:"https://mediafilez.forgecdn.net/files/5936/206/jei-1.20.1-forge-15.3.0.4.jar",icon:"fa-book",color:"#2ecc71"},{name:"Iron Chests",fullName:"Iron Chests",url:"https://mediafilez.forgecdn.net/files/4670/664/ironchest-1.20.1-14.4.4.jar",icon:"fa-box",color:"#95a5a6"},{name:"JourneyMap",fullName:"JourneyMap",url:"https://mediafilez.forgecdn.net/files/5864/381/journeymap-1.20.1-5.9.18-forge.jar",icon:"fa-map",color:"#3498db"}];

function openModStore(){
    showModal('Tienda de Mods', '<div id="mod-store-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:15px"></div>');
    const list = document.getElementById('mod-store-grid');
    modsDB.forEach(mod=>{
        list.innerHTML += `<div class="glass-panel" style="padding:15px; text-align:center"><i class="fa-solid ${mod.icon}" style="font-size:2rem; color:${mod.color}; margin-bottom:10px"></i><h4 style="margin-bottom:5px">${mod.name}</h4><button class="btn btn-secondary" style="width:100%" onclick="if(confirm('Instalar ${mod.name}?')){api('mods/install',{url:'${mod.url}',name:'${mod.name}'});closeAllModals()}">Instalar</button></div>`;
    });
}

function createBackup(){ api('backups/create').then(()=>loadBackups()); }
function loadBackups(){
    api('backups').then(list=>{
        let html='';
        list.forEach(b=> html+=`<div class="file-row"><span>${b.name}</span> <button class="btn btn-secondary" onclick="api('backups/restore',{name:'${b.name}'})">Restaurar</button></div>`);
        document.getElementById('backup-list').innerHTML = html;
    });
}

function loadConfig(){
    api('config').then(d=>{
        let html = '';
        Object.entries(d).forEach(([k,v])=>{
            html += `<div style="margin-bottom:10px"><label style="display:block; font-size:0.8rem; color:#a1a1aa">${k}</label><input class="cfg-in" data-k="${k}" value="${v}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px; border-radius:8px"></div>`;
        });
        document.getElementById('cfg-list').innerHTML = html;
    });
}
function saveCfg(){
    const d={}; document.querySelectorAll('.cfg-in').forEach(i=>d[i.dataset.k]=i.value);
    api('config', d); Toastify({text: "Guardado", style:{background:"#10b981"}}).showToast();
}

function copyIP(){
    const el = document.getElementById('ip-display');
    navigator.clipboard.writeText(el.innerText);
    Toastify({text: "¡IP Copiada!", style: {background: "#10b981"}}).showToast();
}
