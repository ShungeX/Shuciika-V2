// functions/Objetos/durabilidad.js
// Durabilidad del equipo (artefactos, herramientas y contenedores).
//
// La definición (Objetos_globales) guarda el máximo `durabilidad` (1-200) y la `resistencia` (0-100 %).
// La entrada del inventario guarda los puntos actuales en `durabilidad`; si no los tiene, está como nuevo.
// Al llegar a 0 el objeto se rompe pero no se destruye: queda inutilizable y se puede reparar.

const TIPOS_CON_DURABILIDAD = ["artefacto", "herramienta", "contenedor"]
const DURABILIDAD_MAXIMA = 200

function tiposDe(def) {
    const t = def?.Tipo
    return (Array.isArray(t) ? t : (t ? [t] : [])).map(x => String(x).toLowerCase())
}

/** Solo el equipo tiene durabilidad; materiales y consumibles no. */
function esEquipo(def) {
    return tiposDe(def).some(t => TIPOS_CON_DURABILIDAD.includes(t))
}

/** Máximo de la definición, o null si el objeto no usa durabilidad. */
function durabilidadMaxima(def) {
    if (!esEquipo(def)) return null
    const max = Number(def?.durabilidad)
    return Number.isFinite(max) && max > 0 ? Math.min(max, DURABILIDAD_MAXIMA) : null
}

/** Puntos actuales de una entrada del inventario (sin dato = nuevo). null si no usa durabilidad. */
function durabilidadActual(item, def) {
    const max = durabilidadMaxima(def)
    if (max === null) return null
    const actual = Number(item?.durabilidad)
    if (!Number.isFinite(actual)) return max
    return Math.max(0, Math.min(actual, max))
}

/** f = D / Dmax; 1 si no tiene durabilidad. */
function factorDurabilidad(item, def) {
    const max = durabilidadMaxima(def)
    if (max === null) return { D: 1, Dmax: 1 }
    return { D: durabilidadActual(item, def), Dmax: max }
}

function estaRoto(item, def) {
    return durabilidadActual(item, def) === 0
}

/**
 * Puntos que pierde de verdad tras un desgaste de `puntos`: la resistencia los reduce en ese porcentaje.
 * Se guardan con dos decimales para que una resistencia alta siga desgastando poco a poco (y no nunca).
 */
function calcularDesgaste(puntos, resistencia = 0) {
    const r = Math.max(0, Math.min(100, Number(resistencia) || 0))
    return Math.round(Math.max(0, Number(puntos) || 0) * (100 - r)) / 100
}

module.exports = {
    TIPOS_CON_DURABILIDAD,
    DURABILIDAD_MAXIMA,
    esEquipo,
    durabilidadMaxima,
    durabilidadActual,
    factorDurabilidad,
    estaRoto,
    calcularDesgaste
}
