// ─────────────────────────────────────────────────────────────────────────────
// Foto diaria del dinero y comprobación de cuadre.
//
// Se toma a las 00:00 de México, justo en el corte de día del libro de Lumens
// (lumens.js), para que la foto y los contadores cubran exactamente el mismo
// periodo. Cada día debe cumplirse:
//
//     M_t − M_{t−1} = Σ fuentes_t − Σ sumideros_t      (las transferencias suman 0)
//
// Si no cuadra, algún código modificó el dinero sin pasar por moverLumens.
// ─────────────────────────────────────────────────────────────────────────────
const cron = require("node-cron")
const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const diario = db_rol.collection("econ_diario")
const snapshots = db_rol.collection("econ_snapshots")
const { volcarContadores, fechaMx } = require("./lumens")
const { calcularAlertas, enviarResumenDiario } = require("./analisisEconomia")

const TRAMOS = [0, 1, 50, 100, 250, 500, 1000, 2500, 5000]

/** Percentil sobre un arreglo ya ordenado de menor a mayor (interpolación lineal). */
function percentil(orden, p) {
    if (!orden.length) return 0
    const i = (orden.length - 1) * p
    const lo = Math.floor(i), hi = Math.ceil(i)
    return Math.round(orden[lo] + (orden[hi] - orden[lo]) * (i - lo))
}

/** G = Σ (2i − n − 1)·x(i) / (n·Σx), con los saldos ordenados de menor a mayor. */
function gini(orden) {
    const n = orden.length
    const suma = orden.reduce((s, x) => s + x, 0)
    if (!n || suma <= 0) return 0
    let acum = 0
    for (let i = 0; i < n; i++) acum += (2 * (i + 1) - n - 1) * orden[i]
    return Number((acum / (n * suma)).toFixed(4))
}

function histograma(orden) {
    const cubetas = TRAMOS.map((desde, i) => ({ desde, hasta: TRAMOS[i + 1] ? TRAMOS[i + 1] - 1 : null, n: 0 }))
    for (const x of orden) {
        let i = TRAMOS.length - 1
        while (i > 0 && x < TRAMOS[i]) i--
        if (x < 0) i = 0
        cubetas[i].n++
    }
    return cubetas
}

const totalDe = (grupo) => Object.values(grupo || {}).reduce((s, g) => s + (g?.total || 0), 0)

/** Calcula la distribución del dinero en este instante (también la usa el panel en vivo). */
async function distribucionActual() {
    const docs = await personajes.find({}, { projection: { "economia.Lumens": 1, "economia.congelado.lumens": 1, "perfil.Nombre": 1 } }).toArray()
    const filas = docs.map(d => ({
        personajeId: d._id,
        nombre: d.perfil?.Nombre ?? null,
        saldo: (d.economia?.Lumens ?? 0) + (d.economia?.congelado?.lumens ?? 0),
    }))
    const orden = filas.map(f => f.saldo).sort((a, b) => a - b)
    const total = orden.reduce((s, x) => s + x, 0)

    return {
        total,
        personajes: orden.length,
        conSaldo: orden.filter(x => x > 0).length,
        media: orden.length ? Math.round(total / orden.length) : 0,
        mediana: percentil(orden, 0.5),
        p90: percentil(orden, 0.9),
        p99: percentil(orden, 0.99),
        max: orden.length ? orden[orden.length - 1] : 0,
        gini: gini(orden),
        top10: [...filas].sort((a, b) => b.saldo - a.saldo).slice(0, 10),
        negativos: filas.filter(f => f.saldo < 0),
        histograma: histograma(orden),
    }
}

/**
 * Guarda la foto del día `fecha` (el que acaba de cerrar) y su comprobación de cuadre.
 * @param {string} fecha - "YYYY-MM-DD"
 * @param {{ tardio?: boolean }} [opciones] - tardio: la foto no se tomó en el corte (el bot estaba apagado)
 */
async function tomarSnapshot(fecha, { tardio = false } = {}) {
    await volcarContadores()
    const dist = await distribucionActual()

    const ayer = fechaMx(Date.parse(`${fecha}T12:00:00Z`) - 86400_000)
    const [previa, contadores] = await Promise.all([
        snapshots.findOne({ _id: ayer }, { projection: { total: 1 } }),
        diario.findOne({ _id: fecha }),
    ])

    const fuentes = totalDe(contadores?.fuentes)
    const sumideros = totalDe(contadores?.sumideros)
    const cuadre = previa
        ? (() => {
            const deltaM = dist.total - previa.total
            const flujo = fuentes - sumideros
            return { anterior: previa.total, deltaM, flujo, diferencia: deltaM - flujo, ok: deltaM === flujo }
        })()
        : { anterior: null, deltaM: null, flujo: fuentes - sumideros, diferencia: null, ok: null }

    const doc = { _id: fecha, fecha, tomadoEn: new Date(), tardio, ...dist, fuentes, sumideros, cuadre }
    await snapshots.replaceOne({ _id: fecha }, doc, { upsert: true })

    if (cuadre.ok === false) {
        console.error(`[Economía] El día ${fecha} NO cuadra: ΔM=${cuadre.deltaM}, flujo=${cuadre.flujo}, diferencia=${cuadre.diferencia}`)
    }
    if (dist.negativos.length) {
        console.error(`[Economía] ${dist.negativos.length} personaje(s) con saldo negativo:`, dist.negativos.map(n => n.personajeId).join(", "))
    }
    return doc
}

/** Foto del día + alertas guardadas con ella + resumen al canal privado. */
async function cerrarDia(client, fecha, opciones) {
    const foto = await tomarSnapshot(fecha, opciones)
    const alertas = await calcularAlertas(fecha, foto)
    await snapshots.updateOne({ _id: fecha }, { $set: { alertas } })
    await enviarResumenDiario(client, fecha, foto, alertas)
        .catch(err => console.error("[Economía] No se pudo mandar el resumen diario:", err.message))
}

let programado = false
/** Programa la foto de las 00:00 (México) y repone la de ayer si el bot estaba apagado en el corte. */
function iniciarSnapshots(client) {
    if (programado) return
    programado = true

    cron.schedule("0 0 * * *", () => {
        // A las 00:00 acaba de cerrar el día anterior
        cerrarDia(client, fechaMx(Date.now() - 60_000))
            .catch(err => console.error("[Economía] Error cerrando el día:", err))
    }, { timezone: "America/Mexico_City" })

    const ayer = fechaMx(Date.now() - 86400_000)
    snapshots.countDocuments({ _id: ayer }, { limit: 1 })
        .then(existe => existe ? null : cerrarDia(client, ayer, { tardio: true }))
        .catch(err => console.error("[Economía] Error reponiendo la foto de ayer:", err))
}

module.exports = { tomarSnapshot, distribucionActual, iniciarSnapshots, gini, percentil }
