const fs = require('fs');
const path = require('path');

class DialogoHooksManager {
    constructor() {
        this.hooks = new Map();
        this.dir = path.join(__dirname, '..', 'data', 'dialogos', 'funciones_evento');
        this.cargarHooks();
    }

    /**
     * Escanea y carga todos los módulos de hooks ubicados en data/dialogos/funciones_evento
     */
    cargarHooks() {
        this.hooks.clear();
        if (!fs.existsSync(this.dir)) {
            try {
                fs.mkdirSync(this.dir, { recursive: true });
            } catch (err) {
                console.error('❌ [dialogoHooks] Error creando directorio funciones_evento:', err.message);
                return;
            }
        }

        try {
            const files = fs.readdirSync(this.dir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && !f.endsWith('.bak'));
            for (const file of files) {
                try {
                    const filePath = path.join(this.dir, file);
                    delete require.cache[require.resolve(filePath)];
                    const hookMod = require(filePath);

                    // Soporta exportar un objeto de hook individual o un array de hooks
                    const hookList = Array.isArray(hookMod) ? hookMod : [hookMod];
                    for (const hook of hookList) {
                        if (hook && hook.id && typeof hook.ejecutar === 'function') {
                            this.hooks.set(String(hook.id), {
                                id: String(hook.id),
                                nombre: hook.nombre || hook.id,
                                descripcion: hook.descripcion || '',
                                archivo: file,
                                ejecutar: hook.ejecutar
                            });
                            console.log(`⚡ [dialogoHooks] Hook cargado: '${hook.id}' (${hook.nombre || file})`);
                        }
                    }
                } catch (fileErr) {
                    console.error(`⚠️ [dialogoHooks] Error cargando hook desde '${file}':`, fileErr);
                }
            }
            console.log(`⚡ [dialogoHooks] Total de hooks registrados en memoria: ${this.hooks.size}`);
        } catch (dirErr) {
            console.error('❌ [dialogoHooks] Error leyendo carpeta de hooks:', dirErr.message);
        }
    }

    /**
     * Retorna la lista pública de hooks disponibles para el dashboard (sin código ejecutable)
     */
    obtenerListaPublica() {
        return Array.from(this.hooks.values()).map(h => ({
            id: h.id,
            nombre: h.nombre,
            descripcion: h.descripcion,
            archivo: h.archivo
        }));
    }

    /**
     * Verifica si un hook existe
     */
    existe(hookId) {
        if (!hookId) return false;
        return this.hooks.has(String(hookId));
    }

    /**
     * Ejecuta un hook por su ID pasándole el contexto y las referencias necesarias
     */
    async ejecutar(hookId, payload = {}) {
        if (!this.existe(hookId)) {
            console.warn(`⚠️ [dialogoHooks] Intento de ejecutar hook inexistente: '${hookId}'`);
            return { success: false, error: `Hook '${hookId}' no registrado` };
        }

        const hook = this.hooks.get(String(hookId));
        try {
            console.log(`🚀 [dialogoHooks] Ejecutando hook '${hook.id}' (${hook.nombre}) para usuario ${payload.user?.id || payload.interaction?.user?.id || 'Desconocido'}`);
            const resultado = await hook.ejecutar(payload);
            return { success: true, resultado };
        } catch (err) {
            console.error(`❌ [dialogoHooks] Error durante la ejecución del hook '${hook.id}':`, err);
            return { success: false, error: err.message };
        }
    }
}

const singleton = new DialogoHooksManager();
module.exports = singleton;
