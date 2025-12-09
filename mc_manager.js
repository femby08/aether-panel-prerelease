const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class MCManager {
    constructor(io) {
        this.io = io;
        this.process = null;
        this.serverPath = path.join(__dirname, 'servers', 'default');
        this.settingsPath = path.join(__dirname, 'settings.json');
        
        if (!fs.existsSync(this.serverPath)) fs.mkdirSync(this.serverPath, { recursive: true });
        
        this.status = 'OFFLINE';
        this.logs = [];
        this.onlinePlayers = new Set(); // Nuevo: Rastreo de jugadores
        this.ram = '4G';
        this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
                this.ram = settings.ram || '4G';
            }
        } catch (e) { this.ram = '4G'; }
    }

    log(msg) { 
        this.logs.push(msg); 
        if(this.logs.length > 2000) this.logs.shift(); 
        this.io.emit('console_data', msg); 
        
        // --- LOGICA DETECCIÓN JUGADORES ---
        // Detectar entrada
        const joinMatch = msg.match(/:\s(\w+)\sjoined\sthe\sgame/);
        if (joinMatch) {
            this.onlinePlayers.add(joinMatch[1]);
            this.io.emit('players_update', Array.from(this.onlinePlayers));
        }
        // Detectar salida
        const leaveMatch = msg.match(/:\s(\w+)\sleft\sthe\sgame/);
        if (leaveMatch) {
            this.onlinePlayers.delete(leaveMatch[1]);
            this.io.emit('players_update', Array.from(this.onlinePlayers));
        }
    }

    getStatus() { return { status: this.status, ram: this.ram, players: Array.from(this.onlinePlayers) }; }
    getRecentLogs() { return this.logs.join(''); }
    
    async start() {
        if (this.status !== 'OFFLINE') return;
        this.loadSettings();
        
        const eula = path.join(this.serverPath, 'eula.txt');
        if(!fs.existsSync(eula) || !fs.readFileSync(eula, 'utf8').includes('true')) fs.writeFileSync(eula, 'eula=true');
        
        let jar = fs.readdirSync(this.serverPath).find(f => f.endsWith('.jar') && !f.includes('installer'));
        if (!jar) jar = fs.readdirSync(this.serverPath).find(f => f.includes('forge') && f.endsWith('.jar'));
        if (!jar) { this.io.emit('toast', { type: 'error', msg: 'No JAR found' }); return; }
        
        this.status = 'STARTING'; 
        this.onlinePlayers.clear(); // Limpiar lista al iniciar
        this.io.emit('status_change', this.status); 
        this.log(`\r\n>>> AETHER: Iniciando con ${this.ram} RAM...\r\n`);
        
        this.process = spawn('java', ['-Xmx'+this.ram, '-Xms'+this.ram, '-jar', jar, 'nogui'], { cwd: this.serverPath });
        
        this.process.stdout.on('data', d => { 
            const s = d.toString(); 
            this.log(s); 
            if(s.includes('Done') || s.includes('For help')) { 
                this.status = 'ONLINE'; 
                this.io.emit('status_change', this.status); 
            }
        });
        
        this.process.stderr.on('data', d => this.log(d.toString()));
        
        this.process.on('close', () => { 
            this.status = 'OFFLINE'; 
            this.process = null; 
            this.onlinePlayers.clear();
            this.io.emit('status_change', this.status); 
            this.log('\r\nDetenido.\r\n');
        });
    }

    async stop() { 
        if(this.process && this.status === 'ONLINE') { 
            this.status = 'STOPPING'; 
            this.io.emit('status_change', this.status); 
            this.process.stdin.write('stop\n'); 
            return new Promise(r => {
                let c = 0;
                const i = setInterval(() => {
                    c++;
                    if(this.status === 'OFFLINE' || c > 20) { clearInterval(i); r(); }
                }, 500);
            }); 
        }
    }
    
    async restart() { await this.stop(); setTimeout(() => this.start(), 3000); }
    async kill() { if(this.process) { this.process.kill('SIGKILL'); this.status = 'OFFLINE'; this.io.emit('status_change', 'OFFLINE'); }}
    sendCommand(c) { if(this.process) this.process.stdin.write(c + '\n'); }
    
    // --- NUEVO: WHITELIST MANAGER ---
    getWhitelist() {
        try {
            const wlPath = path.join(this.serverPath, 'whitelist.json');
            if (!fs.existsSync(wlPath)) return [];
            return JSON.parse(fs.readFileSync(wlPath, 'utf8'));
        } catch { return []; }
    }

    updateWhitelist(action, name) {
        const wlPath = path.join(this.serverPath, 'whitelist.json');
        let wl = [];
        try { if(fs.existsSync(wlPath)) wl = JSON.parse(fs.readFileSync(wlPath, 'utf8')); } catch {}

        if (action === 'add') {
            if (!wl.find(u => u.name?.toLowerCase() === name.toLowerCase())) {
                // uuid falso generado para modo offline/cracked si es necesario
                const uuid = '00000000-0000-0000-0000-' + Math.random().toString(16).substr(2, 12); 
                wl.push({ uuid, name });
                if(this.status === 'ONLINE') this.sendCommand(`whitelist add ${name}`);
            }
        } else if (action === 'remove') {
            wl = wl.filter(u => u.name?.toLowerCase() !== name.toLowerCase());
            if(this.status === 'ONLINE') this.sendCommand(`whitelist remove ${name}`);
        }
        
        fs.writeFileSync(wlPath, JSON.stringify(wl, null, 2));
        if(this.status === 'ONLINE') this.sendCommand('whitelist reload');
        return wl;
    }

    async installJar(url, filename) {
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
        if (!safeFilename) throw new Error('Invalid filename');

        this.io.emit('toast', {type:'info', msg:'Descargando núcleo...'}); this.log(`\r\nDescargando: ${url}\r\n`);
        fs.readdirSync(this.serverPath).forEach(f => { if(f.endsWith('.jar')) fs.unlinkSync(path.join(this.serverPath, f)); });
        
        const target = path.join(this.serverPath, safeFilename);
        const cmd = `wget -q -O "${target}" "${url}"`;
        
        return new Promise((resolve, reject) => { 
            exec(cmd, (error) => { 
                if (error) { this.io.emit('toast', {type:'error', msg:'Error al descargar'}); reject(error); } 
                else { this.io.emit('toast', {type:'success', msg:'Instalado correctamente'}); resolve(); } 
            }); 
        });
    }
    
    readProperties() { try{return fs.readFileSync(path.join(this.serverPath,'server.properties'),'utf8').split('\n').reduce((a,l)=>{const[k,v]=l.split('=');if(k&&!l.startsWith('#'))a[k.trim()]=v?v.trim():'';return a;},{});}catch{return{};} }
    writeProperties(p) { fs.writeFileSync(path.join(this.serverPath,'server.properties'), '#Gen by Aether Panel\n'+Object.entries(p).map(([k,v])=>`${k}=${v}`).join('\n')); }
}
module.exports = MCManager;
