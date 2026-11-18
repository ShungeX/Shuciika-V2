// ─── Aprendizaje: sesiones de práctica en memoria ────────────────────────────
// Una práctica activa por personaje: el bloqueo vive aquí (memoria) y en Soul.aprendizaje.activa
// (base de datos, sobrevive a reinicios). Una sesión en BD cuyo id no está en este mapa es
// huérfana: el bot se reinició con ella abierta y el intento se devuelve.
//
// La respuesta correcta (invocación, gestos, sello, glifo distinto) vive solo aquí, en el
// servidor: al cliente solo llega lo que el jugador debe ver en cada momento.

const crypto = require("crypto")
const { PRACTICA } = require("./config")

/** Identifica este arranque del bot: una sesión de otra instancia es huérfana. */
const INSTANCIA = crypto.randomBytes(6).toString("hex")

/** soulId → sesión */
const activas = new Map()

const nuevoId = () => crypto.randomBytes(5).toString("hex")

/**
 * Registra una sesión. `terminar(puntaje)` la cierra una sola vez y resuelve la promesa que
 * devuelve iniciarPractica. Caduca sola a los CADUCIDAD_MIN minutos (puntaje 0).
 * @param {Object} p - { id, soulId, characterId, userId, hechizo, via }
 * @returns {Object} sesión
 */
function crear({ id, soulId, characterId, userId, hechizo, via }) {
    let resolver
    const promesa = new Promise(r => { resolver = r })
    const sesion = {
        id, soulId: Number(soulId), characterId, userId, hechizo, via,
        creada: Date.now(),
        estado: {},                  // datos privados del minijuego (respuesta correcta incluida)
        interaccion: null,           // última interacción del jugador: con ella se edita el mensaje
        timers: new Set(),
        cerrada: false,
        promesa,
        terminar(puntaje, extra = {}) {
            if (sesion.cerrada) return false
            sesion.cerrada = true
            for (const t of sesion.timers) clearTimeout(t)
            sesion.timers.clear()
            if (activas.get(sesion.soulId) === sesion) activas.delete(sesion.soulId)
            resolver({ puntaje: Math.max(0, Math.min(1, Number(puntaje) || 0)), ...extra })
            return true
        },
        /** setTimeout ligado a la sesión (se cancela al cerrarla). */
        temporizador(ms, fn) {
            const t = setTimeout(() => { sesion.timers.delete(t); if (!sesion.cerrada) fn() }, ms)
            t.unref?.()
            sesion.timers.add(t)
            return t
        },
    }
    activas.set(sesion.soulId, sesion)
    sesion.temporizador(PRACTICA.CADUCIDAD_MIN * 60_000, () => sesion.terminar(0, { caducada: true }))
    return sesion
}

const deAlma = (soulId) => activas.get(Number(soulId)) ?? null

/** Sesión por id (los botones del minijuego la buscan así). */
function porId(id) {
    for (const s of activas.values()) if (s.id === id) return s
    return null
}

/** ¿La práctica activa guardada en BD sigue viva en este arranque? */
const sigueViva = (soulId, activaBD) => Boolean(activaBD && deAlma(soulId)?.id === activaBD.id)

module.exports = { INSTANCIA, nuevoId, crear, deAlma, porId, sigueViva, activas }
