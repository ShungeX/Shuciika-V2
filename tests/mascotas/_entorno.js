// Entorno de pruebas de mascotas sin Discord ni Mongo: Server.js se reemplaza por una base de datos
// en memoria que entiende lo justo de Mongo (igualdad, $gte, $ne, $or · $set, $unset, $inc).
const Module = require("module")

const colecciones = new Map()   // nombre → Map(_id → doc)
const tabla = (nombre) => {
    if (!colecciones.has(nombre)) colecciones.set(nombre, new Map())
    return colecciones.get(nombre)
}
const copiar = (o) => JSON.parse(JSON.stringify(o))
const leer = (doc, ruta) => ruta.split(".").reduce((o, k) => o?.[k], doc)

function cumple(doc, filtro = {}) {
    return Object.entries(filtro).every(([clave, esperado]) => {
        if (clave === "$or") return esperado.some(f => cumple(doc, f))
        const valor = leer(doc, clave)
        if (esperado && typeof esperado === "object" && !Array.isArray(esperado)) {
            return Object.entries(esperado).every(([op, v]) => {
                if (op === "$gte") return valor >= v
                if (op === "$ne") return valor !== v
                if (op === "$in") return v.includes(valor)
                throw new Error(`Operador no soportado en la base falsa: ${op}`)
            })
        }
        return valor === esperado
    })
}

function escribir(doc, ruta, fn) {
    const partes = ruta.split(".")
    let o = doc
    for (const p of partes.slice(0, -1)) o = (o[p] ??= {})
    fn(o, partes[partes.length - 1])
}

function aplicar(doc, update) {
    for (const [ruta, v] of Object.entries(update.$set || {})) escribir(doc, ruta, (o, k) => { o[k] = copiar(v) })
    for (const ruta of Object.keys(update.$unset || {})) escribir(doc, ruta, (o, k) => { delete o[k] })
    for (const [ruta, v] of Object.entries(update.$inc || {})) escribir(doc, ruta, (o, k) => { o[k] = (Number(o[k]) || 0) + v })
}

const coleccion = (nombre) => ({
    find: (filtro) => ({ toArray: async () => [...tabla(nombre).values()].filter(d => cumple(d, filtro)).map(copiar) }),
    findOne: async (filtro) => { const d = [...tabla(nombre).values()].find(x => cumple(x, filtro)); return d ? copiar(d) : null },
    insertOne: async (doc) => { tabla(nombre).set(doc._id, copiar(doc)); return { insertedId: doc._id } },
    updateOne: async (filtro, update) => {
        const d = [...tabla(nombre).values()].find(x => cumple(x, filtro))
        if (!d) return { modifiedCount: 0 }
        aplicar(d, update)
        return { modifiedCount: 1 }
    },
    updateMany: async (filtro, update) => {
        const docs = [...tabla(nombre).values()].filter(x => cumple(x, filtro))
        docs.forEach(d => aplicar(d, update))
        return { modifiedCount: docs.length }
    },
    deleteOne: async (filtro) => {
        const d = [...tabla(nombre).values()].find(x => cumple(x, filtro))
        if (d) tabla(nombre).delete(d._id)
        return { deletedCount: d ? 1 : 0 }
    },
    createIndex: async () => null,
})
const ServerFalso = { db: () => ({ collection: coleccion }) }

const cargarOriginal = Module._load
Module._load = function (req) {
    if (/(^|[\\/])Server(\.js)?$/.test(req)) return ServerFalso
    if (/(^|[\\/])bot(\.js)?$/.test(req)) return {}
    return cargarOriginal.apply(this, arguments)
}

const servicio = require("../../functions/Mascotas/servicio")

const HUEVO = { ID: 336, Region: "TOB-01", Nombre: "Huevo fragmentado", Rareza: "Resonante", Tipo: ["Huevo", "Mascota"] }
const HUEVO_RAPIDO = { ID: 900, Region: "TOB-01", Nombre: "Huevo veloz", Tipo: ["Huevo"], eclosion_horas: 24 }
const DEFINICIONES = [
    HUEVO, HUEVO_RAPIDO,
    { ID: 52, Region: "TOB-01", Nombre: "Incubadora", Tipo: ["Herramienta", "Mascota"] },
    { ID: 483, Region: "SKY-02", Nombre: "Mordisquitos", Tipo: ["Consumible", "Mascota"] },
    { ID: 767, Region: "SKY-02", Nombre: "Jabón Nube", Tipo: ["Consumible", "Mascota"] },
    { ID: 728, Region: "SKY-02", Nombre: "Peluchin", Tipo: ["Consumible", "Mascota"] },
    { ID: 736, Region: "SKY-02", Nombre: "Cama lunar", Tipo: ["Herramienta", "Mascota"] },
]

/** Reloj y dependencias controladas por las pruebas. */
const reloj = { ahora: Date.UTC(2026, 10, 15, 18, 0, 0) }   // 12:00 en Ciudad de México
const consumidos = []
servicio.deps.ahora = () => reloj.ahora
servicio.deps.azar = () => 0
servicio.deps.maxEnergia = () => 140
servicio.deps.definicion = (region, id) => DEFINICIONES.find(d => d.ID === Number(id) && (!region || d.Region === region)) || null
servicio.deps.recargarEnergia = async (soul) => tabla("Soul").get(soul._id)?.nucleo?.energy ?? 0
servicio.deps.consumirObjeto = async (characterId, obj) => { consumidos.push({ characterId, ...obj }); return { success: true } }
servicio.deps.devolverObjeto = async () => ({ success: true })

function limpiar() {
    colecciones.clear()
    consumidos.length = 0
    reloj.ahora = Date.UTC(2026, 10, 15, 18, 0, 0)
}

/** Personaje con los objetos indicados en el inventario: [{ ID, Region, Cantidad }]. */
const personaje = (id, objetos = []) => ({
    _id: id, ownerID: `u${id}`, perfil: { Nombre: `Personaje ${id}` },
    economia: { Inventario: objetos.map(o => ({ Cantidad: 1, ...o })) },
})

/** Alma guardada en la base falsa (la energía se cobra ahí). */
function alma(id, energy = 140) {
    const doc = { _id: id, nucleo: { energy, lastEnergyUpdate: reloj.ahora } }
    tabla("Soul").set(id, copiar(doc))
    return doc
}

module.exports = { servicio, tabla, reloj, consumidos, limpiar, personaje, alma, HUEVO, HUEVO_RAPIDO, DEFINICIONES }
