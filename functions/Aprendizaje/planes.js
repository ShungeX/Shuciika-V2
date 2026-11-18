// ─── Aprendizaje: planes de escritura (puros) ────────────────────────────────
// Cada operación de base de datos del aprendizaje se arma aquí como { filtro, update } y el
// servicio solo la ejecuta. Así las reglas de atomicidad se pueden probar sin Mongo:
//  · Empezar un intento consume la práctica (el intento se cuenta al empezar, no al terminar).
//  · El filtro exige que el estado siga como se leyó: si dos clics llegan a la vez, solo uno pasa.
//  · Terminar exige que la práctica activa sea esta (activa.id): se aplica una sola vez.
//  · Aprender crea la entrada del hechizo, borra el progreso y consume UNA página, todo junto.

const { PRACTICA } = require("./config")
const N = require("./nucleo")

const INV = "economia.Inventario"

/**
 * Empieza un intento: bloquea la práctica en BD y consume una práctica del día.
 * @param {Object} soul - alma leída justo antes
 * @param {{ id: string, hechizo: string, via: string, instancia: string, ahora?: number }} p
 */
function planInicio(soul, { id, hechizo, via, instancia, ahora = Date.now() }) {
    const fecha = N.fechaLocal(ahora)
    const previo = N.aprendizajeDe(soul).hoy
    const usadas = N.usadasHoy(soul, ahora)
    const guardiaHoy = previo?.fecha === fecha
        ? { "aprendizaje.hoy.fecha": fecha, "aprendizaje.hoy.n": Number(previo.n) || 0 }
        : { "aprendizaje.hoy.fecha": { $ne: fecha } }
    const activa = {
        id, hechizo, via, instancia, fecha,
        inicio: ahora,
        expira: ahora + PRACTICA.CADUCIDAD_MIN * 60_000,
    }
    return {
        filtro: {
            _id: soul._id,
            "aprendizaje.activa": null,                     // sin otra práctica en curso (falta o es null)
            ...guardiaHoy,
            $or: [{ "aprendizaje.cooldownHasta": { $exists: false } }, { "aprendizaje.cooldownHasta": { $lte: ahora } }],
        },
        update: { $set: { "aprendizaje.activa": activa, "aprendizaje.hoy": { fecha, n: usadas + 1 } } },
        activa,
    }
}

/**
 * Termina un intento: guarda el progreso de la vía, suelta el bloqueo y, si falló, pone el cooldown.
 * Si con esto se completan todas las vías, devuelve también el plan de aprendizaje.
 * @param {Object} soul - alma leída justo antes (con la práctica activa)
 * @param {{ sesionId: string, hechizo: Object, via: string, puntaje: number, ahora?: number }} p
 */
function planFin(soul, { sesionId, hechizo, via, puntaje, ahora = Date.now() }) {
    const id = String(hechizo._id)
    const vias = N.viasDe(hechizo)
    const antes = N.progresoDe(soul, id)
    const despues = N.aplicarPractica(antes, via, puntaje)
    const aprobo = N.aprobado(puntaje)
    const aprende = N.hechizoAprendido(despues, vias)

    const filtro = { _id: soul._id, "aprendizaje.activa.id": sesionId }
    const set = {}
    if (!aprobo) set["aprendizaje.cooldownHasta"] = ahora + PRACTICA.COOLDOWN_FALLO_MIN * 60_000

    const progreso = {
        filtro,
        update: { $set: { ...set, [`aprendizaje.practicas.${id}.${via}`]: despues[via] }, $unset: { "aprendizaje.activa": "" } },
    }
    const aprendizaje = aprende ? {
        filtro: { ...filtro, "dominio.hechizos.ID": { $ne: id } },
        update: {
            ...(Object.keys(set).length ? { $set: set } : {}),
            $push: { "dominio.hechizos": { ID: id, InCombat: true, usos: 0, maestria: 1 } },
            $unset: { "aprendizaje.activa": "", [`aprendizaje.practicas.${id}`]: "" },
        },
    } : null
    return { antes, despues, aprobo, aprende, progreso, aprendizaje }
}

/**
 * Consume una página (pila del inventario) dentro de la misma transacción del aprendizaje.
 * @param {number} personajeId
 * @param {{ ID: number, Region: string }} pagina - entrada del inventario
 */
function planConsumirPagina(personajeId, pagina) {
    const elem = { ID: Number(pagina.ID), Cantidad: { $gte: 1 } }
    if (pagina.Region) elem.Region = pagina.Region
    return {
        filtro: { _id: personajeId, [INV]: { $elemMatch: elem } },
        update: { $inc: { [`${INV}.$.Cantidad`]: -1 } },
        limpieza: { filtro: { _id: personajeId }, update: { $pull: { [INV]: { Cantidad: { $lte: 0 } } } } },
    }
}

/**
 * Devuelve el intento de una práctica huérfana (el bot se reinició con la sesión abierta: no es
 * culpa del jugador). Suelta el bloqueo y, si fue hoy, devuelve la práctica del día.
 */
function planDevolucion(soul, activa) {
    const hoy = N.aprendizajeDe(soul).hoy
    const devolver = activa?.fecha && hoy?.fecha === activa.fecha && (Number(hoy.n) || 0) > 0
    return {
        filtro: {
            _id: soul._id, "aprendizaje.activa.id": activa.id,
            ...(devolver ? { "aprendizaje.hoy.fecha": activa.fecha, "aprendizaje.hoy.n": Number(hoy.n) } : {}),
        },
        update: { $unset: { "aprendizaje.activa": "" }, ...(devolver ? { $inc: { "aprendizaje.hoy.n": -1 } } : {}) },
        devuelto: Boolean(devolver),
    }
}

module.exports = { planInicio, planFin, planConsumirPagina, planDevolucion }
