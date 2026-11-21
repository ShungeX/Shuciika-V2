// ─────────────────────────────────────────────────────────────────────────────
// Entorno del bot: Navi (versión de trabajo) o Shuciika (versión final).
//
// Todo lo que cambia entre las dos versiones vive AQUÍ. El resto del código
// pregunta a este módulo (entorno.esNavi, entorno.nombreComando("rol"), …) y
// nunca compara IDs de bot sueltos.
//
// Cómo se elige el entorno (en este orden):
//   1. BOT_ENTORNO=navi | shuciika en el .env
//   2. Si no está, se lee el ID del bot dentro de TOKEN_BOT (la primera parte
//      del token es el ID en base64), así que basta con cambiar el token.
//   3. Si el token no es de ninguno de los dos, se usa Navi (no dispara
//      eventos de producción) y se avisa en consola.
//
// Variables por entorno: cualquier variable del .env puede tener una versión
// con sufijo _NAVI o _SHUCIIKA, que gana sobre la normal. Así se pueden tener
// las dos configuraciones a la vez y cambiar solo BOT_ENTORNO:
//   TOKEN_BOT_NAVI=…        TOKEN_BOT_SHUCIIKA=…
//   MONGODB_URI_NAVI=…      (si no existe, se usa MONGODB_URI)
// Ver .env.example.
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();

const ENTORNOS = {
    navi: {
        nombre: "navi",
        etiqueta: "Navi (trabajo)",
        botId: "857050098831065088",
        // Navi convive con Shuciika en el mismo servidor: sus comandos llevan prefijo
        // para no confundirse (/navi-rol en vez de /rol).
        prefijoComandos: "navi-",
        // Eventos que solo debe atender la versión final (despedidas, alianzas…).
        // En Navi se omiten para no duplicar mensajes ni registros.
        esProduccion: false,
        // Mensajes que el bot publica solo, sin que nadie lo pida (noticiero del clima,
        // resumen de economía, diálogos programados…). En Navi solo se mandan a mano
        // desde el dashboard. Se puede forzar con ENVIOS_AUTOMATICOS=si|no.
        enviosAutomaticos: false,
    },
    shuciika: {
        nombre: "shuciika",
        etiqueta: "Shuciika",
        botId: "721903366837501975",
        prefijoComandos: "",
        esProduccion: true,
        enviosAutomaticos: true,
    },
};

/** Lee el ID del bot que viene dentro de un token de Discord (o null). */
function botIdDesdeToken(token) {
    if (!token || typeof token !== "string") return null;
    try {
        const id = Buffer.from(token.split(".")[0], "base64").toString("utf8");
        return /^\d{15,25}$/.test(id) ? id : null;
    } catch {
        return null;
    }
}

function resolverEntorno() {
    const pedido = String(process.env.BOT_ENTORNO || "").trim().toLowerCase();
    if (pedido) {
        if (ENTORNOS[pedido]) return { def: ENTORNOS[pedido], origen: "BOT_ENTORNO" };
        console.warn(`⚠️ [Entorno] BOT_ENTORNO="${process.env.BOT_ENTORNO}" no existe (usa navi o shuciika). Se detectará por el token.`);
    }

    const idToken = botIdDesdeToken(process.env.TOKEN_BOT);
    const porToken = Object.values(ENTORNOS).find((e) => e.botId === idToken);
    if (porToken) return { def: porToken, origen: "token" };

    console.warn("⚠️ [Entorno] No se pudo saber si el bot es Navi o Shuciika; se usa Navi. Define BOT_ENTORNO en el .env.");
    return { def: ENTORNOS.navi, origen: "por defecto" };
}

const { def: actual, origen } = resolverEntorno();
const SUFIJO = actual.nombre.toUpperCase();

/**
 * Variable del .env para este entorno: primero CLAVE_NAVI / CLAVE_SHUCIIKA, luego CLAVE.
 * @param {string} clave
 * @param {string} [porDefecto]
 */
function variable(clave, porDefecto) {
    const propia = process.env[`${clave}_${SUFIJO}`];
    if (propia !== undefined && propia !== "") return propia;
    const comun = process.env[clave];
    if (comun !== undefined && comun !== "") return comun;
    return porDefecto;
}

const token = variable("TOKEN_BOT");

// Si el token elegido es del otro bot, avisarlo ya: suele ser un .env a medio cambiar.
const idDelToken = botIdDesdeToken(token);
if (idDelToken && idDelToken !== actual.botId) {
    const otro = Object.values(ENTORNOS).find((e) => e.botId === idDelToken);
    console.warn(`⚠️ [Entorno] El entorno es ${actual.etiqueta}, pero el token es de ${otro ? otro.etiqueta : `otro bot (${idDelToken})`}. Revisa BOT_ENTORNO y TOKEN_BOT.`);
}

const prefijo = actual.prefijoComandos;

/** "si"/"no" (y equivalentes) del .env; cualquier otra cosa deja el valor del entorno. */
function booleano(valor, porDefecto) {
    const v = String(valor ?? "").trim().toLowerCase();
    if (["1", "true", "si", "sí", "on", "yes"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
    return porDefecto;
}

const enviosAutomaticos = booleano(variable("ENVIOS_AUTOMATICOS"), actual.enviosAutomaticos);
const avisados = new Set();

const entorno = {
    ENTORNOS,
    nombre: actual.nombre,
    etiqueta: actual.etiqueta,
    origen,
    botId: actual.botId,
    esNavi: actual.nombre === "navi",
    esShuciika: actual.nombre === "shuciika",
    esProduccion: actual.esProduccion,
    prefijoComandos: prefijo,
    enviosAutomaticos,

    variable,
    token,

    /** Nombre con el que se registra un comando en Discord: "rol" → "navi-rol" en Navi. */
    nombreComando(nombreLocal) {
        return `${prefijo}${nombreLocal}`;
    },

    /** Nombre del archivo local a partir del nombre en Discord: "navi-rol" → "rol". */
    nombreLocal(nombreDiscord) {
        if (!nombreDiscord) return nombreDiscord;
        return prefijo && nombreDiscord.startsWith(prefijo) ? nombreDiscord.slice(prefijo.length) : nombreDiscord;
    },

    /**
     * Mención clicable de un comando: </rol inventario:ID>. Busca el ID en los
     * comandos registrados de este bot (cada bot tiene IDs distintos). Si aún no
     * están cargados, devuelve el nombre en texto: `/navi-rol inventario`.
     * @param {import("discord.js").Client} client
     * @param {string} nombreLocal  Nombre sin prefijo ("rol")
     * @param {string} [sub]        Subcomando (o "grupo subcomando")
     */
    mencionComando(client, nombreLocal, sub) {
        const nombre = `${prefijo}${nombreLocal}`;
        const ruta = sub ? `${nombre} ${sub}` : nombre;
        const cmd = client?.application?.commands?.cache?.find((c) => c.name === nombre);
        return cmd ? `</${ruta}:${cmd.id}>` : `\`/${ruta}\``;
    },

    /**
     * ¿Puede este sistema publicar por su cuenta? En Navi no: lo que depende del dashboard
     * solo se manda cuando alguien lo pide ahí. Avisa una vez por sistema en consola.
     * @param {string} sistema  Nombre para el aviso ("noticiero del clima")
     */
    envioAutomatico(sistema) {
        if (enviosAutomaticos) return true;
        if (sistema && !avisados.has(sistema)) {
            avisados.add(sistema);
            console.log(`⏸️ [${actual.etiqueta}] Envío automático omitido: ${sistema}. Solo se manda a mano desde el dashboard.`);
        }
        return false;
    },

    /** Avisa si el bot que inició sesión no es el que se esperaba. Se llama en clientReady. */
    verificarSesion(client) {
        const id = client?.user?.id;
        if (id && id !== actual.botId) {
            console.warn(`⚠️ [Entorno] Sesión iniciada como ${client.user.tag} (${id}), pero el entorno es ${actual.etiqueta} (${actual.botId}).`);
            return false;
        }
        return true;
    },
};

module.exports = entorno;
