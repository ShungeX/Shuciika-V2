// ─── Aprendizaje: páginas en las tiendas (Fase 3) ────────────────────────────
// Las páginas se venden (o regalan) con el sistema de tiendas que ya existe (functions/Tiendas):
// aquí solo están las reglas propias de una página y la reposición semanal del Instituto.
const { PRACTICA, TIENDA, PAGINAS } = require("./config")
const N = require("./nucleo")
const { normalizarElemento, esUniversal } = require("../Duelo/hechizos/elementos")

/**
 * ¿Tiene sentido que este personaje se lleve la página? Evita gastar Lumens (o la única página
 * gratuita del Instituto) en algo que no podrá usar. El Resplandor no se exige: una página se
 * puede guardar para cuando alcance.
 * @param {Object} def - definición del objeto (Objetos_globales)
 * @param {Object|null} soul
 * @param {Object|null} hechizo - normalizado
 * @returns {string|null} motivo, o null si puede llevársela
 */
function motivoCompraPagina(def, soul, hechizo) {
    if (!N.esDefinicionPagina(def)) return null
    const nombre = def.Nombre || "esta página"
    if (!soul) return `Necesitas despertar tu alma antes de llevarte **${nombre}**.`
    if (!hechizo || hechizo.isActive === false) return `**${nombre}** no corresponde a ningún hechizo vigente.`
    if (N.conoceHechizo(soul, hechizo._id)) return `Ya conoces **${hechizo.Nombre}**: no necesitas su página.`
    if (N.esAfinado(soul) && !esUniversal(hechizo)
        && normalizarElemento(hechizo.Elemento) !== normalizarElemento(soul?.nucleo?.Elemento)) {
        return `Tu alma está afinada a otro elemento: **${nombre}** (${normalizarElemento(hechizo.Elemento)}) no te serviría.`
    }
    return null
}

/** Versión con base de datos: lee el alma del personaje (activo = mismo _id) y el hechizo. */
async function motivoCompraPaginaDe(def, characterId) {
    if (!N.esDefinicionPagina(def)) return null
    const clientdb = require("../../Server")
    const soul = await clientdb.db("Rol_db").collection("Soul").findOne({ _id: Number(characterId) })
    const hechizo = await require("../Duelo/hechizos/cache").obtener(def.hechizo)
    return motivoCompraPagina(def, soul, hechizo)
}

/**
 * Quita de una estantería las páginas que este personaje no podría usar (otro elemento si está
 * afinado, ya aprendidas, hechizo inexistente). Lee el alma una sola vez. Los demás objetos pasan.
 * @param {Array<{ definicion: Object }>} objetos - filas de objetosDeTienda
 */
async function filtrarPaginasUsables(objetos, characterId) {
    if (!objetos.some(o => N.esDefinicionPagina(o.definicion))) return objetos
    const clientdb = require("../../Server")
    const cache = require("../Duelo/hechizos/cache")
    const soul = await clientdb.db("Rol_db").collection("Soul").findOne({ _id: Number(characterId) })
    const out = []
    for (const o of objetos) {
        if (!N.esDefinicionPagina(o.definicion)) { out.push(o); continue }
        const hechizo = await cache.obtener(o.definicion.hechizo)
        if (motivoCompraPagina(o.definicion, soul, hechizo) === null) out.push(o)
    }
    return out
}

/** Mensaje de agotado: el del Instituto tiene su propia excusa. */
function mensajeAgotado(def) {
    return N.esDefinicionPagina(def) && def.fuente === "instituto" ? TIENDA.AGOTADO_INSTITUTO(def.Nombre) : null
}

/** Repone las existencias semanales de las páginas del Instituto. */
async function reponerInstituto({ client = null } = {}) {
    if (TIENDA.EXISTENCIAS_SEMANALES === null) return { repuestas: 0 }
    const clientdb = require("../../Server")
    const rol = clientdb.db("Rol_db")
    const r = await rol.collection("Objetos_globales").updateOne(
        { _id: PAGINAS.REGION },
        { $set: { "Objetos.$[p].Cantidad": TIENDA.EXISTENCIAS_SEMANALES } },
        { arrayFilters: [{ "p.fuente": "instituto", "p.hechizo": { $exists: true } }] }
    )
    if (client && require("../../config/entorno").envioAutomatico("paneles del Instituto tras la reposición")) {
        const { guild } = require("../../config/configslash.json")
        const { refrescarPaneles } = require("../mensajesServidor")
        await refrescarPaneles(client, guild, clientdb.db("Server_db"), rol).catch(e => console.error("[Aprendizaje] No se pudieron refrescar los paneles:", e.message))
    }
    return { repuestas: r.modifiedCount }
}

/** Programa la reposición semanal (lunes 00:00 en la zona horaria del aprendizaje). */
function iniciarReposicion(client) {
    const cron = require("node-cron")
    cron.schedule(TIENDA.REPOSICION_CRON, () => {
        reponerInstituto({ client })
            .then(r => console.log(`[Aprendizaje] Existencias del Instituto repuestas (${TIENDA.EXISTENCIAS_SEMANALES} por página).`, r))
            .catch(e => console.error("[Aprendizaje] Error al reponer el Instituto:", e.message))
    }, { timezone: PRACTICA.ZONA_HORARIA })
}

module.exports = { motivoCompraPagina, motivoCompraPaginaDe, filtrarPaginasUsables, mensajeAgotado, reponerInstituto, iniciarReposicion }
