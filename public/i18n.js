// ===== INTERNATIONALIZATION SYSTEM =====
const translations = {
    es: {
        // Navigation
        'nav.section.core': 'Core',
        'nav.section.system': 'Sistema',
        'nav.monitor': 'Monitor',
        'nav.console': 'Consola',
        'nav.cores': 'Núcleos',
        'nav.whitelist': 'Whitelist',
        'nav.files': 'Archivos',
        'nav.labs': 'Labs',
        'nav.settings': 'Ajustes',

        // Buttons
        'button.start': 'INICIAR',
        'button.stop': 'DETENER',
        'button.restart': 'REINICIAR',
        'button.kill': 'KILL',
        'button.customize': 'Personalizar',
        'button.logout': 'Salir',
        'button.save': 'Guardar Cambios',
        'button.create': 'Crear',
        'button.cancel': 'Cancelar',
        'button.confirm': 'Confirmar',

        // Login
        'login.title': 'AETHER PANEL',
        'login.subtitle': 'Acceso Administrativo',
        'login.username': 'Usuario',
        'login.password': 'Contraseña',
        'login.enter': 'ENTRAR',
        'login.setup.title': 'CONFIGURACIÓN INICIAL',
        'login.setup.subtitle': 'Crea tu cuenta de administrador',

        // Dashboard
        'dashboard.title': 'Panel de Control',
        'dashboard.server.ip': 'IP del Servidor',
        'dashboard.power.control': 'Control de Energía',
        'dashboard.cpu': 'CPU',
        'dashboard.ram': 'RAM',
        'dashboard.disk': 'Disco',

        // Settings
        'settings.appearance': 'APARIENCIA',
        'settings.theme': 'Tema',
        'settings.design': 'Diseño',
        'settings.accent': 'Acento',
        'settings.language': 'Idioma',
        'settings.theme.light': 'Claro',
        'settings.theme.dark': 'Oscuro',
        'settings.theme.auto': 'Auto',
        'settings.design.glass': 'Glass',
        'settings.design.flat': 'Flat',
        'settings.reset': 'Reset',
        'settings.personalization': 'Personalización',
        'settings.accessibility': 'Accesibilidad',
        'settings.high_contrast': 'Alto Contraste',
        'settings.update.system': 'Actualizar Sistema',
        'settings.update.ui': 'Actualizar UI',
        'settings.background': 'Fondo Personalizado',
        'settings.upload': 'Subir',
        'settings.remove': 'Quitar',
        'settings.solid_color': 'Fondo Color Sólido',
        'settings.apply': 'Aplicar',
        'settings.adaptive_theme': 'Generar tema adaptativo',
        'settings.glass.blur': 'Intensidad Glass',

        // Command Palette
        'cmd.palette.placeholder': 'Escribe un comando...',
        'cmd.palette.title': 'Paleta de Comandos',
        'cmd.palette.hint': 'Presiona Alt+Space para abrir',
        'cmd.start': 'Iniciar Servidor',
        'cmd.stop': 'Detener Servidor',
        'cmd.restart': 'Reiniciar Servidor',
        'cmd.kill': 'Forzar Apagado',
        'cmd.console': 'Abrir Consola',
        'cmd.files': 'Gestor de Archivos',
        'cmd.backups': 'Ver Backups',
        'cmd.settings': 'Configuración',
        'cmd.theme.toggle': 'Cambiar Tema',
        'cmd.language': 'Cambiar Idioma',

        // Labs
        'labs.title': 'Aether Labs',
        'labs.file.manager': 'Gestor de Archivos',
        'labs.file.manager.desc': 'Explorador avanzado.',
        'labs.backups': 'Backups',
        'labs.backups.desc': 'Copias de seguridad.',
        'labs.plugins': 'Gestor de Plugins',
        'labs.plugins.desc': 'Instala y gestiona plugins.',
        'labs.scheduler': 'Programador',
        'labs.scheduler.desc': 'Tareas automáticas.',
        'labs.performance': 'Monitor de Rendimiento',
        'labs.performance.desc': 'Gráficos en tiempo real.',
        'labs.whitelist': 'Whitelist',
        'labs.whitelist.desc': 'Gestiona jugadores.',
        'labs.logs': 'Visor de Logs',
        'labs.logs.desc': 'Análisis de registros.',
        'labs.rcon': 'Consola RCON',
        'labs.rcon.desc': 'Acceso remoto.',
        'rcon.placeholder': 'Enviar comando RCON...',
        'rcon.send': 'Enviar',
        'labs.worlds': 'Gestor de Mundos',
        'labs.worlds.desc': 'Administra mundos.',
        'labs.tag.alpha': 'ALPHA',
        'labs.tag.beta': 'BETA',
        'labs.tag.new': 'NUEVO',
        'labs.tag.wip': 'WIP',
        'labs.button.open': 'Abrir',

        // Account
        'account.settings': 'Configuración de Cuenta',
        'account.username': 'Nombre de Usuario',
        'account.password': 'Contraseña',
        'account.change.password': 'Cambiar Contraseña',
        'account.change.username': 'Cambiar Nombre',
        'account.new.password': 'Nueva Contraseña',
        'account.confirm.password': 'Confirmar Contraseña',
        'account.users': 'Gestión de Usuarios',
        'account.createuser': 'Crear Usuario',
        'account.role': 'Rol',
        'account.permissions': 'Permisos',
        'account.role.admin': 'Administrador',
        'account.role.user': 'Usuario',

        // Permissions
        'perm.start': 'Iniciar Servidor',
        'perm.stop': 'Detener Servidor',
        'perm.restart': 'Reiniciar Servidor',
        'perm.kill': 'Forzar Apagado',
        'perm.console': 'Consola',
        'perm.files': 'Gestor de Archivos',
        'perm.config': 'Configuración',
        'perm.backups': 'Backups',
        'perm.scheduler': 'Programador',
        'perm.logs': 'Visor de Logs',

        // Power Buttons
        'power.start': 'INICIAR',
        'power.stop': 'DETENER',
        'power.restart': 'REINICIAR',
        'power.kill': 'KILL',
        'power.control': 'Control de Energía',

        // Cores/Versions
        'cores.title': 'Selector de Núcleo',
        'cores.all': 'Todos',
        'cores.plugins': 'Plugins',
        'cores.mods': 'Mods',
        'cores.vanilla': 'Vanilla',
        'cores.vanilla.desc': 'Oficial de Mojang.',
        'cores.snapshot': 'Snapshot',
        'cores.snapshot.desc': 'Versiones experimentales.',
        'cores.paper': 'Paper',
        'cores.paper.desc': 'Alto rendimiento.',
        'cores.spigot': 'Spigot',
        'cores.spigot.desc': 'API Original de Plugins.',
        'cores.purpur': 'Purpur',
        'cores.purpur.desc': 'Rendimiento extremo.',
        'cores.fabric': 'Fabric',
        'cores.fabric.desc': 'Modular y ligero.',
        'cores.forge': 'Forge',
        'cores.forge.desc': 'Mods clásicos.',
        'cores.neoforge': 'NeoForge',
        'cores.neoforge.desc': 'Fork Moderno.',
        'cores.select': 'Seleccionar',
        'cores.wip': 'WIP',
        'cores.msg.snapshot': '¡Función Snapshot pronto!',
        'cores.msg.spigot': 'Por ahora usa Paper. Soporte Spigot pronto.',
        'cores.msg.purpur': '¡Soporte Purpur pronto!',
        'cores.msg.neoforge': '¡Soporte NeoForge pronto!',

        // Whitelist
        'whitelist.title': 'Gestión de Whitelist',
        'whitelist.enabled': 'Activada',
        'whitelist.player': 'Nombre del jugador',
        'whitelist.add': 'Agregar',
        'whitelist.players': 'Jugadores Permitidos',
        'whitelist.empty': 'No hay jugadores en la whitelist',

        // Files
        'files.title': 'Administrador de Archivos',
        'files.upload': 'Subir',
        'files.refresh': 'Actualizar',

        // Backups
        'backups.title': 'Copias de Seguridad',
        'backups.create': 'Crear Backup',
        'backups.name_optional': 'Nombre (Opcional)',

        // Status
        'status.online': 'ONLINE',
        'status.offline': 'OFFLINE',
        'status.starting': 'INICIANDO',
        'status.stopping': 'DETENIENDO',

        // Messages
        'msg.copied': '¡Copiado!',
        'msg.saved': 'Guardado correctamente',
        'msg.error': 'Error',
        'msg.success': 'Éxito',

        // Integrations
        'integrations.title': 'Integraciones',
        'integrations.discord.title': 'Discord Webhooks',
        'integrations.discord.desc': 'Envía notificaciones del estado del servidor a un canal de Discord.',
        'integrations.webhook.url': 'URL del Webhook',
        'integrations.events': 'Eventos',
        'integrations.event.start': 'Iniciar Servidor',
        'integrations.event.stop': 'Detener Servidor',
        'integrations.event.join': 'Jugador Conectado',

        // Plugin Manager
        'plugins.title': 'Gestor de Plugins',
        'plugins.upload': 'Subir Plugin (.jar)',
        'plugins.list': 'Plugins Instalados',
        'plugins.no_plugins': 'No se encontraron plugins',
        'plugins.delete.confirm': '¿Eliminar plugin?',
        'plugins.installed': 'Instalados',
        'plugins.store': 'Tienda',
        'plugins.search.placeholder': 'Buscar en Modrinth...',
        'plugins.search_bar': 'Buscar plugins...',
        'plugins.cat.all': 'Todos',
        'plugins.cat.admin': 'Admin',
        'plugins.cat.mech': 'Mecánicas',
        'plugins.cat.world': 'Mundo',

        // World Manager
        'worlds.title': 'Gestor de Mundos',
        'worlds.current': 'Mundo Actual',
        'worlds.list': 'Mundos Disponibles',
        'worlds.activate': 'Activar',
        'worlds.create': 'Generar Nuevo',
        'worlds.import': 'Importar',
        'worlds.delete': 'Eliminar',
        'worlds.active': 'ACTIVO',

        // Performance
        'perf.title': 'Monitor de Rendimiento',
        'perf.uptime': 'Tiempo de Actividad',
        'perf.node': 'Versión de Node',
        'perf.os': 'Sistema Operativo',
        'perf.cores': 'Núcleos CPU',
        'perf.advanced_monitor': 'Monitor Avanzado',
        'perf.active_processes': 'Procesos Activos',
        'perf.pid': 'PID',
        'perf.user': 'Usuario',
        'perf.command': 'Comando',

        // Scheduler
        'scheduler.task.frequency': 'Frecuencia',
        'scheduler.task.action': 'Acción',
        'scheduler.task.command': 'Comando/Mensaje',
        'scheduler.freq.daily': 'Diario (Medianoche)',
        'scheduler.freq.weekly': 'Semanal (Domingo)',
        'scheduler.freq.hourly': 'Cada Hora',
        'scheduler.freq.every30m': 'Cada 30 Minutos',
        'scheduler.freq.every6h': 'Cada 6 Horas',
        'scheduler.freq.every12h': 'Cada 12 Horas',
        'scheduler.freq.custom': 'Personalizado (Cron)',
        'scheduler.act.command': 'Ejecutar Comando',
        'scheduler.act.restart': 'Reiniciar Servidor',
        'scheduler.act.stop': 'Detener Servidor',
        'scheduler.act.start': 'Iniciar Servidor',
        'scheduler.act.backup': 'Crear Backup',
        'scheduler.act.prune': 'Borrar Backups Antiguos (>7 días)',
        'scheduler.act.say': 'Difundir Mensaje',
        'scheduler.new_task': 'Nueva Tarea',
        'scheduler.task_name': 'Nombre de la Tarea',
        'scheduler.cron_expression': 'Expresión Cron',
    },

    en: {
        // Navigation
        'nav.section.core': 'Core',
        'nav.section.system': 'System',
        'nav.monitor': 'Monitor',
        'nav.console': 'Console',
        'nav.cores': 'Cores',
        'nav.whitelist': 'Whitelist',
        'nav.files': 'Files',
        'nav.labs': 'Labs',
        'nav.settings': 'Settings',
        'nav.users': 'Users',

        // Buttons
        'button.start': 'START',
        'button.stop': 'STOP',
        'button.restart': 'RESTART',
        'button.kill': 'KILL',
        'button.customize': 'Customize',
        'button.logout': 'Logout',
        'button.save': 'Save Changes',
        'button.create': 'Create',
        'button.cancel': 'Cancel',
        'button.confirm': 'Confirm',

        // Login
        'login.title': 'AETHER PANEL',
        'login.subtitle': 'Admin Access',
        'login.username': 'Username',
        'login.password': 'Password',
        'login.enter': 'ENTER',
        'login.setup.title': 'INITIAL SETUP',
        'login.setup.subtitle': 'Create your admin account',

        // Dashboard
        'dashboard.title': 'Control Panel',
        'dashboard.server.ip': 'Server IP',
        'dashboard.power.control': 'Power Control',
        'dashboard.cpu': 'CPU',
        'dashboard.ram': 'RAM',
        'dashboard.disk': 'Disk',

        // Settings
        'settings.appearance': 'APPEARANCE',
        'settings.theme': 'Theme',
        'settings.design': 'Design',
        'settings.accent': 'Accent',
        'settings.language': 'Language',
        'settings.theme.light': 'Light',
        'settings.theme.dark': 'Dark',
        'settings.theme.auto': 'Auto',
        'settings.design.glass': 'Glass',
        'settings.design.flat': 'Flat',
        'settings.reset': 'Reset',
        'settings.personalization': 'Personalization',
        'settings.accessibility': 'Accessibility',
        'settings.high_contrast': 'High Contrast',
        'settings.update.system': 'Update System',
        'settings.update.ui': 'Update UI',
        'settings.background': 'Custom Background',
        'settings.upload': 'Upload',
        'settings.remove': 'Remove',
        'settings.solid_color': 'Solid Color Background',
        'settings.apply': 'Apply',
        'settings.adaptive_theme': 'Generate adaptive theme',
        'settings.glass.blur': 'Glass Intensity',

        // Command Palette
        'cmd.palette.placeholder': 'Type a command...',
        'cmd.palette.title': 'Command Palette',
        'cmd.palette.hint': 'Press Alt+Space to open',
        'cmd.start': 'Start Server',
        'cmd.stop': 'Stop Server',
        'cmd.restart': 'Restart Server',
        'cmd.kill': 'Force Shutdown',
        'cmd.console': 'Open Console',
        'cmd.files': 'File Manager',
        'cmd.backups': 'View Backups',
        'cmd.settings': 'Settings',
        'cmd.theme.toggle': 'Toggle Theme',
        'cmd.language': 'Change Language',

        // Labs
        'labs.title': 'Aether Labs',
        'labs.file.manager': 'File Manager',
        'labs.file.manager.desc': 'Advanced explorer.',
        'labs.backups': 'Backups',
        'labs.backups.desc': 'Security copies.',
        'labs.plugins': 'Plugin Manager',
        'labs.plugins.desc': 'Install and manage plugins.',
        'labs.scheduler': 'Scheduler',
        'labs.scheduler.desc': 'Automatic tasks.',
        'labs.performance': 'Performance Monitor',
        'labs.performance.desc': 'Real-time graphs.',
        'labs.whitelist': 'Whitelist',
        'labs.whitelist.desc': 'Manage players.',
        'labs.logs': 'Log Viewer',
        'labs.logs.desc': 'Log analysis.',
        'labs.rcon': 'RCON Console',
        'labs.rcon.desc': 'Remote access.',
        'rcon.placeholder': 'Send RCON command...',
        'rcon.send': 'Send',
        'labs.worlds': 'World Manager',
        'labs.worlds.desc': 'Manage worlds.',
        'labs.tag.alpha': 'ALPHA',
        'labs.tag.beta': 'BETA',
        'labs.tag.new': 'NEW',
        'labs.tag.wip': 'WIP',
        'labs.button.open': 'Open',

        // Account
        'account.settings': 'Account Settings',
        'account.username': 'Username',
        'account.password': 'Password',
        'account.change.password': 'Change Password',
        'account.change.username': 'Change Username',
        'account.new.password': 'New Password',
        'account.confirm.password': 'Confirm Password',
        'account.users': 'User Management',
        'account.createuser': 'Create User',
        'account.role': 'Role',
        'account.permissions': 'Permissions',
        'account.role.admin': 'Administrator',
        'account.role.user': 'User',

        // Permissions
        'perm.start': 'Start Server',
        'perm.stop': 'Stop Server',
        'perm.restart': 'Restart Server',
        'perm.kill': 'Force Shutdown',
        'perm.console': 'Console',
        'perm.files': 'File Manager',
        'perm.config': 'Configuration',
        'perm.backups': 'Backups',
        'perm.scheduler': 'Scheduler',
        'perm.logs': 'Log Viewer',

        // Power Buttons
        'power.start': 'START',
        'power.stop': 'STOP',
        'power.restart': 'RESTART',
        'power.kill': 'KILL',
        'power.control': 'Power Control',

        // Cores/Versions
        'cores.title': 'Core Selector',
        'cores.all': 'All',
        'cores.plugins': 'Plugins',
        'cores.mods': 'Mods',
        'cores.vanilla': 'Vanilla',
        'cores.vanilla.desc': 'Official from Mojang.',
        'cores.snapshot': 'Snapshot',
        'cores.snapshot.desc': 'Experimental versions.',
        'cores.paper': 'Paper',
        'cores.paper.desc': 'High performance.',
        'cores.spigot': 'Spigot',
        'cores.spigot.desc': 'Original Plugin API.',
        'cores.purpur': 'Purpur',
        'cores.purpur.desc': 'Extreme performance.',
        'cores.fabric': 'Fabric',
        'cores.fabric.desc': 'Modular and lightweight.',
        'cores.forge': 'Forge',
        'cores.forge.desc': 'Classic mods.',
        'cores.neoforge': 'NeoForge',
        'cores.neoforge.desc': 'Modern Fork.',
        'cores.select': 'Select',
        'cores.wip': 'WIP',
        'cores.msg.snapshot': 'Snapshot feature coming soon!',
        'cores.msg.spigot': 'For now, please use Paper. Spigot support coming.',
        'cores.msg.purpur': 'Purpur support coming soon!',
        'cores.msg.neoforge': 'NeoForge support coming soon!',

        // Whitelist
        'whitelist.title': 'Whitelist Management',
        'whitelist.enabled': 'Enabled',
        'whitelist.player': 'Player name',
        'whitelist.add': 'Add',
        'whitelist.players': 'Allowed Players',
        'whitelist.empty': 'No players in whitelist',

        // Files
        'files.title': 'File Manager',
        'files.upload': 'Upload',
        'files.refresh': 'Refresh',

        // Backups
        'backups.title': 'Backups',
        'backups.create': 'Create Backup',
        'backups.name_optional': 'Name (Optional)',

        // Status
        'status.online': 'ONLINE',
        'status.offline': 'OFFLINE',
        'status.starting': 'STARTING',
        'status.stopping': 'STOPPING',

        // Messages
        'msg.copied': 'Copied!',
        'msg.saved': 'Saved successfully',
        'msg.error': 'Error',
        'msg.success': 'Success',

        // Integrations
        'integrations.title': 'Integrations',
        'integrations.discord.title': 'Discord Webhooks',
        'integrations.discord.desc': 'Send server status notifications to a Discord channel.',
        'integrations.webhook.url': 'Webhook URL',
        'integrations.events': 'Events',
        'integrations.event.start': 'Server Start',
        'integrations.event.stop': 'Server Stop',
        'integrations.event.join': 'Player Join',

        // Plugin Manager
        'plugins.title': 'Plugin Manager',
        'plugins.upload': 'Upload Plugin (.jar)',
        'plugins.list': 'Installed Plugins',
        'plugins.no_plugins': 'No plugins found',
        'plugins.delete.confirm': 'Delete plugin?',
        'plugins.installed': 'Installed',
        'plugins.store': 'Store',
        'plugins.search.placeholder': 'Search Modrinth...',
        'plugins.search_bar': 'Search plugins...',
        'plugins.cat.all': 'All',
        'plugins.cat.admin': 'Admin',
        'plugins.cat.mech': 'Mechanics',
        'plugins.cat.world': 'World',

        // World Manager
        'worlds.title': 'World Manager',
        'worlds.current': 'Current World',
        'worlds.list': 'Available Worlds',
        'worlds.activate': 'Activate',
        'worlds.create': 'Generate New',
        'worlds.import': 'Import',
        'worlds.delete': 'Delete',
        'worlds.active': 'ACTIVE',

        // Performance
        'perf.title': 'Performance Monitor',
        'perf.uptime': 'Uptime',
        'perf.node': 'Node Version',
        'perf.os': 'Operating System',
        'perf.cores': 'CPU Cores',
        'perf.advanced_monitor': 'Advanced Monitor',
        'perf.active_processes': 'Active Processes',
        'perf.pid': 'PID',
        'perf.user': 'User',
        'perf.command': 'Command',
    },

    pt: {
        // Navigation
        'nav.section.core': 'Core',
        'nav.section.system': 'Sistema',
        'nav.monitor': 'Monitor',
        'nav.console': 'Console',
        'nav.cores': 'Núcleos',
        'nav.whitelist': 'Whitelist',
        'nav.files': 'Arquivos',
        'nav.labs': 'Labs',
        'nav.settings': 'Configurações',

        // Buttons
        'button.start': 'INICIAR',
        'button.stop': 'PARAR',
        'button.restart': 'REINICIAR',
        'button.kill': 'KILL',
        'button.customize': 'Personalizar',
        'button.logout': 'Sair',
        'button.save': 'Salvar Alterações',
        'button.create': 'Criar',
        'button.cancel': 'Cancelar',
        'button.confirm': 'Confirmar',

        // Login
        'login.title': 'AETHER PANEL',
        'login.subtitle': 'Acesso Administrativo',
        'login.username': 'Usuário',
        'login.password': 'Senha',
        'login.enter': 'ENTRAR',
        'login.setup.title': 'CONFIGURAÇÃO INICIAL',
        'login.setup.subtitle': 'Crie sua conta de administrador',

        // Dashboard
        'dashboard.title': 'Painel de Controle',
        'dashboard.server.ip': 'IP do Servidor',
        'dashboard.power.control': 'Controle de Energia',
        'dashboard.cpu': 'CPU',
        'dashboard.ram': 'RAM',
        'dashboard.disk': 'Disco',

        // Settings
        'settings.appearance': 'APARÊNCIA',
        'settings.theme': 'Tema',
        'settings.design': 'Design',
        'settings.accent': 'Acento',
        'settings.language': 'Idioma',
        'settings.theme.light': 'Claro',
        'settings.theme.dark': 'Escuro',
        'settings.theme.auto': 'Auto',
        'settings.design.glass': 'Glass',
        'settings.design.flat': 'Flat',
        'settings.reset': 'Reset',
        'settings.personalization': 'Personalização',
        'settings.accessibility': 'Acessibilidade',
        'settings.high_contrast': 'Alto Contraste',
        'settings.update.system': 'Atualizar Sistema',
        'settings.update.ui': 'Atualizar UI',
        'settings.background': 'Fundo Personalizado',
        'settings.upload': 'Enviar',
        'settings.remove': 'Remover',
        'settings.solid_color': 'Fundo Cor Sólida',
        'settings.apply': 'Aplicar',
        'settings.adaptive_theme': 'Gerar tema adaptativo',
        'settings.glass.blur': 'Intensidade Glass',

        // Command Palette
        'cmd.palette.placeholder': 'Digite um comando...',
        'cmd.palette.title': 'Paleta de Comandos',
        'cmd.palette.hint': 'Pressione Alt+Space para abrir',
        'cmd.start': 'Iniciar Servidor',
        'cmd.stop': 'Parar Servidor',
        'cmd.restart': 'Reiniciar Servidor',
        'cmd.kill': 'Forçar Desligamento',
        'cmd.console': 'Abrir Console',
        'cmd.files': 'Gerenciador de Arquivos',
        'cmd.backups': 'Ver Backups',
        'cmd.settings': 'Configurações',
        'cmd.theme.toggle': 'Alternar Tema',
        'cmd.language': 'Mudar Idioma',

        // Labs
        'labs.title': 'Aether Labs',
        'labs.file.manager': 'Gerenciador de Arquivos',
        'labs.file.manager.desc': 'Explorador avançado.',
        'labs.backups': 'Backups',
        'labs.backups.desc': 'Cópias de segurança.',
        'labs.plugins': 'Gerenciador de Plugins',
        'labs.plugins.desc': 'Instale e gerencie plugins.',
        'labs.scheduler': 'Agendador',
        'labs.scheduler.desc': 'Tarefas automáticas.',
        'labs.performance': 'Monitor de Desempenho',
        'labs.performance.desc': 'Gráficos em tempo real.',
        'labs.whitelist': 'Whitelist',
        'labs.whitelist.desc': 'Gerencie jogadores.',
        'labs.logs': 'Visualizador de Logs',
        'labs.logs.desc': 'Análise de registros.',
        'labs.rcon': 'Console RCON',
        'labs.rcon.desc': 'Acesso remoto.',
        'labs.worlds': 'Gerenciador de Mundos',
        'labs.worlds.desc': 'Administre mundos.',
        'labs.tag.alpha': 'ALPHA',
        'labs.tag.beta': 'BETA',
        'labs.tag.new': 'NOVO',
        'labs.tag.wip': 'WIP',
        'labs.button.open': 'Abrir',

        // Account
        'account.settings': 'Configurações da Conta',
        'account.username': 'Nome de Usuário',
        'account.password': 'Senha',
        'account.change.password': 'Mudar Senha',
        'account.change.username': 'Mudar Nome',
        'account.new.password': 'Nova Senha',
        'account.confirm.password': 'Confirmar Senha',
        'account.users': 'Gestão de Usuários',
        'account.createuser': 'Criar Usuário',
        'account.role': 'Função',
        'account.permissions': 'Permissões',
        'account.role.admin': 'Administrador',
        'account.role.user': 'Usuário',

        // Permissions
        'perm.start': 'Iniciar Servidor',
        'perm.stop': 'Parar Servidor',
        'perm.restart': 'Reiniciar Servidor',
        'perm.kill': 'Forçar Desligamento',
        'perm.console': 'Console',
        'perm.files': 'Gestor de Arquivos',
        'perm.config': 'Configuração',
        'perm.backups': 'Backups',
        'perm.scheduler': 'Programador',
        'perm.logs': 'Visor de Logs',

        // Power Buttons
        'power.start': 'INICIAR',
        'power.stop': 'PARAR',
        'power.restart': 'REINICIAR',
        'power.kill': 'KILL',
        'power.control': 'Controle de Energia',

        // Cores/Versions
        'cores.title': 'Seletor de Núcleo',
        'cores.vanilla': 'Vanilla',
        'cores.vanilla.desc': 'Oficial da Mojang.',
        'cores.snapshot': 'Snapshot',
        'cores.snapshot.desc': 'Versões experimentais.',
        'cores.paper': 'Paper',
        'cores.paper.desc': 'Alto desempenho.',
        'cores.spigot': 'Spigot',
        'cores.spigot.desc': 'API Original de Plugins.',
        'cores.purpur': 'Purpur',
        'cores.purpur.desc': 'Desempenho extremo.',
        'cores.fabric': 'Fabric',
        'cores.fabric.desc': 'Modular e leve.',
        'cores.forge': 'Forge',
        'cores.forge.desc': 'Mods clássicos.',
        'cores.neoforge': 'NeoForge',
        'cores.neoforge.desc': 'Fork moderno.',
        'cores.select': 'Selecionar',
        'cores.wip': 'WIP',
        'cores.msg.snapshot': 'Recurso Snapshot em breve!',
        'cores.msg.spigot': 'Por enquanto use Paper. Suporte Spigot em breve.',
        'cores.msg.purpur': 'Suporte Purpur em breve!',
        'cores.msg.neoforge': 'Suporte NeoForge em breve!',

        // Whitelist
        'whitelist.title': 'Gestão de Whitelist',
        'whitelist.enabled': 'Ativada',
        'whitelist.player': 'Nome do jogador',
        'whitelist.add': 'Adicionar',
        'whitelist.players': 'Jogadores Permitidos',
        'whitelist.empty': 'Nenhum jogador na whitelist',

        // Files
        'files.title': 'Gerenciador de Arquivos',
        'files.upload': 'Upload',
        'files.refresh': 'Atualizar',

        // Backups
        'backups.title': 'Backups',
        'backups.create': 'Criar Backup',

        // Status
        'status.online': 'ONLINE',
        'status.offline': 'OFFLINE',
        'status.starting': 'INICIANDO',
        'status.stopping': 'PARANDO',

        // Messages
        'msg.copied': 'Copiado!',
        'msg.saved': 'Salvo com sucesso',
        'msg.error': 'Erro',
        'msg.success': 'Sucesso',

        // Integrations
        'integrations.title': 'Integrações',
        'integrations.discord.title': 'Discord Webhooks',
        'integrations.discord.desc': 'Enviar notificações de status para o Discord.',
        'integrations.webhook.url': 'URL do Webhook',
        'integrations.events': 'Eventos',
        'integrations.event.start': 'Iniciar Servidor',
        'integrations.event.stop': 'Parar Servidor',
        'integrations.event.join': 'Entrada de Jogador',

        // Plugin Manager
        'plugins.title': 'Gerenciador de Plugins',
        'plugins.upload': 'Enviar Plugin (.jar)',
        'plugins.list': 'Plugins Instalados',
        'plugins.no_plugins': 'Nenhum plugin encontrado',
        'plugins.delete.confirm': 'Excluir plugin?',
        'plugins.installed': 'Instalados',
        'plugins.store': 'Loja',
        'plugins.search.placeholder': 'Pesquisar Modrinth...',

        // World Manager
        'worlds.title': 'Gerenciador de Mundos',
        'worlds.current': 'Mundo Atual',
        'worlds.list': 'Mundos Disponíveis',
        'worlds.activate': 'Ativar',
        'worlds.create': 'Gerar Novo',
        'worlds.delete': 'Excluir',
        'worlds.active': 'ATIVO',

        // Performance
        'perf.title': 'Monitor de Desempenho',
        'perf.uptime': 'Tempo de Atividade',
        'perf.node': 'Versão Node',
        'perf.os': 'Sistema Operacional',
        'perf.cores': 'Núcleos de CPU',
    }
};

// Current language (default to English)
let currentLanguage = localStorage.getItem('language') || 'en';
if (!translations[currentLanguage]) currentLanguage = 'en';

// Translation function
function t(key) {
    return translations[currentLanguage][key] || key;
}

// Set language and update UI
function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    translatePage();

    // Update language selector active state
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.langBtn === lang);
    });

    Toastify({
        text: t('msg.success'),
        style: { background: '#10b981' }
    }).showToast();
}

// Translate all elements with data-i18n attribute
function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const translation = t(key);

        if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
            el.placeholder = translation;
        } else {
            // Preserve icons
            const icon = el.querySelector('i');
            if (icon) {
                el.innerHTML = translation + ' ' + icon.outerHTML;
            } else {
                el.textContent = translation;
            }
        }
    });

    // Handle data-i18n-placeholder attributes separately
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const translation = t(key);
        if (el.placeholder !== undefined) {
            el.placeholder = translation;
        }
    });
}

// Auto-translate on load
document.addEventListener('DOMContentLoaded', () => {
    translatePage();
});
