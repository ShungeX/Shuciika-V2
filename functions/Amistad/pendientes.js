// ─────────────────────────────────────────────────────────────────────────────
// "Máximo una interacción pendiente por tipo hacia la misma persona."
//
// Vive en memoria: el estado real de la interacción está en el custom_id, esto
// solo evita que A le mande cinco abrazos seguidos a B mientras B no responde.
// Si el bot se reinicia la lista se vacía; los mensajes viejos siguen siendo
// válidos hasta expirar, que es lo que importa.
// ─────────────────────────────────────────────────────────────────────────────
const cfg = require("../../config/amistad")

const pendientes = new Map()   // "tipo:de:a" → ts

const clave = (tipo, de, a) => `${tipo}:${de}:${a}`

/** Reserva el hueco. Devuelve false si ya hay una pendiente viva. */
function reservar(tipo, de, a, ts) {
    const k = clave(tipo, de, a)
    const previo = pendientes.get(k)
    if (previo && ts - previo <= cfg.EXPIRACION_PENDIENTE_MS) return false
    pendientes.set(k, ts)
    return true
}

/** Libera solo si sigue siendo la misma pendiente (otra más nueva no se toca). */
function liberar(tipo, de, a, ts) {
    const k = clave(tipo, de, a)
    if (pendientes.get(k) === ts) {
        pendientes.delete(k)
        return true
    }
    return false
}

const sigueViva = (tipo, de, a, ts) => pendientes.get(clave(tipo, de, a)) === ts

module.exports = { reservar, liberar, sigueViva }
