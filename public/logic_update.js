
// ==================== NAVIGATE UP (BACK BUTTON) ====================
function navigateUp() {
    if (!currentPath || currentPath === '/') return;
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
    loadFileBrowser(parentPath);
}

// ==================== BACKUPS SYSTEM ====================

function loadBackups() {
    const list = document.getElementById('backup-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted)">Cargando backups...</div>';

    api('backups', null, 'GET').then(backups => {
        if (!backups || backups.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--muted)">
                    <i class="fa-solid fa-box-open" style="font-size:3rem; opacity:0.3; margin-bottom:15px"></i>
                    <p>No hay copias de seguridad</p>
                </div>`;
            return;
        }

        list.innerHTML = backups.map(backup => `
            <div class="file-item" style="cursor:default">
                <i class="fa-solid fa-file-zipper" style="color:var(--p); font-size:1.5rem"></i>
                <div class="file-info">
                    <div class="file-name">${backup.name}</div>
                    <div class="file-meta">
                        ${new Date(backup.created).toLocaleString()} • ${(backup.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="restoreBackup('${backup.name}')" class="btn btn-secondary" title="Restaurar" style="padding:6px 12px">
                        <i class="fa-solid fa-rotate-left"></i> Restablecer
                    </button>
                    <button onclick="deleteBackup('${backup.name}')" class="btn btn-ghost" title="Eliminar" style="color:var(--danger)">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }).catch(err => {
        list.innerHTML = `<div style="color:var(--danger)">Error al cargar backups: ${err.message}</div>`;
    });
}

function openBackupModal() {
    document.getElementById('backup-modal').style.display = 'flex';
    document.getElementById('backup-name-input').value = '';
    document.getElementById('backup-name-input').focus();
}

function closeBackupModal() {
    document.getElementById('backup-modal').style.display = 'none';
}

function confirmCreateBackup() {
    const nameInput = document.getElementById('backup-name-input').value.trim();
    const btn = document.querySelector('#backup-modal .btn-primary');

    // Disable button to prevent double click
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Creando...';

    const payload = {};
    if (nameInput) payload.name = nameInput;

    api('backups/create', payload)
        .then(res => {
            if (res.success) {
                Toastify({ text: `Backup ${res.name} creado`, style: { background: '#10b981' } }).showToast();
                closeBackupModal();
                loadBackups();
            } else {
                Toastify({ text: res.error || 'Error al crear backup', style: { background: '#ef4444' } }).showToast();
            }
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerText = originalText;
        });
}

function deleteBackup(name) {
    if (!confirm(`¿Estás seguro de eliminar ${name}?`)) return;

    api('backups/delete', { name })
        .then(res => {
            if (res.success) {
                Toastify({ text: 'Backup eliminado', style: { background: '#10b981' } }).showToast();
                loadBackups();
            } else {
                Toastify({ text: res.error || 'Error', style: { background: '#ef4444' } }).showToast();
            }
        });
}

function restoreBackup(name) {
    if (!confirm(`⚠️ PRECAUCIÓN: Esto borrará el servidor actual y restaurará ${name}. ¿Continuar?`)) return;

    Toastify({ text: 'Iniciando restauración... El servidor se detendrá.', duration: 5000, style: { background: '#f59e0b' } }).showToast();

    api('backups/restore', { name })
        .then(res => {
            if (res.success) {
                Toastify({ text: 'Restauración completada. Reiniciando servidor...', style: { background: '#10b981' } }).showToast();
                // Wait a bit then refresh
                setTimeout(() => window.location.reload(), 3000);
            } else {
                Toastify({ text: res.error || 'Error en restauración', style: { background: '#ef4444' } }).showToast();
            }
        });
}

// ==================== SCHEDULER SYSTEM ====================

function loadCronTasks() {
    const list = document.getElementById('cron-list');
    if (!list) return;

    api('cron', null, 'GET').then(tasks => {
        if (!tasks || tasks.length === 0) {
            list.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--muted)">
                    <i class="fa-solid fa-clock" style="font-size:3rem; opacity:0.3; margin-bottom:15px"></i>
                    <p>No hay tareas programadas</p>
                </div>`;
            return;
        }

        list.innerHTML = tasks.map(task => {
            let icon = 'fa-calendar';
            let color = 'var(--p)';

            if (task.action === 'restart') { icon = 'fa-rotate'; color = '#3b82f6'; }
            if (task.action === 'stop') { icon = 'fa-stop'; color = '#ef4444'; }
            if (task.action === 'backup') { icon = 'fa-box-archive'; color = '#10b981'; }

            // Human readable frequency
            let freqMap = {
                '0 0 * * *': 'Diariamente (00:00)',
                '0 0 * * 1': 'Semanalmente (Lun)',
                '0 0 1 * *': 'Mensualmente (Día 1)',
                '0 */6 * * *': 'Cada 6 Horas'
            };
            let humanFreq = freqMap[task.expression || task.schedule] || (task.expression || task.schedule);

            return `
            <div class="card glass" style="margin:0; min-height:auto; border:1px solid var(--glass-border)">
                <div style="display:flex; justify-content:space-between; align-items:flex-start">
                    <div style="display:flex; gap:15px; align-items:center">
                        <div style="width:40px; height:40px; border-radius:10px; background:${color}20; display:flex; align-items:center; justify-content:center; color:${color}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:1.05rem">${task.name}</div>
                            <div style="font-size:0.85rem; color:var(--muted); margin-top:4px">
                                <i class="fa-solid fa-repeat" style="font-size:0.7rem"></i> ${humanFreq}
                            </div>
                        </div>
                    </div>
                    <button onclick="deleteTask('${task.id}')" class="btn btn-ghost" style="color:var(--danger); padding:5px 10px">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                ${task.action === 'command' ? `
                    <div style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.2); border-radius:6px; font-family:'JetBrains Mono'; font-size:0.8rem; color:var(--muted)">
                        > ${task.command || 'No command'}
                    </div>
                ` : ''}
            </div>
            `;
        }).join('');
    }).catch(err => {
        list.innerHTML = `<div style="color:var(--danger)">Error al cargar tareas: ${err.message}</div>`;
    });
}

function openSchedulerModal() {
    document.getElementById('scheduler-modal').style.display = 'flex';
}

function closeSchedulerModal() {
    document.getElementById('scheduler-modal').style.display = 'none';
}

function toggleTaskActionFields() {
    const action = document.getElementById('task-action').value;
    document.getElementById('task-command-field').style.display = action === 'command' ? 'block' : 'none';
}

function toggleTaskCustomCron() {
    const freq = document.getElementById('task-frequency').value;
    document.getElementById('task-cron-field').style.display = freq === 'custom' ? 'block' : 'none';
}

function saveTask() {
    const name = document.getElementById('task-name').value.trim();
    const action = document.getElementById('task-action').value;
    const freq = document.getElementById('task-frequency').value;
    const customCron = document.getElementById('task-cron').value.trim();
    const command = document.getElementById('task-command').value.trim();

    if (!name) return Toastify({ text: 'Nombre requerido', style: { background: '#ef4444' } }).showToast();

    let expression = freq === 'custom' ? customCron : freq;
    if (!expression) return Toastify({ text: 'Frecuencia requerida', style: { background: '#ef4444' } }).showToast();

    if (action === 'command' && !command) return Toastify({ text: 'Comando requerido', style: { background: '#ef4444' } }).showToast();

    // Load existing to append
    api('cron', null, 'GET').then(tasks => {
        const newTask = {
            id: Date.now().toString(),
            name: name,
            action: action,
            expression: expression,
            command: command,
            enabled: true
        };

        const updatedTasks = [...(tasks || []), newTask];

        api('cron', updatedTasks).then(res => {
            if (res.success) {
                Toastify({ text: 'Tarea guardada', style: { background: '#10b981' } }).showToast();
                closeSchedulerModal();
                loadCronTasks();
            } else {
                Toastify({ text: 'Error al guardar', style: { background: '#ef4444' } }).showToast();
            }
        });
    });
}

function deleteTask(id) {
    if (!confirm('¿Eliminar tarea?')) return;

    api('cron/' + id, null, 'DELETE').then(res => {
        if (res.success) {
            Toastify({ text: 'Tarea eliminada', style: { background: '#10b981' } }).showToast();
            loadCronTasks();
        } else {
            Toastify({ text: 'Error al eliminar', style: { background: '#ef4444' } }).showToast();
        }
    });
}
