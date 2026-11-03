// ─────────────────────────────────────────────────────────────────────────────
// Libro de Lumens: el ÚNICO lugar del código que modifica economia.Lumens y
// economia.congelado.lumens. Cualquier otro archivo que necesite mover dinero
// llama a moverLumens / transferirLumens / congelarLumens / descongelarLumens.
//
// Dinero en circulación (M) = Σ (economia.Lumens + economia.congelado.lumens).
// Congelar una apuesta no cambia M, así que no deja fila ni contador.
//
// Colecciones (Rol_db):
//   econ_movimientos  una fila por movimiento con éxito (TTL 60 días)
//   econ_diario       contadores por día (no expira)
//   econ_actividad    un documento por día y personaje (TTL 90 días)
//   econ_snapshots    foto diaria del dinero (ver snapshotEconomia.js)
//
// El día se corta a las 00:00 de México, con la misma regla que la jornada de
// trabajo (utilidadesTexto.reinicio24hrs, UTC-6 fijo).
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require("crypto")
const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const personajes = db_rol.collection("Personajes")
const movimientos = db_rol.collection("econ_movimientos")
const diario = db_rol.collection("econ_diario")
const actividad = db_rol.collection("econ_actividad")

const OFFSET_MEXICO_MS = 6 * 60 * 60 * 1000
const CAMPO_ACTIVO = "economia.Lumens"
const CAMPO_CONGELADO = "economia.congelado.lumens"
const FLUSH_MS = 60 * 1000

// tipo: "fuente" crea dinero, "sumidero" lo destruye, "transferencia" lo cambia de manos
const MOTIVOS = new Set([
    "cofre", "trabajo", "tienda", "purificacion", "venta", "regalo", "duelo",
    "evento", "reembolso", "admin", "clase", "exploracion", "combate", "hechizo",
    "baja_personaje",
])

/** "2026-11-04": día en México de un instante, cortado a las 00:00 igual que la jornada. */
function fechaMx(ms = Date.now()) {
    return new Date(ms - OFFSET_MEXICO_MS).toISOString().slice(0, 10)
}

/** Las claves de Mongo no aceptan "." ni "$" */
const claveSegura = (v) => String(v ?? "sin_dato").replace(/[.$]/g, "_")

// ─── Índices ─────────────────────────────────────────────────────────────────
let indicesListos = null
function asegurarIndices() {
    if (!indicesListos) {
        indicesListos = Promise.all([
            movimientos.createIndex({ ts: -1 }),
            movimientos.createIndex({ userId: 1, ts: -1 }),
            movimientos.createIndex({ personajeId: 1, ts: -1 }),
            movimientos.createIndex({ motivo: 1, ts: -1 }),
            movimientos.createIndex({ opId: 1 }, { unique: true }),
            movimientos.createIndex({ ts: 1 }, { name: "ttl_60d", expireAfterSeconds: 60 * 86400 }),
            actividad.createIndex({ fecha: 1 }),
            actividad.createIndex({ exp: 1 }, { name: "ttl_90d", expireAfterSeconds: 90 * 86400 }),
        ]).catch(e => {
            indicesListos = null
            console.error("[Lumens] No se pudieron crear los índices:", e.message)
        })
    }
    return indicesListos
}
asegurarIndices()

// ─── Contadores en memoria (se vuelcan cada minuto) ──────────────────────────
let pendDiario = new Map()     // fecha → { "ruta.n": x, ... }
let pendActividad = new Map()  // "fecha:pj" → { inc, userId, personajeId, fecha }

function sumar(obj, ruta, valor) {
    if (!valor) return
    obj[ruta] = (obj[ruta] || 0) + valor
}

function contar(fila) {
    const fecha = fechaMx(fila.ts.getTime())
    const d = pendDiario.get(fecha) || {}
    const abs = Math.abs(fila.delta)

    if (fila.tipo === "transferencia") {
        // Cada transferencia tiene dos mitades; se cuenta una vez, por la que recibe
        if (fila.delta > 0) {
            sumar(d, "transferencias.n", 1)
            sumar(d, "transferencias.total", abs)
        }
        sumar(d, `transferenciasPorMotivo.${fila.motivo}.${fila.delta > 0 ? "entra" : "sale"}`, abs)
    } else {
        const lado = fila.delta > 0 ? "fuentes" : "sumideros"
        sumar(d, `${lado}.${fila.motivo}.n`, 1)
        sumar(d, `${lado}.${fila.motivo}.total`, abs)
    }

    const ref = fila.ref || {}
    if (ref.bonusEvento) sumar(d, "bonusEvento", Math.round(ref.bonusEvento))
    if (fila.motivo === "trabajo" && fila.delta > 0) {
        const t = claveSegura(ref.trabajo)
        sumar(d, `trabajos.${t}.turnos`, 1)
        sumar(d, `trabajos.${t}.total`, abs)
        if (typeof ref.calidad === "number") {
            sumar(d, `trabajos.${t}.calidadSum`, ref.calidad)
            sumar(d, `trabajos.${t}.calidadN`, 1)
        }
    }
    if (fila.motivo === "tienda" && fila.delta < 0) {
        // Un pedido puede llevar varias líneas: ref.items = [{ itemId, qty, total }]
        const lineas = Array.isArray(ref.items) ? ref.items
            : ref.itemId !== undefined ? [{ itemId: ref.itemId, qty: ref.qty, total: abs }] : []
        for (const l of lineas) {
            const it = claveSegura(l.itemId)
            sumar(d, `tienda.${it}.unidades`, Number(l.qty) || 1)
            sumar(d, `tienda.${it}.total`, Number(l.total) || 0)
        }
        if (ref.lugar) sumar(d, `tiendaLugar.${claveSegura(ref.lugar)}.total`, abs)
    }
    pendDiario.set(fecha, d)

    // Actividad por personaje (vista "Ritmo del jugador")
    const clave = `${fecha}:${fila.personajeId}`
    const a = pendActividad.get(clave) || { fecha, personajeId: fila.personajeId, userId: fila.userId, inc: {} }
    if (fila.delta > 0) {
        sumar(a.inc, "ingresoTotal", abs)
        if (fila.motivo === "trabajo") {
            sumar(a.inc, "ingresoTrabajo", abs)
            sumar(a.inc, "turnos", 1)
        }
    } else {
        sumar(a.inc, "gasto", abs)
    }
    pendActividad.set(clave, a)
}

function fusionar(destino, origen) {
    for (const [k, v] of Object.entries(origen)) destino[k] = (destino[k] || 0) + v
}

let volcando = false
async function volcarContadores() {
    if (volcando) return
    volcando = true
    const d = pendDiario, a = pendActividad
    pendDiario = new Map()
    pendActividad = new Map()

    try {
        if (d.size) {
            await diario.bulkWrite([...d].map(([fecha, inc]) => ({
                updateOne: { filter: { _id: fecha }, update: { $inc: inc }, upsert: true }
            })), { ordered: false })
        }
    } catch (e) {
        console.error("[Lumens] Fallo al volcar econ_diario, se reintenta:", e.message)
        for (const [fecha, inc] of d) {
            const actual = pendDiario.get(fecha) || {}
            fusionar(actual, inc)
            pendDiario.set(fecha, actual)
        }
    }

    try {
        if (a.size) {
            await actividad.bulkWrite([...a].map(([clave, x]) => ({
                updateOne: {
                    filter: { _id: clave },
                    update: {
                        $inc: x.inc,
                        $setOnInsert: { fecha: x.fecha, personajeId: x.personajeId, userId: x.userId, exp: new Date() },
                    },
                    upsert: true,
                }
            })), { ordered: false })
        }
    } catch (e) {
        console.error("[Lumens] Fallo al volcar econ_actividad, se reintenta:", e.message)
        for (const [clave, x] of a) {
            const actual = pendActividad.get(clave) || { ...x, inc: {} }
            fusionar(actual.inc, x.inc)
            pendActividad.set(clave, actual)
        }
    } finally {
        volcando = false
    }
}

setInterval(volcarContadores, FLUSH_MS).unref?.()

/** Contadores del día que todavía no se vuelcan (para que el panel vea "hoy" al instante). */
function contadoresPendientes(fecha) {
    return { ...(pendDiario.get(fecha) || {}) }
}

// ─── Núcleo ──────────────────────────────────────────────────────────────────
const enCurso = new Set()

function normalizarId(id) {
    const n = Number(id)
    return Number.isNaN(n) ? id : n
}

/**
 * Aplica el $inc de forma atómica. Si delta < 0, solo pasa con saldo suficiente.
 * @returns {Promise<{ ok: true, saldo: number, userId: string } | { ok: false, motivo: string }>}
 */
async function aplicar(personajeId, delta, campo, extraInc) {
    const filtro = { _id: personajeId }
    if (delta < 0) filtro[campo] = { $gte: -delta }
    const inc = { [campo]: delta, ...extraInc }

    const doc = await personajes.findOneAndUpdate(filtro, { $inc: inc }, {
        returnDocument: "after",
        projection: { ownerID: 1, userId: 1, "economia.Lumens": 1, "economia.congelado.lumens": 1 },
    })
    if (!doc) {
        const existe = await personajes.countDocuments({ _id: personajeId }, { limit: 1 })
        return { ok: false, motivo: existe ? "saldo_insuficiente" : "sin_personaje" }
    }
    const saldo = (doc.economia?.Lumens ?? 0) + (doc.economia?.congelado?.lumens ?? 0)
    return { ok: true, saldo, userId: String(doc.ownerID ?? doc.userId ?? "") }
}

function registrar(fila) {
    contar(fila)
    movimientos.insertOne(fila).catch(e => {
        if (e?.code !== 11000) console.error("[Lumens] No se pudo guardar la fila de auditoría:", e.message, fila)
    })
}

/**
 * Mueve Lumens de un personaje y deja la fila de auditoría.
 * @param {Object} p
 * @param {number|string} p.personajeId - _id del personaje
 * @param {string} [p.userId] - ID de Discord del dueño (si falta se lee del personaje)
 * @param {number} p.delta - entero; positivo suma, negativo resta
 * @param {"fuente"|"sumidero"|"transferencia"} [p.tipo] - por defecto según el signo
 * @param {string} p.motivo - ver MOTIVOS
 * @param {Object} [p.ref] - contexto: itemId, qty, trabajo, turno, calidad, base, bonusEvento, eventoId...
 * @param {string} [p.opId] - id único de la operación (p. ej. interaction.id); evita filas duplicadas
 * @param {boolean} [p.desdeCongelado] - resta de economia.congelado.lumens en vez del saldo activo
 * @param {string} [p.transferId]
 * @returns {Promise<{ ok: true, saldo: number, duplicado?: boolean } | { ok: false, motivo: string }>}
 */
async function moverLumens({ personajeId, userId, delta, tipo, motivo, ref = {}, opId, desdeCongelado = false, transferId }) {
    delta = Math.trunc(Number(delta))
    if (!Number.isFinite(delta) || delta === 0) return { ok: false, motivo: "delta_invalido" }
    if (!MOTIVOS.has(motivo)) console.warn(`[Lumens] Motivo no catalogado: ${motivo}`)
    tipo = tipo || (delta > 0 ? "fuente" : "sumidero")
    personajeId = normalizarId(personajeId)
    opId = opId ? String(opId) : crypto.randomUUID()

    if (enCurso.has(opId)) return { ok: false, motivo: "en_curso" }
    enCurso.add(opId)
    try {
        const previa = await movimientos.findOne({ opId }, { projection: { saldo: 1 } })
        if (previa) return { ok: true, saldo: previa.saldo, duplicado: true }

        // El histórico de ganancias solo sube con dinero nuevo, como hacía Economy.ajustarLumens
        const extra = (delta > 0 && tipo === "fuente") ? { "estado.progresoAcumulativo.lumens": delta } : {}
        const r = await aplicar(personajeId, delta, desdeCongelado ? CAMPO_CONGELADO : CAMPO_ACTIVO, extra)
        if (!r.ok) return r

        const fila = { ts: new Date(), userId: userId ? String(userId) : r.userId, personajeId, delta, saldo: r.saldo, tipo, motivo, opId, ref }
        if (transferId) fila.transferId = transferId
        registrar(fila)
        return { ok: true, saldo: r.saldo }
    } finally {
        enCurso.delete(opId)
    }
}

/**
 * Transfiere Lumens entre dos personajes. Las dos mitades comparten transferId.
 * @param {{ personajeId: number, userId?: string }} a - quien paga
 * @param {{ personajeId: number, userId?: string }} b - quien recibe
 * @param {number} monto - positivo
 * @param {{ motivo: string, ref?: Object, opId?: string, desdeCongelado?: boolean }} opciones
 */
async function transferirLumens(a, b, monto, { motivo, ref = {}, opId, desdeCongelado = false } = {}) {
    monto = Math.trunc(Number(monto))
    if (!Number.isFinite(monto) || monto <= 0) return { ok: false, motivo: "monto_invalido" }

    const ida = normalizarId(a.personajeId), vuelta = normalizarId(b.personajeId)
    if (ida === vuelta) return { ok: false, motivo: "mismo_personaje" }
    const [docA, docB] = await Promise.all([
        a.userId ? null : personajes.findOne({ _id: ida }, { projection: { ownerID: 1, userId: 1 } }),
        b.userId ? null : personajes.findOne({ _id: vuelta }, { projection: { ownerID: 1, userId: 1 } }),
    ])
    const userA = String(a.userId ?? docA?.ownerID ?? docA?.userId ?? "")
    const userB = String(b.userId ?? docB?.ownerID ?? docB?.userId ?? "")
    if (userA && userA === userB) return { ok: false, motivo: "mismo_usuario" }

    const transferId = opId ? String(opId) : crypto.randomUUID()
    const opSale = `${transferId}:sale`, opEntra = `${transferId}:entra`
    if (enCurso.has(opSale)) return { ok: false, motivo: "en_curso" }
    enCurso.add(opSale)
    try {
        const previa = await movimientos.findOne({ opId: opSale }, { projection: { _id: 1 } })
        if (previa) return { ok: true, duplicado: true, transferId }

        const sale = await aplicar(ida, -monto, desdeCongelado ? CAMPO_CONGELADO : CAMPO_ACTIVO, {})
        if (!sale.ok) return sale
        const entra = await aplicar(vuelta, monto, CAMPO_ACTIVO, {})
        if (!entra.ok) {
            // El receptor no existe: devolver sin dejar rastro
            await aplicar(ida, monto, desdeCongelado ? CAMPO_CONGELADO : CAMPO_ACTIVO, {})
            return entra
        }

        const ts = new Date()
        registrar({ ts, userId: userA || sale.userId, personajeId: ida, delta: -monto, saldo: sale.saldo, tipo: "transferencia", motivo, opId: opSale, transferId,
            ref: { ...ref, contraparteUserId: userB || entra.userId, contrapartePersonajeId: vuelta } })
        registrar({ ts, userId: userB || entra.userId, personajeId: vuelta, delta: monto, saldo: entra.saldo, tipo: "transferencia", motivo, opId: opEntra, transferId,
            ref: { ...ref, contraparteUserId: userA || sale.userId, contrapartePersonajeId: ida } })
        return { ok: true, transferId, saldoOrigen: sale.saldo, saldoDestino: entra.saldo }
    } finally {
        enCurso.delete(opSale)
    }
}

/**
 * Pasa Lumens del saldo activo al congelado (apuestas). No cambia el dinero en
 * circulación, así que no deja fila. Atómico: falla si no alcanza.
 */
async function congelarLumens(personajeId, monto) {
    monto = Math.trunc(Number(monto))
    if (!(monto > 0)) return true
    const r = await personajes.updateOne(
        { _id: normalizarId(personajeId), [CAMPO_ACTIVO]: { $gte: monto } },
        { $inc: { [CAMPO_ACTIVO]: -monto, [CAMPO_CONGELADO]: monto } }
    )
    return r.modifiedCount === 1
}

/** Devuelve al saldo activo hasta `monto` Lumens congelados. Devuelve lo que se restauró. */
async function descongelarLumens(personajeId, monto) {
    monto = Math.trunc(Number(monto))
    if (!(monto > 0)) return 0
    const id = normalizarId(personajeId)
    const doc = await personajes.findOne({ _id: id }, { projection: { [CAMPO_CONGELADO]: 1 } })
    const aRestaurar = Math.min(monto, doc?.economia?.congelado?.lumens ?? 0)
    if (aRestaurar <= 0) return 0
    const r = await personajes.updateOne(
        { _id: id, [CAMPO_CONGELADO]: { $gte: aRestaurar } },
        { $inc: { [CAMPO_ACTIVO]: aRestaurar, [CAMPO_CONGELADO]: -aRestaurar } }
    )
    return r.modifiedCount === 1 ? aRestaurar : 0
}

/**
 * Deja constancia de los Lumens que salen del sistema al borrar un personaje.
 * Se llama ANTES de borrar el documento.
 */
function registrarBaja(personaje) {
    const saldo = (personaje?.economia?.Lumens ?? 0) + (personaje?.economia?.congelado?.lumens ?? 0)
    if (!personaje || saldo <= 0) return
    registrar({
        ts: new Date(), userId: String(personaje.ownerID ?? personaje.userId ?? ""), personajeId: personaje._id,
        delta: -saldo, saldo: 0, tipo: "sumidero", motivo: "baja_personaje", opId: `baja:${personaje._id}:${Date.now()}`, ref: {},
    })
}

module.exports = {
    moverLumens,
    transferirLumens,
    congelarLumens,
    descongelarLumens,
    registrarBaja,
    volcarContadores,
    contadoresPendientes,
    fechaMx,
    MOTIVOS,
    OFFSET_MEXICO_MS,
}
