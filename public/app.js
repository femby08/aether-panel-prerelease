// Variable Global para Socket.io
const socket = io();

// Variables para Gráficas
let cpuChart, ramChart;
const MAX_DATA = 20; // Número de puntos en la gráfica

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🌌 Aether Panel: Inicializando UI...");

    // 1. OBTENER VERSIÓN DEL PANEL
    fetch('/api/info')
        .then(r => r.json())
        .then(data => {
            const el = document.getElementById('version-display');
            if (el) {
                el.innerText = 'v' + (data.version || '1.0.0');
                el.style.opacity = '0.7'; 
                el.style.marginLeft = '8px';
            }
        })
        .catch(e => console.error("Error obteniendo versión:", e));

    // 2. INICIALIZAR GRÁFICAS (Chart.js)
    initCharts();

    // 3. INICIAR BUCLES DE DATOS (Polling)
    refreshStats();             // Ejecutar inmediatamente
    setInterval(refreshStats, 2000); // Repetir cada 2 segundos

    // 4. CONFIGURACIÓN INICIAL
    // Si la pestaña actual es Config, cargar los datos
    if(document.getElementById('tab-config')?.classList.contains('active')) {
        loadConfig();
    }
    
    // 5. INICIALIZAR TERMINAL
    initTerminal();
});

// ==========================================
// LÓGICA DE GRÁFICAS Y MONITOR
// ==========================================
async function refreshStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();

        // Actualizar Textos Numéricos
        const cpuElem = document.getElementById('cpu-val');
        if(cpuElem) cpuElem.innerText = Math.round(data.cpu) + '%';

        const ramElem = document.getElementById('ram-val');
        if(ramElem) ramElem.innerText = (data.ram_used / 1024).toFixed(1) + ' GB';
        
        // Actualizar Barra de Disco
        const diskMb = Math.round(data.disk_used);
        const diskElem = document.getElementById('disk-val');
        if(diskElem) diskElem.innerText = diskMb + ' MB';
        
        const diskPorc = (diskMb / data.disk_total) * 100;
        const bar = document.getElementById('disk-bar');
        if(bar) bar.style.width = Math.min(diskPorc, 100) + '%';

        // Actualizar Gráficas (Animación suave)
        if (cpuChart) addDataToChart(cpuChart, data.cpu);
        if (ramChart) addDataToChart(ramChart, (data.ram_used / data.ram_total) * 100);

    } catch (e) {
        // Ignoramos errores puntuales de conexión para no saturar la consola
    }
}

function addDataToChart(chart, val) {
    const data = chart.data.datasets[0].data;
    data.push(val);   // Añadir nuevo valor al final
    data.shift();     // Eliminar el valor más antiguo
    chart.update('none'); // 'none' evita la animación completa de redibujado
}

function initCharts() {
    // Configuración común para que se vean bonitas
    const commonOpts = {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { 
            x: { display: false }, 
            y: { display: false, min: 0, max: 100 } 
        },
        elements: { point: { radius: 0 } }, // Sin puntos, solo línea
        animation: false
    };

    // Crear Gráfica CPU
    const ctxCpu = document.getElementById('cpu-chart')?.getContext('2d');
    if (ctxCpu) {
        const grad = ctxCpu.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.5)'); // Púrpura
        grad.addColorStop(1, 'rgba(168, 85, 247, 0)');

        cpuChart = new Chart(ctxCpu, {
            type: 'line',
            data: { 
                labels: Array(MAX_DATA).fill(''), 
                datasets: [{ 
                    data: Array(MAX_DATA).fill(0), 
                    borderColor: '#a855f7', 
                    borderWidth: 2, 
                    fill: true, 
                    backgroundColor: grad 
                }] 
            },
            options: commonOpts
        });
    }

    // Crear Gráfica RAM
    const ctxRam = document.getElementById('ram-chart')?.getContext('2d');
    if (ctxRam) {
        const grad = ctxRam.createLinearGradient(0, 0, 0, 100);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Azul
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ramChart = new Chart(ctxRam, {
            type: 'line',
            data: { 
                labels: Array(MAX_DATA).fill(''), 
                datasets: [{ 
                    data: Array(MAX_DATA).fill(0), 
                    borderColor: '#3b82f6', 
                    borderWidth: 2, 
                    fill: true, 
                    backgroundColor: grad 
                }] 
            },
            options: commonOpts
        });
    }
}

// ==========================================
// CONFIGURACIÓN (server.properties)
// ==========================================
function loadConfig() {
    fetch('/api/config')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('cfg-list');
            if(!list) return;
            
            if(Object.keys(data).length === 0) {
                list.innerHTML = '<p style="color:gray; text-align:center; padding:20px;">No se pudo leer server.properties (¿El servidor existe?)</p>';
                return;
            }

            let html = '';
            Object.entries(data).forEach(([key, val]) => {
                html += `
                <div class="setting-row" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
                    <label style="font-family:monospace; color:#ccc;">${key}</label>
                    <input class="cfg-in" data-key="${key}" value="${val}" style="background:rgba(0,0,0,0.3); border:1px solid #444; color:white; padding:5px 10px; text-align:right; border-radius:4px;">
                </div>`;
            });
            list.innerHTML = html;
        })
        .catch(e => console.error("Error config:", e));
}

function saveCfg() {
    const inputs = document.querySelectorAll('.cfg-in');
    const newConf = {};
    
    // Recoger valores
    inputs.forEach(el => newConf[el.dataset.key] = el.value);

    // Enviar al servidor
    fetch('/api/config', {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(newConf)
    })
    .then(r => r.json())
    .then(data => {
        // Recargar la vista con los datos confirmados por el servidor
        loadConfig(); 
        if(window.Toastify) {
            Toastify({text: "✅ Configuración Guardada", duration: 3000, style:{background:"#10b981"}}).showToast();
        } else {
            alert("Configuración Guardada");
        }
    });
}

// ==========================================
// TERMINAL (xterm.js)
// ==========================================
function initTerminal() {
    const termDiv = document.getElementById('terminal');
    // Verificamos si xterm y el div existen
    if(termDiv && window.Terminal) {
        // Limpiamos por si acaso
        termDiv.innerHTML = '';

        const term = new Terminal({ 
            theme: { background: '#0f0f13' },
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 14
        });
        
        // Addon Fit para ajustar tamaño
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        
        term.open(termDiv);
        fitAddon.fit();
        
        term.writeln('\x1b[1;36m>>> CONEXIÓN ESTABLECIDA CON AETHER PANEL.\x1b[0m\r\n');

        // Escuchar datos del backend
        socket.on('console_data', (d) => term.write(d));
        socket.on('logs_history', (d) => term.write(d));

        // Enviar comandos al backend (enter)
        let commandBuffer = '';
        term.onData(key => {
            if (key === '\r') { // Enter
                term.write('\r\n');
                socket.emit('command', commandBuffer);
                commandBuffer = '';
            } else if (key === '\u007F') { // Backspace
                if (commandBuffer.length > 0) {
                    commandBuffer = commandBuffer.slice(0, -1);
                    term.write('\b \b');
                }
            } else {
                commandBuffer += key;
                term.write(key);
            }
        });
        
        // Ajustar al redimensionar ventana
        window.addEventListener('resize', () => fitAddon.fit());
    }
}

// ==========================================
// NAVEGACIÓN Y UTILIDADES
// ==========================================
function setTab(name) {
    // 1. Desactivar todos
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // 2. Activar seleccionado
    const tab = document.getElementById('tab-' + name);
    const nav = document.getElementById('nav-' + name);
    
    if(tab) tab.classList.add('active');
    if(nav) nav.classList.add('active');

    // 3. Cargas bajo demanda
    if(name === 'config') loadConfig();
    if(name === 'console') window.dispatchEvent(new Event('resize')); // Ajustar terminal
}

function api(endpoint) {
    fetch('/api/' + endpoint, { method: 'POST' });
}

// Funciones para Modales (Updates y UI)
function checkUpdate() {
    closeAllModals();
    if(window.Toastify) Toastify({text: "🔍 Buscando actualizaciones...", style:{background:"#3b82f6"}}).showToast();
    
    fetch('/api/update/check')
        .then(r => r.json())
        .then(d => {
            if(d.type === 'none') {
                 if(window.Toastify) Toastify({text: "✅ Sistema actualizado", style:{background:"green"}}).showToast();
            } else {
                // Aquí abrirías el modal de update real
                alert(`Nueva versión disponible: ${d.remote}`);
            }
        });
}

function forceUIUpdate() {
    closeAllModals();
    if(confirm("¿Recargar la interfaz?")) location.reload();
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function openDetail(type) {
    // Placeholder para los detalles de las gráficas
    console.log("Abriendo detalle de: " + type);
    const modal = document.getElementById('detail-modal');
    if(modal) modal.classList.add('active');
}

// Exponer funciones globales para que el HTML pueda llamarlas (onclick="...")
window.setTab = setTab;
window.saveCfg = saveCfg;
window.api = api;
window.checkUpdate = checkUpdate;
window.forceUIUpdate = forceUIUpdate;
window.closeAllModals = closeAllModals;
window.openDetail = openDetail;
window.confirmForceUI = () => location.reload();
window.performForceUpdate = () => location.reload();
