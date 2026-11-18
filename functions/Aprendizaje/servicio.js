// ─── Aprendizaje: operaciones con base de datos ──────────────────────────────
// Las reglas viven en ./nucleo.js, las escrituras se arman en ./planes.js y los números en
// ./config.js. Aquí solo se lee, se decide con esas piezas y se ejecuta.

const clientdb = require("../../Server")
const catalogoObjetos = require("../catalogoObjetos")
const cacheHechizos = require("../Duelo/hechizos/cache")
const { FUENTES, PAGINAS } = require("./config")
const N = require("./nucleo")
const P = require("./planes")
const sesiones = require("./sesiones")

const db = () => clientdb.db("Rol_db")
const souls = () => db().collection("Soul")
const personajes = () => db().collection("Personajes")

const fallo = (motivo, extra = {}) => ({ ok: false, motivo, ...extra })

// ─── Páginas ─────────────────────────────────────────────────────────────────

/** Definición del ítem página de un hechizo (por la tabla de fuentes o buscando en el catálogo). */
function definicionPagina(hechizoId) {
    const f = FUENTES[hechizoId]
    if (f) {
        const def = catalogoObjetos.getObjetoPorId(PAGINAS.REGION, f.id)
        if (N.esDefinicionPagina(def) && def.hechizo === hechizoId) return def
    }
    for (const lista of catalogoObjetos.getCatalogo?.()?.values?.() ?? []) {
        const def = lista.find(o => N.esDefinicionPagina(o) && o.hechizo === hechizoId)
        if (def) return def
    }
    return null
}

/** Definición de un ítem del inventario si es una página, o null. */
function paginaDeItem(item) {
    const def = catalogoObjetos.getObjetoPorId(item?.Region, item?.ID)
    return N.esDefinicionPagina(def) ? def : null
}

/** Entrada del inventario con la página de ese hechizo (pila con Cantidad ≥ 1), o null. */
function paginaEnInventario(character, hechizoId) {
    return (character?.economia?.Inventario || []).find(i => {
        if (Number(i.Cantidad ?? 1) < 1) return false
        return paginaDeItem(i)?.hechizo === hechizoId
    }) ?? null
}

// ─── Huérfanas ───────────────────────────────────────────────────────────────

/** Devuelve el intento de una práctica guardada en BD que ya no vive en memoria. */
async function devolverHuerfana(soul) {
    const activa = N.aprendizajeDe(soul).activa
    if (!activa || sesiones.sigueViva(soul._id, activa)) return { devuelto: false }
    const plan = P.planDevolucion(soul, activa)
    const r = await souls().updateOne(plan.filtro, plan.update)
    if (r.modifiedCount !== 1 && plan.devuelto) {
        // El contador cambió entre medias: al menos se suelta el bloqueo
        await souls().updateOne({ _id: soul._id, "aprendizaje.activa.id": activa.id }, { $unset: { "aprendizaje.activa": "" } })
        return { devuelto: false, liberado: true }
    }
    return { devuelto: plan.devuelto && r.modifiedCount === 1, liberado: true }
}

/** Al arrancar: todas las prácticas que quedaron abiertas en otra instancia se devuelven. */
async function barrerHuerfanas() {
    const abiertas = await souls().find(
        { "aprendizaje.activa": { $type: "object" }, "aprendizaje.activa.instancia": { $ne: sesiones.INSTANCIA } },
        { projection: { _id: 1, aprendizaje: 1 } }
    ).toArray()
    let devueltas = 0
    for (const soul of abiertas) {
        try { if ((await devolverHuerfana(soul)).devuelto) devueltas++ }
        catch (e) { console.error(`[Aprendizaje] No se pudo devolver la práctica de ${soul._id}:`, e.message) }
    }
    return { revisadas: abiertas.length, devueltas }
}

// ─── Estado para la pantalla ─────────────────────────────────────────────────

/**
 * Todo lo que la pantalla de la página necesita, ya validado.
 * @returns {Promise<{ ok: boolean, motivo?: string, hechizo?: Object, soul?: Object, ... }>}
 */
async function estadoPagina({ character, soul, hechizoId, ahora = Date.now() }) {
    // Una práctica huérfana se resuelve antes de pintar (devuelve el intento)
    if (N.aprendizajeDe(soul).activa && !sesiones.sigueViva(soul._id, N.aprendizajeDe(soul).activa)) {
        await devolverHuerfana(soul)
        soul = await souls().findOne({ _id: soul._id })
    }
    const hechizo = await cacheHechizos.obtener(hechizoId)
    const pagina = paginaEnInventario(character, hechizoId)
    const v = N.validarPagina({ hechizo, tienePagina: Boolean(pagina), soul, ahora })
    if (!v.ok) return { ...v, hechizo, soul }

    const vias = N.viasDe(hechizo)
    const progreso = N.progresoDe(soul, hechizo._id)
    const activa = sesiones.deAlma(soul._id)
    return {
        ok: true, hechizo, soul, pagina, vias, progreso,
        restantes: N.restantesHoy(soul, ahora),
        cooldownMs: N.cooldownRestante(soul, ahora),
        practicaActiva: activa ? { hechizo: activa.hechizo?._id, via: activa.via } : null,
    }
}

// ─── Intento ─────────────────────────────────────────────────────────────────

/**
 * Empieza un intento de una vía. Repite las seis validaciones con el alma recién leída y, si
 * pasan, consume la práctica y bloquea en BD en una sola operación condicionada.
 * @returns {Promise<{ ok: boolean, motivo?: string, sesion?: Object, hechizo?: Object }>}
 */
async function iniciarIntento({ character, soulId, userId, hechizoId, via, ahora = Date.now() }) {
    let soul = await souls().findOne({ _id: Number(soulId) })
    if (!soul) return fallo("sin_alma")
    if (sesiones.deAlma(soul._id)) return fallo("practica_activa")
    if (N.aprendizajeDe(soul).activa) {
        await devolverHuerfana(soul)
        soul = await souls().findOne({ _id: soul._id })
    }

    const hechizo = await cacheHechizos.obtener(hechizoId)
    const pagina = paginaEnInventario(character, hechizoId)
    const v = N.validarPagina({ hechizo, tienePagina: Boolean(pagina), soul, practicaActiva: Boolean(N.aprendizajeDe(soul).activa), paraPracticar: true, ahora })
    if (!v.ok) return v
    const vias = N.viasDe(hechizo)
    if (!vias.includes(via)) return fallo("via_invalida")
    if ((Number(N.progresoDe(soul, hechizo._id)[via]) || 0) >= 1) return fallo("via_completa")

    const id = sesiones.nuevoId()
    const plan = P.planInicio(soul, { id, hechizo: hechizo._id, via, instancia: sesiones.INSTANCIA, ahora })
    const r = await souls().updateOne(plan.filtro, plan.update)
    if (r.modifiedCount !== 1) return fallo("conflicto")

    const sesion = sesiones.crear({ id, soulId: soul._id, characterId: character._id, userId, hechizo, via })
    return { ok: true, sesion, hechizo, pagina }
}

/**
 * Cierra un intento: guarda el progreso solo al terminar. Si con él se completan todas las vías,
 * aprende el hechizo y consume una página en una transacción (todo o nada). Abandonar o caducar
 * llega aquí con puntaje 0: sin progreso, y el intento ya estaba contado.
 */
async function terminarIntento({ sesion, puntaje, ahora = Date.now() }) {
    const soul = await souls().findOne({ _id: sesion.soulId })
    if (!soul || N.aprendizajeDe(soul).activa?.id !== sesion.id) return fallo("sesion_perdida")

    const plan = P.planFin(soul, { sesionId: sesion.id, hechizo: sesion.hechizo, via: sesion.via, puntaje, ahora })
    if (plan.aprendizaje) {
        const r = await aprenderEnTransaccion({ sesion, plan })
        if (r.ok) return { ok: true, ...resumen(plan, puntaje), aprendido: true }
        // Sin la página (o ya conocido): se guarda la vía al 100% y se avisa
        const g = await souls().updateOne(plan.progreso.filtro, plan.progreso.update)
        return { ok: g.modifiedCount === 1, ...resumen(plan, puntaje), aprendido: false, aviso: r.motivo }
    }
    const g = await souls().updateOne(plan.progreso.filtro, plan.progreso.update)
    if (g.modifiedCount !== 1) return fallo("sesion_perdida")
    return { ok: true, ...resumen(plan, puntaje), aprendido: false }
}

const resumen = (plan, puntaje) => ({ puntaje, aprobo: plan.aprobo, antes: plan.antes, despues: plan.despues })

async function aprenderEnTransaccion({ sesion, plan }) {
    const character = await personajes().findOne({ _id: sesion.characterId })
    const pagina = paginaEnInventario(character, sesion.hechizo._id)
    if (!pagina) return fallo("sin_pagina")
    const consumo = P.planConsumirPagina(character._id, pagina)

    const session = clientdb.startSession()
    let resultado = fallo("conflicto")
    try {
        await session.withTransaction(async () => {
            const a = await souls().updateOne(plan.aprendizaje.filtro, plan.aprendizaje.update, { session })
            if (a.modifiedCount !== 1) { resultado = fallo("ya_aprendido"); throw new AbortoAprendizaje() }
            const c = await personajes().updateOne(consumo.filtro, consumo.update, { session })
            if (c.modifiedCount !== 1) { resultado = fallo("sin_pagina"); throw new AbortoAprendizaje() }
            await personajes().updateOne(consumo.limpieza.filtro, consumo.limpieza.update, { session })
            resultado = { ok: true }
        })
    } catch (e) {
        if (!(e instanceof AbortoAprendizaje)) {
            console.error("[Aprendizaje] Transacción abortada:", e)
            resultado = fallo("conflicto")
        }
    } finally {
        await session.endSession()
    }
    return resultado
}

class AbortoAprendizaje extends Error { }

module.exports = {
    definicionPagina, paginaDeItem, paginaEnInventario,
    devolverHuerfana, barrerHuerfanas, estadoPagina, iniciarIntento, terminarIntento,
}
