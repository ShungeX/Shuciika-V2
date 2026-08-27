
const token = process.env.TOKEN_BOT;

// Estado en memoria local de las configuraciones
let configState = {
    global: {
        _id: "global",
        prefix: "s!",
        version: "1.5.0 ✨",
        versionEco: "0.1",
        versionSV: "0.1",
        versionRol: "0.1",
        versionPETS: "0.1",
        token: null
    },
    rol: {
        _id: "rol",
        maxEnergy: 140,
        regeneracionMinutos: 10
    },
    staff: {
        _id: "staff",
        Director: [],
        Subdirector: [],
        Administradores: [],
        Vigilantes: [],
        Ayudantes: []
    }
};

/**
 * Carga las 3 configuraciones de Server_db.config desde MongoDB a la memoria local.
 * Se debe llamar en el arranque del bot/servidor (en bot.js y Server.js).
 */
async function cargarConfiguracionDesdeDB(dbClient) {
    if (!dbClient) return;
    try {
        const dbServer = dbClient.db("Server_db");
        const configColl = dbServer.collection("config");

        const [globalDoc, rolDoc, staffDoc] = await Promise.all([
            configColl.findOne({ _id: "global" }),
            configColl.findOne({ _id: "rol" }),
            configColl.findOne({ _id: "staff" })
        ]);

        if (globalDoc) {
            configState.global = { ...configState.global, ...globalDoc };
        }
        if (rolDoc) {
            configState.rol = { ...configState.rol, ...rolDoc };
        }
        if (staffDoc) {
            configState.staff = { ...configState.staff, ...staffDoc };
        }

        console.log("📋 [ConfigManager] Configuraciones globales (global, rol, staff) cargadas localmente desde MongoDB.");
    } catch (error) {
        console.error("⚠️ [ConfigManager] Error al cargar configuraciones desde MongoDB, usando valores por defecto:", error.message);
    }
}

/**
 * Actualiza la configuración en memoria local en tiempo real (llamado desde el Dashboard al editar).
 */
function refrescarConfiguracionLocal(target, data) {
    if (target === "global" && data) {
        configState.global = { ...configState.global, ...data, token: null };
    } else if (target === "rol" && data) {
        configState.rol = { ...configState.rol, ...data };
    } else if (target === "staff" && data) {
        configState.staff = { ...configState.staff, ...data };
    }
    console.log(`🔄 [ConfigManager] Configuración local '${target}' actualizada en tiempo real.`);
}

// Objeto exportado con getters dinámicos para garantizar compatibilidad total
const configExport = {
    // Métodos de control
    cargarDesdeDB: cargarConfiguracionDesdeDB,
    refrescarLocal: refrescarConfiguracionLocal,

    // Documentos completos
    get global() { return configState.global; },
    get rol() { return configState.rol; },
    get staff() { return configState.staff; },

    // Getters directos de compatibilidad heredada
    get prefix() { return configState.global.prefix || "s!"; },
    get version() { return configState.global.version || "1.5.0 ✨"; },
    get versionEc() { return configState.global.versionEco || "0.1"; },
    get versionEco() { return configState.global.versionEco || "0.1"; },
    get versionSV() { return configState.global.versionSV || "0.1"; },
    get versionRol() { return configState.global.versionRol || "0.1"; },
    get versionPETS() { return configState.global.versionPETS || "0.1"; },
    get maxEnergy() { return Number(configState.rol.maxEnergy || 140); },
    get regeneracionMinutos() { return Number(configState.rol.regeneracionMinutos || 10); },
    get token() { return token; }
};

module.exports = configExport;

