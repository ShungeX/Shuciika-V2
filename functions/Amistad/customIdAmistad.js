// ─────────────────────────────────────────────────────────────────────────────
// Estado pendiente de una interacción, empaquetado en el custom_id (sin BD):
//
//     amistad*tipo*idEmisor*idReceptor*timestamp*cadena
//
// idEmisor / idReceptor son _id de PERSONAJE, no de Discord. Al resolver, quien
// pulsa debe tener como personaje activo a idReceptor.
//
// TODO(decisión): el router genérico (interaction/manejarComponente.js) separa con
// "-" y espera [action, userId, characterId, ...]. Este formato usa "*" como pide
// el diseño, así que en la FASE 2 hay que enrutar los custom_id que empiezan por
// "amistad*" antes de pasar por manejarComponente (o pasarlos a "-").
// ─────────────────────────────────────────────────────────────────────────────
const cfg = require("../../config/amistad")

const SEP = cfg.SEPARADOR_CUSTOM_ID
const MAX_CUSTOM_ID = 100   // límite de Discord

const limpio = (v) => /^[A-Za-z0-9_]+$/.test(String(v))

/**
 * @param {{ tipo: string, de: string|number, a: string|number, ts?: number, cadena?: number }} p
 * @returns {string}
 */
function codificarPendiente({ tipo, de, a, ts = Date.now(), cadena = 0 }) {
    for (const [k, v] of Object.entries({ tipo, de, a })) {
        if (v === undefined || v === null || !limpio(v)) throw new Error(`[amistad] campo '${k}' inválido para custom_id: ${v}`)
    }
    const id = [cfg.PREFIJO_CUSTOM_ID, tipo, de, a, Math.floor(ts), Math.max(0, Math.floor(cadena))].join(SEP)
    if (id.length > MAX_CUSTOM_ID) throw new Error(`[amistad] custom_id excede ${MAX_CUSTOM_ID} chars (${id.length}): ${id}`)
    return id
}

/** @returns {{ tipo: string, de: string, a: string, ts: number, cadena: number } | null} */
function decodificarPendiente(customId) {
    const partes = String(customId || "").split(SEP)
    if (partes.length !== 6 || partes[0] !== cfg.PREFIJO_CUSTOM_ID) return null
    const [, tipo, de, a, ts, cadena] = partes
    const tsN = Number(ts)
    const cadenaN = Number(cadena)
    if (!cfg.TIPOS[tipo] || !de || !a || !Number.isFinite(tsN) || !Number.isFinite(cadenaN)) return null
    // Los regalos no viajan por custom_id de amistad: sus puntos los fija el servidor al abrir
    if (cfg.TIPOS[tipo].puntosVariables) return null
    return { tipo, de, a, ts: tsN, cadena: cadenaN }
}

function estaExpirado(pendiente, ahora = Date.now()) {
    return !pendiente || (ahora - pendiente.ts) > cfg.EXPIRACION_PENDIENTE_MS
}

module.exports = { codificarPendiente, decodificarPendiente, estaExpirado, MAX_CUSTOM_ID }
