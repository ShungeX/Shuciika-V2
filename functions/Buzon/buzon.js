// ─────────────────────────────────────────────────────────────────────────────
// Buzón del personaje — capa de datos (config/buzon.js explica el modelo).
//
// Los regalos se crean, abren y reportan en functions/Regalos/regalos.js; aquí
// solo se LISTAN junto al resto. Las notificaciones genéricas (cartas,
// paquetes, sistema) se crean con notificar() y se leen/borran desde aquí.
// ─────────────────────────────────────────────────────────────────────────────
const { ObjectId } = require("mongodb")
const clientdb = require("../../Server")
const cfg = require("../../config/buzon")

const coleccion = clientdb.db("Rol_db").collection("buzon")

const normalizarId = (id) => (Number.isFinite(Number(id)) ? Number(id) : id)
const aObjectId = (id) => { try { return new ObjectId(String(id)) } catch { return null } }

/** Los documentos viejos de regalos no tienen `tipo`. */
const tipoDe = (doc) => doc?.tipo || "regalo"
const esRegalo = (doc) => tipoDe(doc) === "regalo"
/** ¿Sigue sin abrir/leer? */
const esNueva = (doc) => cfg.ESTADOS_NUEVOS.includes(doc?.estado)

function filtroTipo(tipo) {
    if (!tipo || tipo === "todos") return {}
    if (tipo === "regalo") return { tipo: { $in: [null, "regalo"] } }
    return { tipo }
}

/**
 * Notificaciones de un personaje, más recientes primero.
 * @param {{ personaje, vista?: "nuevos"|"todo", tipo?: string, pagina?: number }} p
 */
async function listar({ personaje, vista = "nuevos", tipo = "todos", pagina = 0 }) {
    const para = normalizarId(personaje._id)
    // Barrido perezoso de los regalos vencidos (vuelven a su remitente)
    await require("../Regalos/regalos").procesarVencidos({ para })
        .catch(e => console.error("[Buzón] Barrido perezoso:", e.message))

    const estados = vista === "todo" ? cfg.ESTADOS_TODOS : cfg.ESTADOS_NUEVOS
    const filtro = { para, estado: { $in: estados }, ...filtroTipo(tipo) }

    const [total, sinAbrir] = await Promise.all([
        coleccion.countDocuments(filtro),
        coleccion.countDocuments({ para, estado: { $in: cfg.ESTADOS_NUEVOS } }),
    ])
    const paginas = Math.max(1, Math.ceil(total / cfg.LISTA))
    pagina = Math.max(0, Math.min(Number(pagina) || 0, paginas - 1))
    const items = await coleccion.find(filtro)
        .sort({ creadoEn: -1 })
        .skip(pagina * cfg.LISTA).limit(cfg.LISTA)
        .toArray()
    return { items, total, sinAbrir, pagina, paginas, vista, tipo }
}

/** Una notificación, solo si es de este personaje. */
async function obtener({ personaje, id }) {
    const _id = aObjectId(id)
    if (!_id) return null
    const doc = await coleccion.findOne({ _id })
    if (!doc || String(doc.para) !== String(personaje._id)) return null
    return doc
}

/** Marca como leída una notificación genérica (los regalos se "abren", no se leen). */
async function marcarLeida(doc) {
    if (!doc || esRegalo(doc) || doc.estado !== "nueva") return
    await coleccion.updateOne({ _id: doc._id, estado: "nueva" }, { $set: { estado: "leida", leidaEn: new Date() } })
}

/**
 * Borra una notificación genérica. Los regalos no se borran desde el buzón:
 * son el registro para detectar abusos entre cuentas (regla 13).
 */
async function borrar({ personaje, id }) {
    const doc = await obtener({ personaje, id })
    if (!doc || esRegalo(doc)) return false
    const r = await coleccion.deleteOne({ _id: doc._id, para: doc.para })
    return r.deletedCount === 1
}

/**
 * Deja una notificación genérica en el buzón de un PERSONAJE.
 * @param {object} p
 * @param {number|string} p.para        _id del personaje destino
 * @param {"carta"|"paquete"|"sistema"} [p.tipo]
 * @param {string} p.titulo
 * @param {string} [p.texto]
 * @param {{ _id?: any, nombre?: string }} [p.de]  Remitente (personaje) o nada para "sistema"
 * @param {string} [p.imagen]           https de una imagen opcional
 */
async function notificar({ para, tipo = "sistema", titulo, texto = "", de = null, imagen = null }) {
    if (!cfg.TIPOS[tipo] || tipo === "regalo") throw new Error(`[Buzón] Tipo no válido para notificar: ${tipo}`)
    const doc = {
        _id: new ObjectId(),
        tipo,
        para: normalizarId(para),
        de: de?._id !== undefined ? normalizarId(de._id) : null,
        deNombre: de?.nombre || (tipo === "sistema" ? "Instituto" : "Alguien"),
        titulo: String(titulo || "Sin título").slice(0, 100),
        texto: String(texto || "").slice(0, cfg.TEXTO_MAX),
        imagen: /^https:\/\//i.test(String(imagen || "")) ? imagen : null,
        estado: "nueva",
        creadoEn: new Date(),
    }
    await coleccion.insertOne(doc)
    return String(doc._id)
}

module.exports = { listar, obtener, marcarLeida, borrar, notificar, tipoDe, esRegalo, esNueva }
