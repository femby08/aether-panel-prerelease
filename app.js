const socket = io();
let currentPath = '', currentFile = '', allVersions = [], currentStoreMode = 'versions';

// --- 1. INFO & INICIO ---
fetch('/api/info').then(r => r.json()).then(d => {
    const sb = document.getElementById('sidebar-version-text');
    const hb = document.getElementById('header-version');
    if(sb) sb.innerText = 'V' + d.version;
    if(hb) hb.innerText = 'V' + d.version;
});

// --- RED ---
fetch('/api/network').then(r => r.json()).then(d => {
    const ipElem = document.getElementById('server-ip-display');
    if(ipElem) {
        const val = d.custom_domain ? `${d.custom_domain}:${d.port}` : `${d.ip}:${d.port}`;
        ipElem.innerText = val; 
        ipElem.dataset.fullIp = val;
    }
}).catch(() => {});

function copyIP() { 
    const ip = document.getElementById('server-ip-display').dataset.fullIp;
    navigator.clipboard.writeText(ip).then(() => Toastify({text: '¡IP Copiada!', style:{background:'#10b981'}}).showToast()); 
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
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none'); 
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
    document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`theme-btn-${mode}`);
    if(btn) btn.classList.add('active');
    
    if (typeof term !== 'undefined') updateTerminalTheme(apply);
}

function updateTerminalTheme(mode) {
    const isLight = mode === 'light';
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
    document.documentElement.style.setProperty('--p', color);
    document.documentElement.style.setProperty('--p-light', color + '80'); 
    document.documentElement.style.setProperty('--p-dark', color); 
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

// --- INICIALIZAR AL FINAL PARA EVITAR BUGS ---
updateThemeUI(localStorage.getItem('theme') || 'dark');
setAccentMode(localStorage.getItem('accent_mode') || 'auto');
setDesign(localStorage.getItem('design_mode') || 'glass');

// --- 5. LOGICA TABS ---
function setTab(t, btn) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
    
    const target = document.getElementById('tab-' + t);
    if(target) target.classList.add('active');
    
    if (btn) {
        btn.classList.add('active');
    } else {
        const autoBtn = document.querySelector(`.nav-btn[onclick*="'${t}'"]`);
        if(autoBtn) autoBtn.classList.add('active');
    }

    const actions = document.getElementById('header-actions');
    if(actions) {
        actions.style.opacity = (t === 'stats') ? '0' : '1';
        actions.style.pointerEvents = (t === 'stats') ? 'none' : 'auto';
    }

    if (t === 'console') setTimeout(() => { fitAddon.fit(); const i=document.getElementById('console-input'); if(i)i.focus() }, 100);
    if (t === 'files') loadFileBrowser(''); 
    if (t === 'config') loadCfg(); 
    if (t === 'backups') loadBackups();
}

// --- API & CHARTS ---
function api(ep, body) { return fetch('/api/' + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()); }
const cpuChart = new Chart(document.getElementById('cpuChart').getContext('2d'), { type:'line', data:{labels:Array(20).fill(''),datasets:[{data:Array(20).fill(0),borderColor:'#8b5cf6',backgroundColor:'#8b5cf615',fill:true,tension:0.4,pointRadius:0,borderWidth:2}]}, options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},scales:{x:{display:false},y:{min:0,max:100,grid:{display:false},ticks:{display:false}}},plugins:{legend:{display:false}}} });
const ramChart = new Chart(document.getElementById('ramChart').getContext('2d'), { type:'line', data:{labels:Array(20).fill(''),datasets:[{data:Array(20).fill(0),borderColor:'#3b82f6',backgroundColor:'#3b82f615',fill:true,tension:0.4,pointRadius:0,borderWidth:2}]}, options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},scales:{x:{display:false},y:{min:0,grid:{display:false},ticks:{display:false}}},plugins:{legend:{display:false}}} });

setInterval(() => {
    fetch('/api/stats').then(r => r.json()).then(d => {
        cpuChart.data.datasets[0].data.shift(); cpuChart.data.datasets[0].data.push(d.cpu); cpuChart.update(); document.getElementById('cpu-val').innerText = d.cpu.toFixed(1) + '%';
        if (d.cpu_freq && d.cpu_freq > 0) document.getElementById('cpu-freq').innerText = (d.cpu_freq / 1000).toFixed(1) + ' GHz';
        const toGB = (b) => (b / 1073741824).toFixed(1);
        ramChart.options.scales.y.max = parseFloat(toGB(d.ram_total)); ramChart.data.datasets[0].data.shift(); ramChart.data.datasets[0].data.push(parseFloat(toGB(d.ram_used))); ramChart.update();
        document.getElementById('ram-val').innerText = `${toGB(d.ram_used)} / ${toGB(d.ram_total)} GB`; document.getElementById('ram-free').innerText = toGB(d.ram_free) + ' GB Libre';
        document.getElementById('disk-val').innerText = (d.disk_used / 1048576).toFixed(0) + ' MB'; document.getElementById('disk-fill').style.width = Math.min((d.disk_used / d.disk_total) * 100, 100) + '%';
        socket.on('status_change', s => { const w = document.getElementById('status-widget'); if(w) { w.className = 'status-widget ' + s; document.getElementById('status-text').innerText = s; } });
    }).catch(() => { });
}, 1000);

const modsDB=[{name:"Jei",fullName:"Just Enough Items",url:"https://mediafilez.forgecdn.net/files/5936/206/jei-1.20.1-forge-15.3.0.4.jar",icon:"fa-book",color:"#2ecc71"},{name:"Iron Chests",fullName:"Iron Chests",url:"https://mediafilez.forgecdn.net/files/4670/664/ironchest-1.20.1-14.4.4.jar",icon:"fa-box",color:"#95a5a6"},{name:"JourneyMap",fullName:"JourneyMap",url:"https://mediafilez.forgecdn.net/files/5864/381/journeymap-1.20.1-5.9.18-forge.jar",icon:"fa-map",color:"#3498db"}];
function openModStore(){currentStoreMode='mods';const m=document.getElementById('version-modal');m.style.display='flex';document.getElementById('version-list').innerHTML='';m.querySelector('.modal-header h3').innerHTML='<i class="fa-solid fa-store"></i> Mod Store';renderMods(modsDB)}
function renderMods(list){const c=document.getElementById('version-list');c.innerHTML='';list.forEach(mod=>{const el=document.createElement('div');el.className='mod-card-modern';el.style.setProperty('--mod-color',mod.color);el.innerHTML=`<div class="mod-cover" style="height:80px;margin-bottom:10px"><i class="fa-solid ${mod.icon}"></i></div><div class="mod-body" style="padding:10px"><h4>${mod.name}</h4><p style="font-size:0.8rem">${mod.fullName}</p><button class="btn-install"><i class="fa-solid fa-download"></i> Instalar</button></div>`;el.onclick=()=>{if(confirm(`¿Instalar ${mod.fullName}?`)){api('mods/install',{url:mod.url,name:mod.name});closeAllModals()}};c.appendChild(el)})}
async function loadVersions(type){currentStoreMode='versions';const m=document.getElementById('version-modal');m.style.display='flex';document.getElementById('version-list').innerHTML='';try{allVersions=await api('nebula/versions',{type});renderVersions(allVersions)}catch(e){}}
function renderVersions(list){const g=document.getElementById('version-list');g.innerHTML='';list.forEach(v=>{const e=document.createElement('div');e.className='version-card';e.style.padding='15px';e.innerHTML=`<h4 style="font-weight:700">${v.id}</h4><span style="font-size:0.8rem;color:var(--muted)">${v.type}</span>`;e.onclick=()=>installVersion(v);g.appendChild(e)})}
let pendingInstall=null;async function installVersion(v){pendingInstall=v;document.getElementById('version-modal').style.display='none';document.getElementById('ram-modal').style.display='flex'}
function confirmInstall(){if(!pendingInstall)return;const ram=document.getElementById('ram-slider').value;const v=pendingInstall;document.getElementById('ram-modal').style.display='none';pendingInstall=null;Toastify({text:'Iniciando...',style:{background:'#3b82f6'}}).showToast();try{if(v.type==='vanilla'){api('nebula/resolve-vanilla',{url:v.url}).then(r=>{if(r&&r.url)finalizeInstall(r.url,'server.jar',ram)})}else if(v.type==='paper'){fetch(`https://api.papermc.io/v2/projects/paper/versions/${v.id}`).then(r=>r.json()).then(d=>{const b=d.builds[d.builds.length-1];finalizeInstall(`https://api.papermc.io/v2/projects/paper/versions/${v.id}/builds/${b}/downloads/paper-${v.id}-${b}.jar`,'server.jar',ram)})}else if(v.type==='fabric'){fetch('https://meta.fabricmc.net/v2/versions/loader').then(r=>r.json()).then(d=>{finalizeInstall(`https://meta.fabricmc.net/v2/versions/loader/${v.id}/${d[0].version}/1.0.1/server/jar`,'server.jar',ram)})}else if(v.type==='forge'){api('nebula/resolve-forge',{version:v.id}).then(res=>{if(res&&res.url)finalizeInstall(res.url,'forge-installer.jar',ram)})}}catch(e){}}
function finalizeInstall(url,filename,ram){api('settings',{ram:ram+'G'});api('install',{url,filename});Toastify({text:'Descargando...',style:{background:'#10b981'}}).showToast()}
function loadFileBrowser(p){currentPath=p;document.getElementById('file-breadcrumb').innerText='/root'+(p?'/'+p:'');api('files?path='+encodeURIComponent(p)).then(fs=>{const l=document.getElementById('file-list');l.innerHTML='';if(p){const b=document.createElement('div');b.className='file-row';b.innerHTML='<span>..</span>';b.onclick=()=>{const a=p.split('/');a.pop();loadFileBrowser(a.join('/'))};l.appendChild(b)}fs.forEach(f=>{const e=document.createElement('div');e.className='file-row';e.innerHTML=`<span><i class="fa-solid ${f.isDir?'fa-folder':'fa-file'}"></i> ${f.name}</span><span>${f.size}</span>`;if(f.isDir)e.onclick=()=>loadFileBrowser((p?p+'/':'')+f.name);else e.onclick=()=>openEditor((p?p+'/':'')+f.name);l.appendChild(e)})})}
function uploadFile(){const i=document.createElement('input');i.type='file';i.onchange=(e)=>{const f=new FormData();f.append('file',e.target.files[0]);fetch('/api/files/upload',{method:'POST',body:f}).then(r=>r.json()).then(d=>{if(d.success)loadFileBrowser(currentPath)})};i.click()}
const ed=ace.edit("ace-editor");ed.setTheme("ace/theme/dracula");ed.setOptions({fontSize:"14px"});function openEditor(f){currentFile=f;api('files/read',{file:f}).then(d=>{if(!d.error){document.getElementById('editor-modal').style.display='flex';ed.setValue(d.content,-1)}})}
function saveFile(){api('files/save',{file:currentFile,content:ed.getValue()}).then(()=>{document.getElementById('editor-modal').style.display='none'})}
function closeEditor(){document.getElementById('editor-modal').style.display='none'}
function loadBackups(){api('backups').then(b=>{const l=document.getElementById('backup-list');l.innerHTML='';b.forEach(k=>{const e=document.createElement('div');e.className='file-row';e.innerHTML=`<span>${k.name}</span><div><button class="btn btn-sm" onclick="restoreBackup('${k.name}')">Restaurar</button><button class="btn btn-sm stop" onclick="deleteBackup('${k.name}')">X</button></div>`;l.appendChild(e)})})}
function createBackup(){api('backups/create').then(()=>setTimeout(loadBackups,2000))}
function deleteBackup(n){if(confirm('¿Borrar?'))api('backups/delete',{name:n}).then(loadBackups)}
function restoreBackup(n){if(confirm('¿Restaurar?'))api('backups/restore',{name:n})}
function loadCfg(){fetch('/api/config').then(r=>r.json()).then(d=>{const c=document.getElementById('cfg-list');c.innerHTML='';if(Object.keys(d).length===0){c.innerHTML='<p style="color:var(--muted);text-align:center;padding:20px;">⚠️ Inicia el servidor.</p>';return}Object.entries(d).forEach(([k,v])=>{if(v==='true'||v==='false'){const ch=v==='true';c.innerHTML+=`<div class="cfg-item"><label class="cfg-label">${k}</label><div style="display:flex;justify-content:space-between;background:var(--glass);padding:10px;border-radius:12px;border:1px solid var(--glass-border)"><span style="font-size:0.8rem">${ch?'Activado':'Desactivado'}</span><label class="switch"><input type="checkbox" class="cfg-bool" data-k="${k}" ${ch?'checked':''}><span class="slider round"></span></label></div></div>`}else{c.innerHTML+=`<div class="cfg-item"><label class="cfg-label">${k}</label><input type="text" class="cfg-in" data-k="${k}" value="${v}"></div>`}})}).catch(e=>{})}
function saveCfg(){const d={};document.querySelectorAll('.cfg-in').forEach(i=>{if(i.dataset.k)d[i.dataset.k]=i.value});document.querySelectorAll('.cfg-bool').forEach(i=>{if(i.dataset.k)d[i.dataset.k]=i.checked?'true':'false'});api('config',d);Toastify({text:'Guardado',style:{background:'#10b981'}}).showToast()}
checkUpdate(true);function checkUpdate(isAuto=false){if(!isAuto)Toastify({text:'Buscando...',style:{background:'var(--p)'}}).showToast();fetch('/api/update/check').then(r=>r.json()).then(d=>{if(d.type!=='none')showUpdateModal(d);else if(!isAuto)Toastify({text:'Actualizado',style:{background:'#10b981'}}).showToast()}).catch(e=>{})}
function showUpdateModal(d){const m=document.getElementById('update-modal');if(!m)return;const t=document.getElementById('update-text');const a=document.getElementById('up-actions');if(d.type==='hard'){t.innerText=`Nueva versión disponible.`;a.innerHTML=`<button onclick="doUpdate('hard')" class="btn btn-primary">ACTUALIZAR</button><button onclick="document.getElementById('update-modal').style.display='none'" class="btn btn-ghost">Cancelar</button>`;m.style.display='flex'}}
function doUpdate(type){document.getElementById('update-modal').style.display='none';fetch('/api/update/perform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})}).then(r=>r.json()).then(d=>{if(d.mode==='soft'){Toastify({text:'Aplicado.',style:{background:'#10b981'}}).showToast();setTimeout(()=>location.reload(),1500)}if(d.mode==='hard'){Toastify({text:'Reiniciando...',style:{background:'#f59e0b'}}).showToast();setTimeout(()=>location.reload(),8000)}})}
function forceUIUpdate(){document.getElementById('force-ui-modal').style.display='flex'}
function confirmForceUI(){document.getElementById('force-ui-modal').style.display='none';Toastify({text:'Descargando...',style:{background:'#8b5cf6'}}).showToast();fetch('/api/update/perform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'soft'})}).then(r=>r.json()).then(d=>{if(d.success){Toastify({text:'¡Actualizado!',style:{background:'#10b981'}}).showToast();setTimeout(()=>location.reload(),1500)}})}