// ─────────────────────────────────────────────────────────────────────────────
// Valor de un regalo: puntaje S (0–100) y puntos de amistad que da al abrirse.
//
// Cada pila (ítem o Lumens) recibe un puntaje; el regalo vale lo que su MEJOR
// pila (no la suma: así tres cosas baratas no superan a una buena).
//
//   S = 100 · Σ(w_i · c_i) / Σ(w_i)     sumando SOLO los factores disponibles
//   c_costo = clamp( ln(P / P_MIN) / ln(P_MAX / P_MIN), 0, 1 )
//   P = precio unitario × cantidad      (valor real gastado)
//
// Un factor que no existe para el ítem (p. ej. un material sin precio) se
// excluye y los pesos restantes se renormalizan: no se penaliza.
// El PESO del ítem NO entra al puntaje (mide cuánto ocupa, no cuánto vale).
//
// Calibrar con functions/Regalos/calibracion.js → reporteCalibracion().
// Se ajustan los pesos y P_MIN / P_MAX, no la fórmula.
// ─────────────────────────────────────────────────────────────────────────────
const { leerItem } = require("../functions/Regalos/leerItem")
const { ETIQUETAS } = require("./mensajesRegalos")

const PESOS = {
    costo: 0.35,                                                                    // ⚙
    rareza: 0.30,                                                                   // ⚙
    bonusPasivo: 0.20,                                                              // ⚙
    evento: 0.15,                                                                   // ⚙
}

// Rango de precios de referencia (escala logarítmica).
const P_MIN = 10                                                                    // ⚙ PROVISIONAL
const P_MAX = 3000                                                                  // ⚙ PROVISIONAL

// Nivel de rareza → c. Claves normalizadas (minúsculas, sin acentos) como las
// devuelve leerItem(). Una rareza que no esté aquí excluye el factor.
// TODO(decisión): orden real de las rarezas. ¿NIX es la más alta?
const RAREZAS = {
    comun: 0,                                                                       // ⚙ PROVISIONAL
    luminoso: 0.2,                                                                  // ⚙ PROVISIONAL
    resonante: 0.4,                                                                 // ⚙ PROVISIONAL
    arcano: 0.65,                                                                   // ⚙ PROVISIONAL
    divino: 0.85,                                                                   // ⚙ PROVISIONAL
    nix: 1,                                                                         // ⚙ PROVISIONAL
}

// Filtro opcional para frenar ítems diminutos si tras calibrar queda una
// rendija. null = desactivado. Si se activa, una pila cuyo peso total sea menor
// vale S = 0.
const PESO_MIN_FILTRO = null                                                        // ⚙

// ─── Puntos de amistad ───────────────────────────────────────────────────────
//   puntos = round( P_MAX_AMISTAD · (S / 100)^GAMMA )
const P_MAX_AMISTAD = 12                                                            // ⚙
const GAMMA = 1.5                                                                   // ⚙
const S_MIN = 10   // por debajo, 0 puntos                                          // ⚙
// Solo se suma si el regalo YA da puntos (> 0): así "bolsita + ítem barato" no
// sirve para farmear.
const BONUS_BOLSA = 2                                                               // ⚙ PROVISIONAL

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const redondear1 = (x) => Math.round(x * 10) / 10

function cCosto(P) {
    if (!(P > 0)) return null
    return clamp01(Math.log(P / P_MIN) / Math.log(P_MAX / P_MIN))
}

/** Combina los factores disponibles en S (0–100). */
function combinar(factores) {
    let num = 0, den = 0
    for (const [nombre, c] of Object.entries(factores)) {
        if (c === null || c === undefined) continue
        const w = PESOS[nombre] || 0
        num += w * c
        den += w
    }
    return den > 0 ? redondear1(100 * num / den) : 0
}

/**
 * Puntaje de una pila.
 * @param {{ def?: Object, cantidad?: number, lumens?: number }} pila
 *   Ítem: { def, cantidad }. Lumens: { lumens }.
 * @returns {{ S: number, factores: Object, sustituido?: boolean, tipo: "item"|"lumens", nombre: string }}
 */
function puntuarPila(pila) {
    if (pila.lumens !== undefined) {
        // Lumens: solo el factor costo (P = monto)
        const factores = { costo: cCosto(Number(pila.lumens)) }
        return { tipo: "lumens", nombre: `${pila.lumens} Lumens`, S: combinar(factores), factores }
    }

    const info = leerItem(pila.def)
    const cantidad = Math.max(1, Number(pila.cantidad) || 1)
    if (!info) return { tipo: "item", nombre: "?", S: 0, factores: {} }

    // valorRegalo SUSTITUYE el cálculo (ítems del lore y casos especiales)
    if (info.valorRegalo !== null) {
        return { tipo: "item", nombre: info.nombre, S: info.valorRegalo, factores: { valorRegalo: info.valorRegalo }, sustituido: true }
    }

    if (PESO_MIN_FILTRO !== null && info.peso * cantidad < PESO_MIN_FILTRO) {
        return { tipo: "item", nombre: info.nombre, S: 0, factores: { filtroPeso: true } }
    }

    const factores = {
        costo: info.precio ? cCosto(info.precio * cantidad) : null,
        rareza: info.rareza !== null && RAREZAS[info.rareza] !== undefined ? RAREZAS[info.rareza] : null,
        bonusPasivo: info.bonusPasivo,
        evento: info.evento,
    }
    return { tipo: "item", nombre: info.nombre, S: combinar(factores), factores }
}

/**
 * Puntaje del regalo = su mejor pila.
 * @param {Array<{ def?: Object, cantidad?: number, lumens?: number, excluir?: boolean }>} pilas
 *   `excluir`: la pila se entrega pero no puntúa (antiabuso: reciclado, ping-pong de Lumens).
 * @returns {{ S: number, etiqueta: string, factores: Object, mejor: string|null, pilas: Object[] }}
 */
function puntuarRegalo(pilas) {
    const evaluadas = pilas.map(p => ({ ...puntuarPila(p), excluida: Boolean(p.excluir) }))
    const validas = evaluadas.filter(p => !p.excluida)
    const mejor = validas.reduce((a, b) => (b.S > (a?.S ?? -1) ? b : a), null)
    const S = mejor?.S ?? 0
    return { S, etiqueta: etiquetaDe(S), factores: mejor?.factores ?? {}, mejor: mejor?.nombre ?? null, pilas: evaluadas }
}

function etiquetaDe(S) {
    return (ETIQUETAS.find(e => S >= e.min) || ETIQUETAS[ETIQUETAS.length - 1]).texto
}

/**
 * Puntos de amistad que propone el regalo (antes del tope diario y los
 * retornos menguantes, que aplica el sistema de amistad).
 * Nunca negativos.
 */
function puntosAmistad(S, conBolsa = false) {
    if (!(S >= S_MIN)) return 0
    const base = Math.round(P_MAX_AMISTAD * Math.pow(S / 100, GAMMA))
    if (base <= 0) return 0
    return base + (conBolsa ? BONUS_BOLSA : 0)
}

module.exports = {
    PESOS,
    P_MIN,
    P_MAX,
    RAREZAS,
    PESO_MIN_FILTRO,
    P_MAX_AMISTAD,
    GAMMA,
    S_MIN,
    BONUS_BOLSA,
    puntuarPila,
    puntuarRegalo,
    etiquetaDe,
    puntosAmistad,
}
