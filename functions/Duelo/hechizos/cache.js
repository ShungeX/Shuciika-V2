// ─── Caché de hechizos en memoria (XII.B) ────────────────────────────────────
// Toda la colección se carga una vez en un Map por _id (ya normalizada con el adaptador).
// El combate nunca consulta Mongo por cast. El dashboard invalida al crear/editar.

const { CACHE } = require("./config")
const { normalizarHechizo } = require("./adaptador")

let mapa = null
let cargando = null
let cargadoEn = 0
let indicesCreados = false

function coleccion() {
    const clientdb = require("../../../Server")
    return clientdb.db("Rol_db").collection("Hechizos_globales")
}

async function cargar() {
    const col = coleccion()
    const docs = await col.find({}).toArray()
    const nuevo = new Map()
    for (const d of docs) {
        try { nuevo.set(String(d._id), normalizarHechizo(d)) }
        catch (e) { console.error(`[Hechizos] No se pudo normalizar ${d._id}:`, e.message) }
    }
    mapa = nuevo
    cargadoEn = Date.now()
    if (!indicesCreados) {
        indicesCreados = true
        Promise.all([
            col.createIndex({ Elemento: 1 }),
            col.createIndex({ Escalon: 1 }),
            col.createIndex({ isActive: 1 }),
        ]).catch(e => console.error("[Hechizos] No se pudieron crear los índices:", e.message))
    }
    return mapa
}

/** Garantiza que la caché esté cargada (y fresca). */
async function asegurar() {
    if (mapa && Date.now() - cargadoEn < CACHE.TTL_MS) return mapa
    if (!cargando) cargando = cargar().finally(() => { cargando = null })
    return cargando
}

/** Hechizo normalizado por _id (si no está en caché lo busca una vez y lo guarda). */
async function obtener(id) {
    if (id === null || id === undefined) return null
    await asegurar()
    const key = String(id)
    if (mapa.has(key)) return mapa.get(key)
    const doc = await coleccion().findOne({ _id: key })
    if (!doc) return null
    const h = normalizarHechizo(doc)
    mapa.set(key, h)
    return h
}

/** Varios hechizos por _id (acepta [{ ID }] de dominio.hechizos o strings). */
async function obtenerVarios(ids = []) {
    await asegurar()
    const lista = []
    for (const raw of ids) {
        const id = typeof raw === "object" && raw !== null ? (raw.ID ?? raw.id) : raw
        const h = await obtener(id)
        if (h) lista.push(h)
    }
    return lista
}

/** Lectura síncrona (null si la caché aún no cargó). */
function obtenerSync(id) {
    return mapa?.get(String(id)) ?? null
}

function obtenerVariosSync(ids = []) {
    return ids
        .map(raw => obtenerSync(typeof raw === "object" && raw !== null ? (raw.ID ?? raw.id) : raw))
        .filter(Boolean)
}

/** Invalida un hechizo (o toda la caché si no se da id). Lo llama el dashboard al guardar. */
function invalidar(id) {
    if (!mapa) return
    if (id === undefined || id === null) { mapa = null; return }
    mapa.delete(String(id))
}

function todos() {
    return mapa ? [...mapa.values()] : []
}

module.exports = { asegurar, obtener, obtenerVarios, obtenerSync, obtenerVariosSync, invalidar, todos }
