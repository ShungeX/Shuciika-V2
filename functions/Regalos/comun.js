// ─────────────────────────────────────────────────────────────────────────────
// Piezas compartidas del sistema de regalos: transacciones, movimientos de
// inventario dentro de una transacción, "¿está ocupado?", nota saneada y
// estado en memoria (candado del editor y envíos por confirmar).
//
// Inventario: Personajes.economia.Inventario (por PERSONAJE, _id numérico).
// Lumens: SIEMPRE por functions/Economia/lumens.js (el libro). Nunca aquí.
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require("crypto")
const clientdb = require("../../Server")
const catalogoObjetos = require("../catalogoObjetos")
const transaccionCache = require("../../utils/cache")
const cfg = require("../../config/regalos")

const dbRol = clientdb.db("Rol_db")
const personajes = dbRol.collection("Personajes")
const souls = dbRol.collection("Soul")

const INV = "economia.Inventario"

/** Error que aborta una transacción con un código de config/mensajesRegalos.js */
class ErrorRegalo extends Error {
    constructor(codigo, extra = {}) {
        super(codigo)
        this.codigo = codigo
        this.extra = extra
    }
}

const ok = (extra = {}) => ({ ok: true, ...extra })
const fallo = (codigo, extra = {}) => ({ ok: false, codigo, ...extra })

/**
 * Ejecuta `fn(session)` dentro de una transacción (todo o nada).
 * Si `fn` lanza ErrorRegalo, devuelve { ok:false, codigo }. Requiere replica set
 * (Atlas lo es).
 */
async function enTransaccion(fn) {
    const session = clientdb.startSession()
    let resultado
    try {
        await session.withTransaction(async () => {
            resultado = await fn(session)
        })
        return resultado ?? ok()
    } catch (e) {
        if (e instanceof ErrorRegalo) return fallo(e.codigo, e.extra)
        console.error("[Regalos] Transacción abortada:", e)
        return fallo("ERROR")
    } finally {
        await session.endSession()
    }
}

const normalizarId = (id) => (Number.isFinite(Number(id)) ? Number(id) : id)

/** Filtro de una PILA normal del inventario (no instancias únicas). */
function filtroPila(entrada) {
    const f = { ID: Number(entrada.ID), instanciaID: { $exists: false } }
    if (entrada.Region) f.Region = String(entrada.Region)
    return f
}

/** Resta `cantidad` de una pila. Lanza FONDOS si no alcanza. */
async function quitarPila(pjId, entrada, cantidad, session) {
    const r = await personajes.updateOne(
        { _id: normalizarId(pjId), [INV]: { $elemMatch: { ...filtroPila(entrada), Cantidad: { $gte: cantidad } } } },
        { $inc: { [`${INV}.$.Cantidad`]: -cantidad } },
        { session }
    )
    if (r.modifiedCount !== 1) throw new ErrorRegalo("FONDOS")
    await personajes.updateOne({ _id: normalizarId(pjId) }, { $pull: { [INV]: { Cantidad: { $lte: 0 } } } }, { session })
}

/** Suma pilas al inventario (a la pila existente o una nueva). Sin topes: quien llama decide. */
async function agregarPilas(pjId, pilas, session) {
    for (const p of pilas) {
        const cantidad = Number(p.Cantidad ?? p.cantidad ?? 0)
        if (!(cantidad > 0)) continue
        const r = await personajes.updateOne(
            { _id: normalizarId(pjId), [INV]: { $elemMatch: filtroPila(p) } },
            { $inc: { [`${INV}.$.Cantidad`]: cantidad } },
            { session }
        )
        if (r.matchedCount === 1) continue
        const def = catalogoObjetos.getObjetoPorId(p.Region, p.ID) || {}
        const nuevo = catalogoObjetos.sanitizarObjetoInventario({ ...def, ID: p.ID, Region: p.Region, Nombre: p.Nombre }, cantidad)
        const r2 = await personajes.updateOne({ _id: normalizarId(pjId) }, { $push: { [INV]: nuevo } }, { session })
        if (r2.matchedCount !== 1) throw new ErrorRegalo("DESTINO_NO_EXISTE")
    }
}

/** Saca una instancia (bolsa) del inventario. Lanza SIN_BOLSA si no está. */
async function quitarInstancia(pjId, instanciaID, session, condicion = {}) {
    const r = await personajes.updateOne(
        { _id: normalizarId(pjId), [INV]: { $elemMatch: { instanciaID, ...condicion } } },
        { $pull: { [INV]: { instanciaID } } },
        { session }
    )
    if (r.modifiedCount !== 1) throw new ErrorRegalo("SIN_BOLSA")
}

// ─── Estado del personaje ────────────────────────────────────────────────────
const hpDe = (soul) => Number(soul?.nucleo?.HP ?? soul?.HP ?? 0)

/**
 * ¿En combate, exploración o evento? (mismo criterio que el duelo automático,
 * más los diálogos activos: los eventos inician un diálogo por participante).
 */
async function estaOcupado(pj) {
    if (!cfg.BLOQUEAR_OCUPADO || !pj) return false
    const id = pj._id
    // Imports diferidos: duelManager y dialogoManager arrastran media aplicación
    const { duelSystem } = require("../Duelo/duelManager")
    if (duelSystem.estaEnCombate(id) || await duelSystem.personajeEnDuelo(id)) return true
    if (transaccionCache.getStatus(id)) return true   // sala de duelo en espera

    const userCache = transaccionCache.getUser?.(pj.ownerID)
    if (userCache?.explorarID && transaccionCache.get(userCache.explorarID)) return true

    // TODO(decisión): activeDialogues incluye también charlas con NPCs, no solo
    // eventos. ¿Bloquear solo los diálogos de evento?
    try {
        const dialogos = require("../dialogoManager")
        if (pj.ownerID && dialogos?.activeDialogues?.has(String(pj.ownerID))) return true
    } catch { /* sin sistema de diálogos cargado */ }
    return false
}

async function leerPersonaje(id, projection) {
    if (id === null || id === undefined) return null
    return personajes.findOne({ _id: normalizarId(id) }, projection ? { projection } : undefined)
}

async function leerAlma(id) {
    if (id === null || id === undefined) return null
    return souls.findOne({ _id: normalizarId(id) }, { projection: { "nucleo.HP": 1, ownerID: 1 } })
}

const nombreDe = (pj) => pj?.perfil?.Nombre || pj?.Nombre || `Personaje ${pj?._id}`
const avatarDe = (pj) => pj?.perfil?.avatarURL || pj?.avatarURL || null

// ─── Nota saneada ────────────────────────────────────────────────────────────
// Sin menciones (@usuario, @rol, @everyone/@here), sin invitaciones ni enlaces
// de Discord. Al mostrarla, además, allowedMentions: { parse: [] }.
const PATRONES_PROHIBIDOS = [
    /<@[!&]?\d+>/,                                   // menciones de usuario / rol
    /@(everyone|here)\b/i,
    /discord(?:app)?\.(?:gg|com\/invite|io|me|li)\/?\S*/i,
    /\bdsc\.gg\//i,
    /https?:\/\/\S*discord\S*/i,
]

/**
 * @returns {{ ok: true, texto: string } | { ok: false }}
 */
function sanearNota(texto, max = cfg.NOTA_MAX) {
    const limpio = String(texto ?? "")
        .replace(/[​-‍﻿]/g, "")       // caracteres invisibles para esquivar filtros
        .replace(/\r/g, "")
        .trim()
    if (!limpio) return { ok: true, texto: "" }
    if (limpio.length > max) return { ok: false }
    if (PATRONES_PROHIBIDOS.some(p => p.test(limpio))) return { ok: false }
    // Un "@" suelto se neutraliza para que nunca pueda formar una mención
    return { ok: true, texto: limpio.replace(/@/g, "@​") }
}

function bannerValido(url) {
    try {
        const u = new URL(String(url).trim())
        if (u.protocol !== "https:") return false
        if (cfg.BANNER_HOSTS.includes(u.hostname)) return true
        return /\.(png|jpe?g|gif|webp)$/i.test(u.pathname)
    } catch {
        return false
    }
}

// ─── Estado en memoria ───────────────────────────────────────────────────────
// Candado del editor: deja editar UN regalo a la vez por usuario. El token viaja
// en el custom_id; un mensaje viejo (otro token) ya no puede tocar la bolsa.
// Un reinicio lo pierde y está bien: el contenido vive en la bolsa del inventario.
// También guarda en qué página y con qué filtros está viendo su inventario.
const editores = new Map()   // userId → { token, pjId, instanciaID, vence, pagina, filtros }

function abrirEditor(userId, pjId, instanciaID, token = crypto.randomBytes(4).toString("hex")) {
    editores.set(String(userId), { token, pjId: normalizarId(pjId), instanciaID, vence: Date.now() + cfg.EDITOR_TTL_MS, pagina: 1, filtros: ["fullbag"] })
    return token
}

/** ¿Tiene el usuario otro editor vigente (con otro token)? */
function otroEditorActivo(userId, token) {
    const s = editores.get(String(userId))
    return Boolean(s && s.token !== token && Date.now() <= s.vence)
}

/** Devuelve la sesión del editor si el token es el vigente, o null. Renueva la expiración. */
function sesionEditor(userId, token) {
    const s = editores.get(String(userId))
    if (!s || s.token !== token) return null
    if (Date.now() > s.vence) {
        editores.delete(String(userId))
        return null
    }
    s.vence = Date.now() + cfg.EDITOR_TTL_MS
    return s
}

const cerrarEditor = (userId) => editores.delete(String(userId))

// Envíos de /rol regalar esperando el botón "Enviar"
const confirmaciones = new Map()   // token → { userId, datos, vence }

function guardarConfirmacion(userId, datos) {
    const token = crypto.randomBytes(5).toString("hex")
    confirmaciones.set(token, { userId: String(userId), datos, vence: Date.now() + cfg.CONFIRMACION_TTL_MS })
    return token
}

function tomarConfirmacion(userId, token, { consumir = true } = {}) {
    const c = confirmaciones.get(token)
    if (!c || c.userId !== String(userId) || Date.now() > c.vence) {
        confirmaciones.delete(token)
        return null
    }
    if (consumir) confirmaciones.delete(token)
    return c.datos
}

// Limpieza periódica de lo expirado (sin cron: barato y suficiente)
setInterval(() => {
    const ahora = Date.now()
    for (const [k, v] of editores) if (ahora > v.vence) editores.delete(k)
    for (const [k, v] of confirmaciones) if (ahora > v.vence) confirmaciones.delete(k)
}, 5 * 60 * 1000).unref?.()

module.exports = {
    personajes,
    souls,
    INV,
    ErrorRegalo,
    ok,
    fallo,
    enTransaccion,
    normalizarId,
    filtroPila,
    quitarPila,
    agregarPilas,
    quitarInstancia,
    hpDe,
    estaOcupado,
    leerPersonaje,
    leerAlma,
    nombreDe,
    avatarDe,
    sanearNota,
    bannerValido,
    abrirEditor,
    otroEditorActivo,
    sesionEditor,
    cerrarEditor,
    guardarConfirmacion,
    tomarConfirmacion,
}
