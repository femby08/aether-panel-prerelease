const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MCManager {
    constructor(io) {
        this.io = io;
        this.process = null;
        this.status = 'OFFLINE';
        // Asegura que esta ruta es donde metiste el server.jar
        this.serverDir = path.join(__dirname, 'servers', 'default');
        
        if (!fs.existsSync(this.serverDir)) {
            fs.mkdirSync(this.serverDir, { recursive: true });
        }
    }

    getStatus() { return { status: this.status }; }
    getRecentLogs() { return ">>> Consola lista.\r\n"; }

    async start() {
        if (this.status !== 'OFFLINE') return;

        this.status = 'STARTING';
        this.io.emit('status_change', 'STARTING');
        this.io.emit('console_data', '\r\n\x1b[33m>>> Iniciando servidor...\x1b[0m\r\n');

        // EULA
        const eula = path.join(this.serverDir, 'eula.txt');
        if (!fs.existsSync(eula) || !fs.readFileSync(eula, 'utf8').includes('true')) {
            fs.writeFileSync(eula, 'eula=true');
            this.io.emit('console_data', '>>> EULA aceptado.\r\n');
        }

        // JAR
        const files = fs.readdirSync(this.serverDir);
        const jar = files.find(f => f.endsWith('.jar') && !f.includes('installer'));
        
        if (!jar) {
            this.io.emit('console_data', '\x1b[31m❌ Error: No hay archivo .jar en servers/default\x1b[0m\r\n');
            this.status = 'OFFLINE';
            this.io.emit('status_change', 'OFFLINE');
            return;
        }

        // START JAVA
        const args = ['-Xmx2G', '-Xms2G', '-jar', jar, 'nogui'];
        this.process = spawn('java', args, { cwd: this.serverDir });

        this.process.stdout.on('data', d => {
            const s = d.toString();
            this.io.emit('console_data', s);
            if (s.includes('Done') || s.includes('Listening')) {
                this.status = 'ONLINE';
                this.io.emit('status_change', 'ONLINE');
            }
        });

        this.process.stderr.on('data', d => this.io.emit('console_data', `\x1b[31m${d}\x1b[0m`));
        this.process.on('close', () => {
            this.status = 'OFFLINE';
            this.process = null;
            this.io.emit('status_change', 'OFFLINE');
            this.io.emit('console_data', '\r\n>>> Servidor detenido.\r\n');
        });
    }

    async stop() {
        if (this.process) {
            this.process.stdin.write('stop\n');
            this.status = 'STOPPING';
            this.io.emit('status_change', 'STOPPING');
        }
    }

    async kill() {
        if (this.process) {
            this.process.kill('SIGKILL');
            this.status = 'OFFLINE';
            this.io.emit('status_change', 'OFFLINE');
        }
    }
    
    async restart() { await this.stop(); setTimeout(() => this.start(), 5000); }
    sendCommand(c) { if (this.process) this.process.stdin.write(c + '\n'); }
    
    readProperties() { return {}; } // Simplificado para que no falle si no hay archivo
    writeProperties() {} 
    async installJar() {}
}

module.exports = MCManager;
