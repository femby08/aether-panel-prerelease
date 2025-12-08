const socket = io();

// ESTADO GLOBAL
let currentPath = '';

// --- INICIALIZACIÓN Y ATAJOS ---
document.addEventListener('DOMContentLoaded', () => {
    updateInfo();
    setupShortcuts();
    
    // Auto-focus en consola al cargar
    document.getElementById('console-input').focus();
});

function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Alt + 1/2/3: Navegación
        if (e.altKey) {
            if (e.key === '1') { e.preventDefault(); switchTab('dashboard'); }
            if (e.key === '2') { e.preventDefault(); switchTab('files'); }
            if (e.key === '3') { e.preventDefault(); switchTab('settings'); }
        }
        
        // Esc: Cerrar Modales
        if (e.key === 'Escape') {
            closeModal();
        }

        // Ctrl + S: Guardar en editor
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            const modal = document.getElementById('editor-modal');
            if (!modal.classList.contains('hidden')) {
                e.preventDefault();
                saveFile();
            }
        }
    });

    // Enter en consola
    document.getElementById('console-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendCommand();
    });
}

// --- NAVEGACIÓN ---
function switchTab(tabId) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    
    // Desactivar botones nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Activar seleccionada
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    // Activar botón
    const btn = document.querySelector(`button[onclick="switchTab('${tabId}')"]`);
    if(btn) btn.classList.add('active');

    // Acciones específicas
    if (tabId === 'files') fetchFiles();
    if (tabId === 'settings') loadProperties();
    if (tabId === 'dashboard') {
        setTimeout(() => {
            const out = document.getElementById('console-output');
            out.scrollTop = out.scrollHeight;
            document.getElementById('console-input').focus();
        }, 100);
    }
}

// --- DASHBOARD & SOCKETS ---
socket.on('status_change', (status) => {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    txt.innerText = status;
    
    dot.className = 'dot'; // reset
    if (status === 'ONLINE') dot.classList.add('online');
    else if (status === 'OFFLINE') dot.classList.add('offline');
    else dot.style.background = 'var(--warning)';
});

socket.on('console_data', (msg) => {
    const out = document.getElementById('console-output');
    const div = document.createElement('div');
    // Simple color parsing for MC logs
    if(msg.includes('WARN')) div.style.color = 'var(--warning)';
    if(msg.includes('ERROR') || msg.includes('Exception')) div.style.color = 'var(--danger)';
    if(msg.includes('INFO')) div.style.color = '#a5b4fc';
    
    div.innerText = msg;
    out.appendChild(div);
    if(out.children.length > 500) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
});

socket.on('toast', (data) => showToast(data.msg, data.type));

function sendCommand() {
    const input = document.getElementById('console-input');
    const cmd = input.value;
    if (cmd) {
        socket.emit('command', cmd);
        input.value = '';
    }
}

function powerAction(action) {
    fetch(`/api/power/${action}`, { method: 'POST' });
}

function clearConsole() {
    document.getElementById('console-output').innerHTML = '';
}

// --- ESTADÍSTICAS (Polling) ---
setInterval(() => {
    if(document.getElementById('view-dashboard').classList.contains('active')) {
        fetch('/api/stats').then(r => r.json()).then(d => {
            updateBar('cpu', d.cpu);
            updateBar('ram', (d.ram_used / d.ram_total) * 100, `${Math.round(d.ram_used)} / ${Math.round(d.ram_total)} MB`);
            updateBar('disk', (d.disk_used / d.disk_total) * 100, `${(d.disk_used/1024).toFixed(1)} GB`);
        });
    }
}, 2000);

function updateBar(id, percent, textOverride) {
    const bar = document.getElementById(`${id}-bar`);
    const txt = document.getElementById(`${id}-text`);
    if(bar) bar.style.width = `${Math.min(percent, 100)}%`;
    if(txt) txt.innerText = textOverride || `${Math.round(percent)}%`;
}

// --- GESTOR DE ARCHIVOS ---
function fetchFiles(path = '') {
    currentPath = path;
    document.getElementById('file-path').innerText = path || '/';
    
    fetch(`/api/files?path=${encodeURIComponent(path)}`)
        .then(r => r.json())
        .then(files => {
            const list = document.getElementById('file-list');
            list.innerHTML = '';
            
            if (path) {
                const parent = path.split('/').slice(0,-1).join('/');
                list.innerHTML += `<tr class="file-row" onclick="fetchFiles('${parent}')">
                    <td><i class="fa-solid fa-turn-up"></i> ..</td><td>-</td><td></td>
                </tr>`;
            }

            files.forEach(f => {
                const icon = f.isDir ? 'fa-folder text-warning' : 'fa-file text-secondary';
                const onclick = f.isDir ? `fetchFiles('${path}/${f.name}')` : `editFile('${f.name}')`;
                const color = f.isDir ? 'color: var(--warning)' : '';
                
                list.innerHTML += `
                <tr class="file-row">
                    <td onclick="${onclick}" style="cursor:pointer">
                        <i class="fa-solid ${icon}" style="${color}"></i> ${f.name}
                    </td>
                    <td>${f.size}</td>
                    <td>
                        <button class="btn-icon" onclick="deleteFile('${f.name}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
            });
        });
}

function uploadFile() {
    const input = document.getElementById('upload-input');
    if(input.files.length === 0) return;
    
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    fetch('/api/files/upload', { method: 'POST', body: formData })
        .then(() => {
            showToast('Archivo subido', 'success');
            fetchFiles(currentPath);
        });
}

// --- EDITOR DE ARCHIVOS ---
let currentEditingFile = '';

function editFile(filename) {
    if(!filename.match(/\.(txt|yml|json|properties|log|md|js)$/)) {
        showToast('Solo se pueden editar archivos de texto', 'error');
        return;
    }
    
    currentEditingFile = (currentPath ? currentPath + '/' : '') + filename;
    
    fetch('/api/files/read', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ file: currentEditingFile })
    }).then(r => r.json()).then(d => {
        document.getElementById('file-editor-content').value = d.content;
        document.getElementById('editor-filename').innerText = filename;
        document.getElementById('editor-modal').classList.remove('hidden');
    });
}

function saveFile() {
    const content = document.getElementById('file-editor-content').value;
    fetch('/api/files/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ file: currentEditingFile, content: content })
    }).then(() => {
        showToast('Archivo guardado', 'success');
        closeModal();
    });
}

function closeModal() {
    document.getElementById('editor-modal').classList.add('hidden');
}

// --- UTILIDADES ---
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function updateInfo() {
    fetch('/api/info').then(r=>r.json()).then(d=>{
        document.getElementById('version-badge').innerText = `v${d.version}`;
    });
}

// Placeholder functions for Settings (simplified)
function loadVersions() { /* Logic to load versions based on type */ }
function loadProperties() { /* Logic to load properties */ }
