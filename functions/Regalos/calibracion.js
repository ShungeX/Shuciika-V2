// ─────────────────────────────────────────────────────────────────────────────
// Modo calibración del valor de los regalos.
//
// reporteCalibracion() lista todos los ítems regalables ordenados por S, con sus
// factores, etiqueta y los puntos de amistad que propondrían (antes del tope
// diario y los retornos menguantes). Sirve para ajustar los PESOS y P_MIN/P_MAX
// de config/valorRegalo.js, no la fórmula.
//
// Criterio de revisión: una galleta cae en "Un detalle" y lo mejor del juego
// llega cerca de 100. Si hay mucho amontonamiento arriba, ajustar pesos o rango.
//
// Uso desde consola:  node scripts/calibrarRegalos.js [cantidad]
// ─────────────────────────────────────────────────────────────────────────────
const valor = require("../../config/valorRegalo")
const { leerItem } = require("./leerItem")

/**
 * @param {Object[]} catalogo - Todas las definiciones de Objetos_globales (aplanadas)
 * @param {{ cantidad?: number, conBolsa?: boolean }} [opciones]
 * @returns {Array<{ clave, nombre, rareza, precio, S, etiqueta, factores, puntos, puntosConBolsa, sustituido }>}
 */
function reporteCalibracion(catalogo, { cantidad = 1 } = {}) {
    return catalogo
        .map(def => ({ def, info: leerItem(def) }))
        // Las bolsas de regalo no pueden ir dentro de un regalo
        .filter(({ def, info }) => info?.regalable && !require("../../config/regalos").esBolsaRegalo(def))
        .map(({ def, info }) => {
            const p = valor.puntuarPila({ def, cantidad })
            return {
                clave: info.clave,
                nombre: info.nombre,
                rareza: def.Rareza ?? null,
                precio: info.precio,
                S: p.S,
                etiqueta: valor.etiquetaDe(p.S),
                factores: p.factores,
                puntos: valor.puntosAmistad(p.S, false),
                puntosConBolsa: valor.puntosAmistad(p.S, true),
                sustituido: Boolean(p.sustituido),
            }
        })
        .sort((a, b) => b.S - a.S || a.nombre.localeCompare(b.nombre))
}

/** Tabla de texto para consola o para pegar en un canal de staff. */
function tablaCalibracion(filas) {
    const f = (c) => (c === null || c === undefined ? " -  " : Number(c).toFixed(2))
    const lineas = [
        `PESOS ${JSON.stringify(valor.PESOS)}  P_MIN=${valor.P_MIN}  P_MAX=${valor.P_MAX}  S_MIN=${valor.S_MIN}  P_MAX_AMISTAD=${valor.P_MAX_AMISTAD}  GAMMA=${valor.GAMMA}`,
        "   S  | costo rareza bonus evento | pts (bolsa) | etiqueta                 | precio | rareza     | ítem",
        "------+----------------------------+-------------+--------------------------+--------+------------+------------------------",
    ]
    for (const r of filas) {
        const fc = r.factores
        const factores = r.sustituido ? "  valorRegalo (fijo)       " : `${f(fc.costo)}  ${f(fc.rareza)}  ${f(fc.bonusPasivo)}  ${f(fc.evento)} `
        lineas.push(`${String(r.S).padStart(5)} | ${factores} | ${String(r.puntos).padStart(3)} (${String(r.puntosConBolsa).padStart(2)})    | ${r.etiqueta.padEnd(24)} | ${String(r.precio ?? "-").padStart(6)} | ${String(r.rareza ?? "-").padEnd(10)} | [${r.clave}] ${r.nombre}`)
    }
    // Distribución por etiqueta, para ver amontonamientos
    const conteo = {}
    for (const r of filas) conteo[r.etiqueta] = (conteo[r.etiqueta] || 0) + 1
    lineas.push("", "Distribución: " + Object.entries(conteo).map(([k, v]) => `${k}: ${v}`).join(" · "))
    return lineas.join("\n")
}

module.exports = { reporteCalibracion, tablaCalibracion }
