const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

class MCManager {
    constructor(io) {
        this.io = io;
        this.process = null;
        this.serverPath = path.join(__dirname, 'servers', 'default');
        this.settingsPath = path.join(__dirname, 'settings.json');
        
        if (!fs.existsSync(this.serverPath)) fs.mkdirSync(this.serverPath, { recursive: true });
        
        this.status = 'OFFLINE';
        this.logs = [];
        this.loadSettings(); 
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
                this.ram = settings.ram || '4G';
            } else {
                this.ram = '4G';
            }
        } catch (e) {
            this.ram = '4G';
        }
    }

    log(msg) { 
        this.logs.push(msg); 
        if(this.logs.length > 2000) this.logs.shift(); 
        this.io.emit('console_data', msg); 
    }

    getStatus() { return { status: this.status, ram: this.ram }; }
    getRecentLogs() { return this.logs.join(''); }
    
    async start() {
        if (this.status !== 'OFFLINE') return;
        
        this.loadSettings();

        const eula = path.join(this.serverPath, 'eula.txt');
        if(!fs.existsSync(eula) || !fs.readFileSync(eula, 'utf8').includes('true')) fs.writeFileSync(eula, 'eula=true');
        
        let jar = fs.readdirSync(this.serverPath).find(f => f.endsWith('.jar') && !f.includes('installer'));
        if (!jar) jar = fs.readdirSync(this.serverPath).find(f => f.includes('forge') && f.endsWith('.jar'));
        
        if (!jar) { 
            this.io.emit('toast', { type: 'error', msg: 'No JAR found' }); 
            return; 
        }
        
        this.status = 'STARTING'; 
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
                    if(this.status === 'OFFLINE' || c > 20) {
                        clearInterval(i);
                        r();
                    }
                }, 500);
            }); 
        }
    }

    async restart() { await this.stop(); setTimeout(() => this.start(), 3000); }
    
    async kill() { 
        if(this.process) { 
            this.process.kill('SIGKILL'); 
            this.status = 'OFFLINE'; 
            this.io.emit('status_change', 'OFFLINE'); 
        }
    }
    
    sendCommand(c) { if(this.process) this.process.stdin.write(c+'\n'); }
    
    async installJar(url, filename) {
        this.io.emit('toast', {type:'info', msg:'Descargando núcleo...'}); 
        this.log(`\r\nDescargando: ${url}\r\n`);
        
        try {
            // Limpiar jars antiguos
            const files = fs.readdirSync(this.serverPath);
            for (const f of files) {
                if(f.endsWith('.jar')) fs.unlinkSync(path.join(this.serverPath, f));
            }

            const target = path.join(this.serverPath, filename);
            const response = await axios({ url, method: 'GET', responseType: 'stream' });
            await pipeline(response.data, fs.createWriteStream(target));
            
            this.io.emit('toast', {type:'success', msg:'Instalado correctamente'});
            this.log('\r\n>>> INSTALACIÓN COMPLETADA. PUEDES INICIAR EL SERVIDOR.\r\n');
        } catch (error) {
            this.io.emit('toast', {type:'error', msg:'Error en la descarga'});
            this.log(`Error descarga: ${error.message}`);
            throw error;
        }
    }
    
    // --- LECTURA ROBUSTA DE PROPIEDADES (CORREGIDO) ---
    readProperties() { 
        try {
            const content = fs.readFileSync(path.join(this.serverPath, 'server.properties'), 'utf8');
            return content.split('\n').reduce((acc, line) => {
                if (!line || line.trim().startsWith('#')) return acc;
                
                // Dividir solo en el primer '=' para no romper valores con '='
                const parts = line.split('=');
                const key = parts.shift().trim();
                const value = parts.join('=').trim();
                
                if (key) acc[key] = value;
                return acc;
            }, {});
        } catch (e) {
            return {};
        } 
    }

    writeProperties(p) { 
        const content = '#Gen by Aether Panel\n' + Object.entries(p).map(([k,v]) => `${k}=${v}`).join('\n');
        fs.writeFileSync(path.join(this.serverPath, 'server.properties'), content); 
    }
}

module.exports = MCManager;