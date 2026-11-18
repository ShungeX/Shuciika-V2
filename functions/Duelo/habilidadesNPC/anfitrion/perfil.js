// ─── El Anfitrión: perfil de hábitos (reglas puras) ──────────────────────────
// Cada turno del jugador se guarda por categoría (XI). El Anfitrión no copia tus ataques: copia
// tus hábitos. Se mide al personaje, nunca a la persona detrás de la pantalla.

const { ANFITRION } = require("./config")

/** Categorías de acción y cómo las nombra la voz. */
const CATEGORIAS = Object.freeze({
    golpe: "golpear",
    guardia: "cubrirte",
    hechizo_dano: "lanzar hechizos de daño",
    hechizo_cura: "curarte",
    hechizo_apoyo: "usar hechizos de apoyo",
    objeto: "usar objetos",
    elemento: "cambiar de elemento",
})

/** Categoría de un hechizo según lo que hace. */
function categoriaHechizo(h) {
    const m = h?.Mecanicas || {}
    if (m.damage && (Number(m.damage.base) > 0 || m.damage.scaling)) return "hechizo_dano"
    if (m.healing && (Number(m.healing.base) > 0 || m.healing.scaling)) return "hechizo_cura"
    return "hechizo_apoyo"
}

function perfilDeTurno(acciones) {
    const p = {}
    for (const a of acciones) p[a.categoria] = (p[a.categoria] || 0) + 1
    return p
}

/** XI: predicción ponderada sobre los últimos VENTANA turnos. */
function predecir(historial = []) {
    const ultimos = historial.slice(-ANFITRION.VENTANA)
    const pesos = ANFITRION.PESOS.slice(-ultimos.length)
    const score = {}
    ultimos.forEach((perfil, i) => {
        for (const [cat, n] of Object.entries(perfil)) score[cat] = (score[cat] || 0) + n * pesos[i]
    })
    const total = Object.values(score).reduce((a, b) => a + b, 0) || 1
    const [mejor, valor] = Object.entries(score).sort((a, b) => b[1] - a[1])[0] || [null, 0]
    return { prediccion: mejor, confianza: valor / total }
}

/** Perfil conjunto del grupo: los últimos VENTANA turnos de cada jugador, sumados por posición. */
function historialConjunto(jugadores = []) {
    const out = []
    for (let i = 0; i < ANFITRION.VENTANA; i++) {
        const perfil = {}
        for (const j of jugadores) {
            const h = (j.perfilTurnos || []).slice(-ANFITRION.VENTANA)
            const t = h[i - (ANFITRION.VENTANA - h.length)]
            if (!t) continue
            for (const [c, n] of Object.entries(t)) perfil[c] = (perfil[c] || 0) + n
        }
        if (Object.keys(perfil).length) out.push(perfil)
    }
    return out
}

/** Claves (ataque, guardia, hechizo:ID, objeto:REG:ID) más usadas en los últimos 5 turnos. */
function masUsadas(pj, excluir = []) {
    const cuenta = {}
    for (const t of (pj?.clavesTurnos || []).slice(-ANFITRION.VENTANA)) {
        for (const k of t) if (!excluir.includes(k)) cuenta[k] = (cuenta[k] || 0) + 1
    }
    return Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

/** Opciones que el jugador usó menos en todo el combate (empates incluidos). */
function menosUsadas(opciones = [], usos = {}) {
    if (!opciones.length) return []
    const min = Math.min(...opciones.map(o => Number(usos[o]) || 0))
    return opciones.filter(o => (Number(usos[o]) || 0) === min)
}

/** Categoría que más repite y la que nunca (o casi nunca) usa, sobre el combate entero. */
function rasgos(pj) {
    const usos = pj?.usosCategoria || {}
    const orden = Object.entries(usos).sort((a, b) => b[1] - a[1])
    const masUsada = orden[0]?.[0] ?? null
    const evitada = Object.keys(CATEGORIAS).filter(c => c !== "elemento" || pj?.desafinado).find(c => !(usos[c] > 0)) ?? orden.at(-1)?.[0] ?? null
    return { masUsada, evitada }
}

/** Repitió la misma categoría en sus dos últimos turnos. */
function repite(pj) {
    const [a, b] = (pj?.perfilTurnos || []).slice(-2)
    if (!a || !b) return false
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === 1 && kb.length === 1 && ka[0] === kb[0]
}

/** Confianza del Anfitrión en un jugador concreto (para elegir al más predecible del grupo). */
const confianzaEn = (pj) => predecir(pj?.perfilTurnos || []).confianza

// ─── Compás ──────────────────────────────────────────────────────────────────
// La cinta de acciones es el compás: en cada subturno actúa quien tiene valorCompas ≤ compasMax,
// y compasMax decae (×0.57) hasta cerrar la ronda. Más casillas = entrar en más escalones.

/** Escalones de compasMax en una ronda (1000, 570, 324, 184...). */
function nivelesCompas(decay = 0.57, max = 1000) {
    const niveles = []
    for (let c = max; c >= 1; c = Math.floor(c * decay)) niveles.push(c)
    return niveles
}

/** Casillas (acciones por ronda) de un valorCompas. */
const casillas = (valor, niveles) => niveles.filter(c => valor <= c).length

/** valorCompas que da `extra` casillas más (nunca uno peor que el que ya tiene). */
function valorConExtra(valor, extra, niveles) {
    if (!(extra > 0)) return valor
    const objetivo = Math.min(niveles.length, casillas(valor, niveles) + extra)
    return Math.min(valor, niveles[objetivo - 1])
}

module.exports = { nivelesCompas, casillas, valorConExtra, CATEGORIAS, categoriaHechizo, perfilDeTurno, predecir, historialConjunto, masUsadas, menosUsadas, rasgos, repite, confianzaEn }
