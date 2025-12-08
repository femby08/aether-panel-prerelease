const socket = io();
let currentPath = '', currentFile = '', allVersions = [], currentStoreMode = 'versions';

// --- 1. INFO & INICIO ---
fetch('/api/info').then(r => r.json()).then(d => {
    const sb = document.getElementById('sidebar-version-text');
    if(sb) sb.innerText = 'v' + d.version + ' ' + (d.channel || '');
});

// --- RED ---
fetch('/api/network').then(r => r.json()).then(d => {
    const ipElem = document.getElementById('server-ip-display');
    if(ipElem && d) {
        const val = d.custom_domain ? `${d.custom_domain}:${d.port}` : `${d.ip}:${d.port}`;
        ipElem.innerText = val; 
        ipElem.dataset.fullIp = val;
    }
}).catch(() => {});

function copyIP() { 
    const elem = document.getElementById('server-ip-display');
    if(elem && elem.dataset.fullIp) {
        navigator.clipboard.writeText(elem.dataset.fullIp).then(() => Toastify({text: '¡IP Copiada!', style:{background:'#10b981'}}).showToast()); 
    }
}

// --- 2. SHORTCUTS & UTILS ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Alt') {
        if(e.key === 'Alt' && !e.ctrlKey && !e.shiftKey) e.preventDefault(); 
        closeAllModals();
        if(document.activeElement) document.activeElement.blur();
    }
}, true);

function closeAllModals() { 
    document.querySelectorAll('.modal-overlay').forEach(el => {
        el.classList.remove('active');
        setTimeout(() => { if(!el.classList.contains('active')) el.querySelector('.modal-card').classList.remove('active'); }, 100);
    }); 
}

// --- 3. THEMES & PERSONALIZACIÓN ---
function setTheme(mode) { 
    localStorage.setItem('theme', mode); 
    updateThemeUI(mode); 
}

function updateThemeUI(mode) {
    let apply = mode; 
    if (mode === 'auto') apply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', apply);
    
    document.querySelectorAll('.segment-btn').forEach(b => {
        if(b.onclick && b.onclick.toString().includes(mode)) b.classList.add('active');
        else if (b.parentNode.querySelector('.active') === b) b.classList.remove('active');
    });
    
    if (typeof term !== 'undefined') updateTerminalTheme(apply);
}

function updateTerminalTheme(mode) {
    const isLight = mode === 'light';
    if(term) {
        term.options.theme = isLight ? { 
            foreground: '#334155', 
            background: '#ffffff', 
            cursor: '#334155',
            selectionBackground: 'rgba(0, 0, 0, 0.2)'
        } : { 
            foreground: '#ffffff', 
            background: 'transparent', 
            cursor: '#ffffff',
            selectionBackground: 'rgba(255, 255, 255, 0.3)'
        };
    }
}

function setAccentMode(mode) {
    localStorage.setItem('accent_mode', mode);
    updateAccentUI(mode);
    const saved = localStorage.getItem('accent_color_val') || '#8b5cf6';
    setAccentColor(mode === 'auto' ? '#8b5cf6' : saved, false);
}

function updateAccentUI(mode) {
    document.getElementById('accent-mode-auto').classList.toggle('active', mode === 'auto');
    document.getElementById('accent-mode-manual').classList.toggle('active', mode === 'manual');
    const picker = document.getElementById('manual-color-wrapper');
    if(picker) picker.style.display = (mode === 'manual') ? 'block' : 'none';
}

function setAccentColor(color, save = true) {
    if(save) {
        localStorage.setItem('accent_color_val', color);
        setAccentMode('manual');
    }
    document.documentElement.style.setProperty('--primary', color);
    const input = document.getElementById('accent-picker');
    if(input) input.value = color;
}

function setDesign(mode) {
    document.documentElement.setAttribute('data-design', mode);
    localStorage.setItem('design_mode', mode);
    document.getElementById('modal-btn-glass').classList.toggle('active', mode === 'glass');
    document.getElementById('modal-btn-material').classList.toggle('active', mode === 'material');
}

// --- 4. CONSOLA ---
const term = new Terminal({ 
    fontFamily: 'JetBrains Mono', 
    theme: { background: '#00000000' }, 
    fontSize: 13, 
    cursorBlink: true, 
    convertEol: true 
});
const fitAddon = new FitAddon.FitAddon(); 
term.loadAddon(fitAddon); 
term.open(document.getElementById('terminal'));
term.writeln('\x1b[1;35m>>> AETHER PANEL READY.\x1b[0m\r\n');

term.attachCustomKeyEventHandler((arg) => {
    if (arg.type === 'keydown' && arg.key === 'Escape') {
        closeAllModals();
        return false; 
    }
    return true;
});

window.onresize = () => { if (document.getElementById('tab-console').classList.contains('active')) fitAddon.fit(); };
term.onData(d => socket.emit('command', d));
socket.on('console_data', d => term.write(d));
socket.on('logs_history', d => { term.write(d); setTimeout(() => fitAddon.fit(), 200); });
function sendConsoleCommand() { const i = document.getElementById('console-input'); if (i && i.value.trim()) { socket.emit('command', i.value); i.value = ''; } }

// --- INICIALIZAR AL FINAL ---
updateThemeUI(localStorage.getItem('theme') || 'dark');
setAccentMode(localStorage.getItem('accent_mode') || 'auto');
setDesign(localStorage.getItem('design_mode') || 'glass');

// --- 5. LOGICA TABS ---
function setTab(t, btn) {
    document.querySelectorAll('.tab-view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    
    const target = document.getElementById('tab-' + t);
    if(target) target.classList.add('active');
    
    if (btn) btn.classList.add('active');

    if (t === 'console') setTimeout(() => { fitAddon.fit(); const i=document.getElementById('console-input'); if(i)i.focus() }, 100);
    if (t === 'files') loadFileBrowser(''); 
    if (t === 'config') loadCfg(); 
    if (t === 'backups') loadBackups();
}

// --- API & CHARTS ---
function api(ep, body) { return fetch('/api/' + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()); }

const cpuCtx = document.getElementById('cpuChart').getContext('2d');
const ramCtx = document.getElementById('ramChart').getContext('2d');

const cpuChart = new Chart(cpuCtx, { type:'line', data:{labels:Array(20).fill(''),datasets:[{data:Array(20).fill(0),borderColor:'#8b5cf6',backgroundColor:'#8b5cf615',fill:true,tension:0.4,pointRadius:0,borderWidth:2}]}, options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},scales:{x:{display:false},y:{min:0,max:100,grid:{display:false},ticks:{display:false}}},plugins:{legend:{display:false}}} });
const ramChart = new Chart(ramCtx, { type:'line', data:{labels:Array(20).fill(''),datasets:[{data:Array(20).fill(0),borderColor:'#3b82f6',backgroundColor:'#3b82f615',fill:true,tension:0.4,pointRadius:0,borderWidth:2}]}, options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},scales:{x:{display:false},y:{min:0,grid:{display:false},ticks:{display:false}}},plugins:{legend:{display:false}}} });

setInterval(() => {
    fetch('/api/stats').then(r => r.json()).then(d => {
        cpuChart.data.datasets[0].data.shift(); cpuChart.data.datasets[0].data.push(d.cpu); cpuChart.update(); document.getElementById('cpu-val').innerText = d.cpu.toFixed(1) + '%';
        if (d.cpu_freq && d.cpu_freq > 0) document.getElementById('cpu-freq').innerText = (d.cpu_freq / 1000).toFixed(1) + ' GHz';
        
        const toGB = (b) => (b / 1073741824).toFixed(1);
        ramChart.options.scales.y.max = parseFloat(toGB(d.ram_total)); ramChart.data.datasets[0].data.shift(); ramChart.data.datasets[0].data.push(parseFloat(toGB(d.ram_used))); ramChart.update();
        document.getElementById('ram-val').innerText = `${toGB(d.ram_used)} / ${toGB(d.ram_total)} GB`; 
        document.getElementById('ram-free').innerText = 'Libre: ' + toGB(d.ram_total - d.ram_used) + ' GB';
        
        document.getElementById('disk-val').innerText = (d.disk_used / 1048576).toFixed(0) + ' MB'; 
        document.getElementById('disk-fill').style.width = Math.min((d.disk_used / d.disk_total) * 100, 100) + '%';
        
        // Estado del socket/servidor
        const w = document.getElementById('status-widget');
        const txt = document.getElementById('status-text');
        if(w && txt) {
             // El backend debe emitir 'status_change'
        }
    }).catch(() => { });
}, 1000);

socket.on('status_change', s => { 
    const w = document.getElementById('status-widget'); 
    const txt = document.getElementById('status-text');
    if(w) { 
        w.className = 'status-dot ' + (s === 'online' ? 'online' : 'offline'); 
        w.style.boxShadow = s === 'online' ? '0 0 8px #10b981' : 'none';
        w.style.background = s === 'online' ? '#10b981' : '#ef4444';
    }
    if(txt) txt.innerText = s.toUpperCase(); 
});

// --- TIENDA DE MODS Y VERSIONES ---
const modsDB=[{name:"Jei",fullName:"Just Enough Items",url:"https://mediafilez.forgecdn.net/files/5936/206/jei-1.20.1-forge-15.3.0.4.jar",icon:"fa-book",color:"#2ecc71"},{name:"Iron Chests",fullName:"Iron Chests",url:"https://mediafilez.forgecdn.net/files/4670/664/ironchest-1.20.1-14.4.4.jar",icon:"fa-box",color:"#95a5a6"},{name:"JourneyMap",fullName:"JourneyMap",url:"https://mediafilez.forgecdn.net/files/5864/381/journeymap-1.20.1-5.9.18-forge.jar",icon:"fa-map",color:"#3498db"}];

function openModStore(){
    currentStoreMode='mods';
    const m = document.getElementById('version-modal');
    m.classList.add('active'); setTimeout(() => m.querySelector('.modal-card').classList.add('active'), 10);
    const list = document.getElementById('version-list');
    list.innerHTML='';
    m.querySelector('.modal-header h3').innerHTML='<i class="fa-solid fa-store"></i> Tienda de Mods';
    
    modsDB.forEach(mod=>{
        const el=document.createElement('div');
        el.className='card glass-panel';
        el.style.padding='15px';
        el.style.textAlign='center';
        el.innerHTML=`<i class="fa-solid ${mod.icon}" style="font-size:2rem; color:${mod.color}; margin-bottom:10px"></i><h4 style="margin-bottom:5px">${mod.name}</h4><button class="btn btn-sm btn-primary" style="width:100%">Instalar</button>`;
        el.onclick=()=>{if(confirm(`¿Instalar ${mod.fullName}?`)){api('mods/install',{url:mod.url,name:mod.name});closeAllModals()}};
        list.appendChild(el);
    });
}

async function loadVersions(type){
    currentStoreMode='versions';
    const m=document.getElementById('version-modal');
    m.classList.add('active'); setTimeout(() => m.querySelector('.modal-card').classList.add('active'), 10);
    const list = document.getElementById('version-list');
    list.innerHTML='<p style="color:var(--text-muted)">Cargando...</p>';
    m.querySelector('.modal-header h3').innerHTML='<i class="fa-solid fa-cloud-arrow-down"></i> Versiones (' + type + ')';
    
    try{
        allVersions=await api('nebula/versions',{type});
        renderVersions(allVersions);
    }catch(e){ list.innerHTML='Error cargando versiones.'; }
}

function renderVersions(list){
    const g=document.getElementById('version-list');
    g.innerHTML='';
    list.forEach(v=>{
        const e=document.createElement('div');
        e.className='card glass-panel';
        e.style.padding='15px';
        e.style.cursor='pointer';
        e.innerHTML=`<h4 style="font-weight:700">${v.id}</h4><span style="font-size:0.8rem;color:var(--text-muted)">${v.type}</span>`;
        e.onclick=()=>installVersion(v);
        g.appendChild(e);
    });
}

let pendingInstall=null;
function installVersion(v){
    pendingInstall=v;
    closeAllModals();
    setTimeout(() => {
        const rm = document.getElementById('ram-modal');
        rm.classList.add('active'); setTimeout(() => rm.querySelector('.modal-card').classList.add('active'), 10);
    }, 300);
}

function confirmInstall(){
    if(!pendingInstall)return;
    const ram=document.getElementById('ram-slider').value;
    const v=pendingInstall;
    closeAllModals();
    pendingInstall=null;
    
    Toastify({text:'Iniciando instalación...',style:{background:'#3b82f6'}}).showToast();
    
    try{
        if(v.type==='vanilla'){api('nebula/resolve-vanilla',{url:v.url}).then(r=>{if(r&&r.url)finalizeInstall(r.url,'server.jar',ram)})}
        else if(v.type==='paper'){fetch(`https://api.papermc.io/v2/projects/paper/versions/${v.id}`).then(r=>r.json()).then(d=>{const b=d.builds[d.builds.length-1];finalizeInstall(`https://api.papermc.io/v2/projects/paper/versions/${v.id}/builds/${b}/downloads/paper-${v.id}-${b}.jar`,'server.jar',ram)})}
        else if(v.type==='fabric'){fetch('https://meta.fabricmc.net/v2/versions/loader').then(r=>r.json()).then(d=>{finalizeInstall(`https://meta.fabricmc.net/v2/versions/loader/${v.id}/${d[0].version}/1.0.1/server/jar`,'server.jar',ram)})}
        else if(v.type==='forge'){api('nebula/resolve-forge',{version:v.id}).then(res=>{if(res&&res.url)finalizeInstall(res.url,'forge-installer.jar',ram)})}
    }catch(e){}
}

function finalizeInstall(url,filename,ram){
    api('settings',{ram:ram+'G'});
    api('install',{url,filename});
    Toastify({text:'Descargando servidor...',style:{background:'#10b981'}}).showToast();
}

// --- FILE MANAGER ---
function loadFileBrowser(p){
    currentPath=p;
    document.getElementById('file-breadcrumb').innerText='/home/container'+(p?'/'+p:'');
    api('files?path='+encodeURIComponent(p)).then(fs=>{
        const l=document.getElementById('file-list');
        l.innerHTML='';
        if(p){
            const b=document.createElement('div');
            b.className='file-row';
            b.innerHTML='<span><i class="fa-solid fa-arrow-up"></i> ..</span>';
            b.onclick=()=>{const a=p.split('/');a.pop();loadFileBrowser(a.join('/'))};
            l.appendChild(b);
        }
        fs.forEach(f=>{
            const e=document.createElement('div');
            e.className='file-row';
            e.innerHTML=`<span><i class="fa-solid ${f.isDir?'fa-folder':'fa-file'}"></i> ${f.name}</span><span style="font-family:monospace; color:var(--text-muted)">${f.size}</span>`;
            if(f.isDir)e.onclick=()=>loadFileBrowser((p?p+'/':'')+f.name);
            else e.onclick=()=>openEditor((p?p+'/':'')+f.name);
            l.appendChild(e);
        });
    });
}

function uploadFile(){
    const i=document.createElement('input');
    i.type='file';
    i.onchange=(e)=>{
        const f=new FormData();
        f.append('file',e.target.files[0]);
        fetch('/api/files/upload',{method:'POST',body:f}).then(r=>r.json()).then(d=>{if(d.success)loadFileBrowser(currentPath)});
    };
    i.click();
}

const ed=ace.edit("ace-editor");
ed.setTheme("ace/theme/dracula");
ed.setOptions({fontSize:"14px"});

function openEditor(f){
    currentFile=f;
    api('files/read',{file:f}).then(d=>{
        if(!d.error){
            const m = document.getElementById('editor-modal');
            m.classList.add('active'); setTimeout(() => m.querySelector('.modal-card').classList.add('active'), 10);
            ed.setValue(d.content,-1);
        }
    });
}
function saveFile(){api('files/save',{file:currentFile,content:ed.getValue()}).then(()=>{closeEditor()})}
function closeEditor(){closeAllModals()}

// --- BACKUPS & CONFIG ---
function loadBackups(){
    api('backups').then(b=>{
        const l=document.getElementById('backup-list');
        l.innerHTML='';
        if(b.length === 0) l.innerHTML='<p style="text-align:center; padding:20px; color:var(--text-muted)">No hay backups creados.</p>';
        b.forEach(k=>{
            const e=document.createElement('div');
            e.className='file-row';
            e.innerHTML=`<span><i class="fa-solid fa-box-archive"></i> ${k.name}</span><div style="display:flex; gap:10px"><button class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem" onclick="restoreBackup('${k.name}')">Restaurar</button><button class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem; border-color:var(--danger); color:var(--danger)" onclick="deleteBackup('${k.name}')">X</button></div>`;
            l.appendChild(e);
        });
    });
}
function createBackup(){api('backups/create').then(()=>setTimeout(loadBackups,2000))}
function deleteBackup(n){if(confirm('¿Borrar este backup?'))api('backups/delete',{name:n}).then(loadBackups)}
function restoreBackup(n){if(confirm('¿Restaurar servidor? Esto borrará los archivos actuales.'))api('backups/restore',{name:n})}

function loadCfg(){
    fetch('/api/config').then(r=>r.json()).then(d=>{
        const c=document.getElementById('cfg-list');
        c.innerHTML='';
        if(Object.keys(d).length===0){c.innerHTML='<p style="color:var(--text-muted); padding:20px;">⚠️ El servidor no se ha iniciado nunca o no existe server.properties.</p>';return}
        Object.entries(d).forEach(([k,v])=>{
            const el = document.createElement('div');
            el.style.marginBottom='10px';
            if(v==='true'||v==='false'){
                const ch=v==='true';
                el.innerHTML=`<div class="glass-panel" style="padding:10px; display:flex; justify-content:space-between; align-items:center"><label style="font-weight:600; font-size:0.9rem">${k}</label><input type="checkbox" class="cfg-bool" data-k="${k}" ${ch?'checked':''} style="width:20px; height:20px; accent-color:var(--primary)"></div>`;
            }else{
                el.innerHTML=`<label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px">${k}</label><input type="text" class="cfg-in" data-k="${k}" value="${v}" style="width:100%; padding:10px; background:var(--input-bg); border:1px solid var(--border-color); color:var(--text-main); border-radius:8px">`;
            }
            c.appendChild(el);
        });
    }).catch(e=>{});
}

function saveCfg(){
    const d={};
    document.querySelectorAll('.cfg-in').forEach(i=>{if(i.dataset.k)d[i.dataset.k]=i.value});
    document.querySelectorAll('.cfg-bool').forEach(i=>{if(i.dataset.k)d[i.dataset.k]=i.checked?'true':'false'});
    api('config',d);
    Toastify({text:'Configuración guardada.',style:{background:'#10b981'}}).showToast();
}

// --- ACTUALIZACIONES ---
checkUpdate(true);
function checkUpdate(isAuto=false){
    if(!isAuto)Toastify({text:'Buscando actualizaciones...',style:{background:'#8b5cf6'}}).showToast();
    fetch('/api/update/check').then(r=>r.json()).then(d=>{
        if(d.type!=='none') showUpdateModal(d);
        else if(!isAuto) Toastify({text:'El sistema está actualizado.',style:{background:'#10b981'}}).showToast();
    }).catch(e=>{});
}

function showUpdateModal(d){
    const m=document.getElementById('update-modal');
    const t=document.getElementById('update-text');
    const a=document.getElementById('up-actions');
    
    t.innerText=`Nueva versión ${d.remote} disponible.`;
    a.innerHTML=`<button onclick="doUpdate('${d.type}')" class="btn btn-primary">ACTUALIZAR AHORA</button><button onclick="closeAllModals()" class="btn btn-secondary">Cancelar</button>`;
    
    m.classList.add('active'); setTimeout(() => m.querySelector('.modal-card').classList.add('active'), 10);
}

function doUpdate(type){
    closeAllModals();
    fetch('/api/update/perform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})}).then(r=>r.json()).then(d=>{
        if(d.mode==='soft'){
            Toastify({text:'Interfaz actualizada. Recargando...',style:{background:'#10b981'}}).showToast();
            setTimeout(()=>location.reload(),1500);
        }
        if(d.mode==='hard'){
            Toastify({text:'Sistema actualizándose. Espera...',style:{background:'#f59e0b'}}).showToast();
            setTimeout(()=>location.reload(),10000);
        }
    });
}

function forceUIUpdate(){
    const m = document.getElementById('force-ui-modal');
    m.classList.add('active'); setTimeout(() => m.querySelector('.modal-card').classList.add('active'), 10);
}

function confirmForceUI(){
    closeAllModals();
    Toastify({text:'Reinstalando interfaz...',style:{background:'#8b5cf6'}}).showToast();
    fetch('/api/update/perform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'soft'})}).then(r=>r.json()).then(d=>{
        if(d.success){
            Toastify({text:'¡Listo! Recargando...',style:{background:'#10b981'}}).showToast();
            setTimeout(()=>location.reload(),1500);
        }
    });
}
