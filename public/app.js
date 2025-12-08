const socket = io();
let currentPath = '';

// --- INICIO ---
fetch('/api/info').then(r => r.json()).then(d => {
    document.getElementById('version-display').innerText = `v${d.version} ${d.channel || ''}`;
});
fetch('/api/network').then(r => r.json()).then(d => {
    const el = document.getElementById('ip-display');
    if(el && d) {
        const txt = d.custom_domain ? `${d.custom_domain}:${d.port}` : `${d.ip}:${d.port}`;
        el.innerText = txt; el.dataset.ip = txt;
    }
}).catch(()=>{});

function copyIP(){
    const el = document.getElementById('ip-display');
    if(el && el.dataset.ip) {
        navigator.clipboard.writeText(el.dataset.ip);
        Toastify({text: "¡IP Copiada!", style: {background: "#10b981"}}).showToast();
    }
}

// --- PERSONALIZACIÓN & TEMAS ---
function setTheme(mode) { 
    localStorage.setItem('theme', mode); 
    updateThemeUI(mode); 
}

function updateThemeUI(mode) {
    let apply = mode; 
    if (mode === 'auto') apply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', apply);
    
    // Actualizar botones visualmente
    ['light','dark','auto'].forEach(m => {
        document.getElementById(`theme-btn-${m}`)?.classList.toggle('active', mode === m);
    });
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
    document.getElementById('accent-mode-manual')?.classList.toggle('active', mode === 'manual');
    document.getElementById('manual-color-wrapper').style.display = (mode === 'manual') ? 'block' : 'none';
    
    if(mode === 'auto') setAccentColor('#8b5cf6', false); // Violeta por defecto
    else {
        const saved = localStorage.getItem('accent_color_val') || '#8b5cf6';
        setAccentColor(saved, false);
    }
}

function setAccentColor(color, save = true) {
    if(save) {
        localStorage.setItem('accent_color_val', color);
        setAccentMode('manual');
    }
    // Actualizamos las variables CSS para el nuevo estilo
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--primary-light', color); // Simplificado para brillo
    document.documentElement.style.setProperty('--primary-glow', color + '66'); // Transparencia hex
}

// INICIALIZACIÓN
updateThemeUI(localStorage.getItem('theme') || 'dark');
setDesign(localStorage.getItem('design_mode') || 'glass');
setAccentMode(localStorage.getItem('accent_mode') || 'auto');

// --- TABS & UI ---
function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
    if(btn) btn.classList.add('active');
    
    if(t==='console') setTimeout(()=>fitAddon.fit(),100);
    if(t==='files') loadFiles('');
    if(t==='config') loadConfig();
    if(t==='backups') loadBackups();
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
}

// --- CONSOLA ---
const term = new Terminal({ fontFamily: 'JetBrains Mono', theme: { background: '#00000000' }, fontSize: 13, convertEol: true });
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal'));
term.writeln('\x1b[1;36m>>> CONECTADO A AETHER PANEL.\x1b[0m\r\n');
window.onresize = ()=>fitAddon.fit();

term.onData(d => socket.emit('command', d));
socket.on('console_data', d => term.write(d));
socket.on('logs_history', d => { term.write(d); setTimeout(()=>fitAddon.fit(), 200); });
function sendCommand(){ 
    const i = document.getElementById('console-input'); 
    if(i.value){ socket.emit('command', i.value); i.value=''; } 
}

// --- MONITOR ---
setInterval(()=>{
    fetch('/api/stats').then(r=>r.json()).then(d=>{
        document.getElementById('cpu-val').innerText = d.cpu.toFixed(1)+'%';
        document.getElementById('cpu-bar').style.width = d.cpu+'%';
        if(d.cpu_freq) document.getElementById('cpu-freq').innerText = (d.cpu_freq/1000).toFixed(1)+' GHz';

        const ramGB = (d.ram_used/1073741824).toFixed(1);
        const totalGB = (d.ram_total/1073741824).toFixed(1);
        document.getElementById('ram-val').innerText = ramGB + ' GB';
        document.getElementById('ram-max').innerText = 'de ' + totalGB + ' GB';
        document.getElementById('ram-bar').style.width = ((d.ram_used/d.ram_total)*100)+'%';

        document.getElementById('disk-val').innerText = (d.disk_used/1048576).toFixed(0)+' MB';
        document.getElementById('disk-bar').style.width = Math.min((d.disk_used/d.disk_total)*100, 100)+'%';
    }).catch(()=>{});
}, 1000);

socket.on('status_change', s => {
    const el = document.getElementById('status-text');
    const dot = document.getElementById('status-dot');
    if(el) el.innerText = s.toUpperCase();
    if(dot) {
        dot.className = 'status-dot ' + (s==='online'?'':'offline');
        dot.style.background = s==='online'?'#10b981':'#ef4444';
        dot.style.boxShadow = s==='online'?'0 0 10px #10b981':'0 0 10px #ef4444';
    }
});

function api(ep, body){ return fetch('/api/'+ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(r=>r.json()); }

// --- FUNCIONES EXTRA ---
function showModal(title, htmlContent) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = htmlContent;
    document.getElementById('version-modal').classList.add('active');
}

// --- VERSIONES & INSTALACIÓN ---
let pendingVer = null;
async function loadVersions(type){
    showModal(`Versiones (${type})`, '<p style="text-align:center; color:#a1a1aa">Cargando lista...</p>');
    try {
        const list = await api('nebula/versions', {type});
        let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">';
        list.forEach(v => {
            html += `<div class="glass-panel" style="padding:10px; cursor:pointer; text-align:center; border:1px solid rgba(255,255,255,0.1)" onclick="preInstall('${v.id}','${v.type}','${v.url}')">
                <div style="font-weight:700">${v.id}</div>
                <div style="font-size:0.7rem; color:#a1a1aa">${v.type}</div>
            </div>`;
        });
        html += '</div>';
        document.getElementById('modal-body').innerHTML = html;
    } catch(e) { document.getElementById('modal-body').innerHTML = '<p style="color:#ef4444">Error al cargar versiones.</p>'; }
}

function preInstall(id, type, url){
    pendingVer = {id, type, url};
    const html = `
        <p>Asignar RAM (GB):</p>
        <input type="range" id="ram-sl" min="1" max="16" step="0.5" value="4" oninput="document.getElementById('ram-txt').innerText=this.value+' GB'" style="width:100%; margin:10px 0">
        <div id="ram-txt" style="text-align:center; font-weight:bold; margin-bottom:20px; color:#8b5cf6">4 GB</div>
        <button class="btn btn-primary" style="width:100%" onclick="doInstall()">INSTALAR AHORA</button>
    `;
    showModal(`Instalar ${type} ${id}`, html);
}

function doInstall(){
    if(!pendingVer) return;
    const ram = document.getElementById('ram-sl').value;
    closeAllModals();
    Toastify({text: "Iniciando instalación...", style:{background:"#3b82f6"}}).showToast();
    const v = pendingVer;
    if(v.type==='vanilla'){ api('nebula/resolve-vanilla',{url:v.url}).then(r=>finalInst(r.url,'server.jar',ram)); }
    else if(v.type==='paper'){ 
        fetch(`https://api.papermc.io/v2/projects/paper/versions/${v.id}`).then(r=>r.json()).then(d=>{
            const b=d.builds[d.builds.length-1];
            finalInst(`https://api.papermc.io/v2/projects/paper/versions/${v.id}/builds/${b}/downloads/paper-${v.id}-${b}.jar`,'server.jar',ram);
        });
    }
}

function finalInst(url, name, ram){
    api('settings', {ram: ram+'G'});
    api('install', {url, filename: name});
    Toastify({text: "Descargando servidor...", style:{background:"#10b981"}}).showToast();
}

// --- ARCHIVOS & CONFIG ---
function loadFiles(p){
    currentPath = p;
    document.getElementById('breadcrumb').innerText = '/home/container' + (p?'/'+p:'');
    api('files?path='+encodeURIComponent(p)).then(list=>{
        let html = '';
        if(p) html += `<div class="file-row" onclick="loadFiles('${p.split('/').slice(0,-1).join('/')}')"><span><i class="fa-solid fa-arrow-up"></i> ..</span></div>`;
        list.forEach(f=>{
            html += `<div class="file-row ${f.isDir?'folder':''}" onclick="${f.isDir?`loadFiles('${(p?p+'/':'')+f.name}')`:`alert('Editor en desarrollo')`}">
                <span><i class="fa-solid ${f.isDir?'fa-folder':'fa-file'}"></i> ${f.name}</span>
                <span style="font-size:0.8rem; color:#a1a1aa">${f.size}</span>
            </div>`;
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
function forceUIUpdate(){
    if(confirm('¿Recargar interfaz?')) {
        api('update/perform', {type:'soft'});
        Toastify({text: "Recargando...", style:{background:"#8b5cf6"}}).showToast();
        setTimeout(()=>location.reload(), 2000);
    }
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
function createBackup(){ api('backups/create').then(()=>loadBackups()); }
function loadBackups(){
    api('backups').then(list=>{
        let html='';
        list.forEach(b=> html+=`<div class="file-row"><span>${b.name}</span> <button class="btn btn-secondary" onclick="api('backups/restore',{name:'${b.name}'})">Restaurar</button></div>`);
        document.getElementById('backup-list').innerHTML = html;
    });
}
