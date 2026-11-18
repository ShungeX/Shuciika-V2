// ─── Aprendizaje: reglas puras (sin Discord ni base de datos) ────────────────
// Un hechizo se aprende en el alma. La puerta es el Resplandor, la llave es una página del
// hechizo, y para dominarla hay que practicar cada vía que exige, con un minijuego por vía.
//
// Dónde vive cada dato (Soul.aprendizaje):
//   practicas: { "Aqua-002": { hablado: 0.3, movimiento: 0 } }   progreso por vía (0..1)
//   hoy: { fecha: "2026-11-09", n: 1 }                            límite diario (fecha local)
//   cooldownHasta: 1731180000000                                   tras un intento fallido
//   activa: { id, hechizo, via, inicio, expira, instancia }        práctica en curso (bloqueo en BD)
// Al aprenderlo: Soul.dominio.hechizos recibe { ID, InCombat, usos: 0, maestria: 1 } y se borra
// la entrada de practicas. La práctica NO da Maestría: esa sale solo del uso en combate.

const { DateTime } = require("luxon")
const { PRACTICA, RESPLANDOR_MIN, DIFICULTAD, PAGINAS, UI } = require("./config")
const { ESCALONES, VIAS } = require("../Duelo/hechizos/config")
const { normalizarElemento, esUniversal, quitarTildes } = require("../Duelo/hechizos/elementos")
const { resplandorANumero, leerProgreso } = require("../Economia/progresionEstelar")

const VIAS_PRACTICABLES = Object.freeze([VIAS.HABLADO, VIAS.MOVIMIENTO, VIAS.ESCRITURA, VIAS.MENTAL])

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Fecha local (YYYY-MM-DD) en la zona horaria configurada: el límite diario se reinicia por fecha. */
function fechaLocal(ahora = Date.now()) {
    return DateTime.fromMillis(ahora).setZone(PRACTICA.ZONA_HORARIA).toISODate()
}

// ─── Hechizo ─────────────────────────────────────────────────────────────────

/** Escalón efectivo para el aprendizaje: los universales se tratan como una Nota. */
const escalonDe = (hechizo) => (esUniversal(hechizo) ? 1 : Number(hechizo?.Escalon) || 1)

const nombreEscalon = (hechizo) => (esUniversal(hechizo) ? "Universal" : ESCALONES[escalonDe(hechizo)]?.nombre ?? "Nota")

/** Vías que exige el hechizo (las de su cast; instinto no se practica). */
function viasDe(hechizo) {
    const vias = hechizo?.Mecanicas?.cast?.vias ?? []
    return [...new Set(vias.map(v => String(v).toLowerCase()))].filter(v => VIAS_PRACTICABLES.includes(v))
}

/** Resplandor que pide el hechizo: el mayor entre su Req y el del escalón. */
function resplandorRequerido(hechizo) {
    const req = Number(hechizo?.Req?.resplandor_min) || 1
    return Math.max(req, RESPLANDOR_MIN[escalonDe(hechizo)] ?? 1)
}

/** Fragmentos Estelares ganados que pide el hechizo (Req.fe_min; 0 si no pide). */
const fragmentosRequeridos = (hechizo) => Math.max(0, Number(hechizo?.Req?.fe_min) || 0)

const dificultad = (hechizo, via) => DIFICULTAD[escalonDe(hechizo)]?.[via] ?? DIFICULTAD[1][via]

// ─── Progreso ────────────────────────────────────────────────────────────────

/**
 * Aplica un intento a una vía. Aprobar la completa; fallar enseña una parte proporcional
 * (máximo GANANCIA_MAX_FALLO). Devuelve una copia.
 * @param {Object} prog - { hablado: 0..1, ... }
 * @param {string} via
 * @param {number} puntaje - 0..1
 */
function aplicarPractica(prog, via, puntaje) {
    const p = { ...(prog || {}) }
    const s = Math.max(0, Math.min(1, Number(puntaje) || 0))
    if (s >= PRACTICA.UMBRAL_APROBADO) p[via] = 1
    else p[via] = Math.min(1, (Number(p[via]) || 0) + PRACTICA.GANANCIA_MAX_FALLO * (s / PRACTICA.UMBRAL_APROBADO))
    return p
}

const hechizoAprendido = (prog, vias) => vias.length > 0 && vias.every(v => (Number(prog?.[v]) || 0) >= 1)

const aprobado = (puntaje) => (Number(puntaje) || 0) >= PRACTICA.UMBRAL_APROBADO

// ─── Estado del alma ─────────────────────────────────────────────────────────

const aprendizajeDe = (soul) => soul?.aprendizaje || {}

/** Prácticas usadas hoy (0 si el registro es de otro día). */
function usadasHoy(soul, ahora = Date.now()) {
    const hoy = aprendizajeDe(soul).hoy
    return hoy?.fecha === fechaLocal(ahora) ? Number(hoy.n) || 0 : 0
}

const restantesHoy = (soul, ahora = Date.now()) => Math.max(0, PRACTICA.PRACTICAS_POR_DIA - usadasHoy(soul, ahora))

/** Milisegundos de cooldown que faltan (0 si no hay). */
function cooldownRestante(soul, ahora = Date.now()) {
    const hasta = Number(aprendizajeDe(soul).cooldownHasta) || 0
    return Math.max(0, hasta - ahora)
}

const conoceHechizo = (soul, id) => (soul?.dominio?.hechizos || []).some(h => String(h?.ID ?? h?.id ?? h) === String(id))

const progresoDe = (soul, id) => ({ ...(aprendizajeDe(soul).practicas?.[id] || {}) })

/** Un afinado no eligió ser un Alma Desafinada en el Despertar (no depende de ninguna bandera). */
const esAfinado = (soul) => soul?.nucleo?.artefactoMagico !== true

// ─── Validaciones al usar una página (2.2, en este orden) ────────────────────

function fallo(motivo, extra = {}) {
    return { ok: false, motivo, ...extra }
}

/**
 * Las seis validaciones al usar una página. `practicaActiva` y el estado del bloqueo los
 * resuelve el servicio (en memoria y en BD); aquí solo se mira lo que dice el alma.
 * @param {Object} p
 * @param {Object|null} p.hechizo - normalizado (null si no existe)
 * @param {boolean} p.tienePagina
 * @param {Object} p.soul
 * @param {boolean} [p.practicaActiva] - hay una práctica en curso de este personaje
 * @param {boolean} [p.paraPracticar] - además exige intentos y sin cooldown (al pulsar Practicar)
 */
function validarPagina({ hechizo, tienePagina, soul, practicaActiva = false, paraPracticar = false, ahora = Date.now() }) {
    // 1. Página en el inventario y hechizo existente y activo
    if (!tienePagina) return fallo("sin_pagina")
    if (!hechizo || hechizo.isActive === false) return fallo("hechizo_inexistente")
    // 2. No aprendido ya (la página no se consume)
    if (conoceHechizo(soul, hechizo._id)) return fallo("ya_aprendido")
    // 3. Resplandor
    const requerido = resplandorRequerido(hechizo)
    const actual = resplandorANumero(soul?.sendero?.resplandor ?? "I")
    if (actual < requerido) return fallo("resplandor", { requerido, actual })
    // 3b. Fragmentos Estelares GANADOS (el total histórico: gastarlos en stats no bloquea hechizos)
    const feRequeridos = fragmentosRequeridos(hechizo)
    const feGanados = leerProgreso(soul || {}).ganados
    if (feGanados < feRequeridos) return fallo("fragmentos", { requerido: feRequeridos, actual: feGanados })
    // 4. Elemento: un afinado solo su elemento (y universales); un desafinado, cualquiera
    if (esAfinado(soul) && !esUniversal(hechizo)
        && normalizarElemento(hechizo.Elemento) !== normalizarElemento(soul?.nucleo?.Elemento)) {
        return fallo("elemento", { elemento: normalizarElemento(hechizo.Elemento) })
    }
    if (!viasDe(hechizo).length) return fallo("sin_vias")
    if (!paraPracticar) return { ok: true }
    // 5. Otra práctica activa
    if (practicaActiva) return fallo("practica_activa")
    // 6. Límite diario y cooldown
    if (restantesHoy(soul, ahora) <= 0) return fallo("limite_diario")
    const cd = cooldownRestante(soul, ahora)
    if (cd > 0) return fallo("cooldown", { restanteMs: cd })
    return { ok: true }
}

// ─── Generación determinista ─────────────────────────────────────────────────
// Cada contenido sale de una semilla (hechizo._id + vía): un hechizo siempre tiene los mismos
// gestos. Es su "firma" y puede mostrarse en la narración del combate.

function xmur3(str) {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0 }
}
function mulberry32(a) {
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
const rngDe = (semilla) => mulberry32(xmur3(String(semilla))())
const entero = (rng, n) => Math.floor(rng() * n)

/** Secuencia de gestos (índices en la lista de gestos) de un hechizo. */
function secuenciaGestos(hechizo, pasos, totalGestos) {
    const rng = rngDe(`${hechizo._id}movimiento`)
    return Array.from({ length: pasos }, () => entero(rng, totalGestos))
}

/** Rondas del minijuego mental: tamaño de la cuadrícula, par de glifos y posición del distinto. */
function rondasMental(hechizo, rondas, { pares, cuadriculas }) {
    return Array.from({ length: rondas }, (_, r) => {
        const rng = rngDe(`${hechizo._id}mental${r}`)
        const [filas, columnas] = cuadriculas[Math.min(cuadriculas.length - 1, Math.floor(r * cuadriculas.length / Math.max(1, rondas)))]
        const total = filas * columnas
        return { filas, columnas, par: pares[entero(rng, pares.length)], distinto: entero(rng, total) }
    })
}

/** Sello de escritura: nodos distintos en orden (no necesariamente adyacentes) de la cuadrícula. */
function selloEscritura(hechizo, nodos, { filas, columnas }) {
    const rng = rngDe(`${hechizo._id}escritura`)
    const total = filas * columnas
    const libres = Array.from({ length: total }, (_, i) => i)
    const camino = []
    // Arranca en un nodo cualquiera y prefiere saltos cortos: el sello se ve como un trazo
    let actual = entero(rng, total)
    for (let k = 0; k < Math.min(nodos, total); k++) {
        if (k > 0) {
            const [f0, c0] = [Math.floor(actual / columnas), actual % columnas]
            const cerca = libres.filter(n => Math.max(Math.abs(Math.floor(n / columnas) - f0), Math.abs((n % columnas) - c0)) <= 2)
            const pool = cerca.length ? cerca : libres
            actual = pool[entero(rng, pool.length)]
        }
        camino.push(actual)
        libres.splice(libres.indexOf(actual), 1)
    }
    return camino
}

// ─── Puntajes (siempre en el servidor) ───────────────────────────────────────

/** Minúsculas, sin acentos, sin puntuación, espacios colapsados. */
function normalizarTexto(t) {
    return quitarTildes(t).replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim()
}

function levenshtein(a, b) {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
        const cur = [i]
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        }
        prev = cur
    }
    return prev[b.length]
}

/** Hablado: 1 − distancia de Levenshtein / longitud, sobre texto normalizado. */
function puntajeHablado(correcto, respuesta) {
    const a = normalizarTexto(correcto)
    const b = normalizarTexto(respuesta)
    if (!a.length) return 0
    return Math.max(0, 1 - levenshtein(a, b) / Math.max(a.length, b.length))
}

/** Movimiento / escritura: aciertos en su posición / total (no termina al primer error). */
function puntajePosicional(correcto, respuesta) {
    if (!correcto.length) return 0
    let ok = 0
    for (let i = 0; i < correcto.length; i++) if (respuesta[i] === correcto[i]) ok++
    return ok / correcto.length
}

const contarPalabras = (t) => normalizarTexto(t).split(" ").filter(Boolean).length

// ─── Presentación ────────────────────────────────────────────────────────────

function barraProgreso(fraccion, largo = UI.BARRA_LARGO) {
    const f = Math.max(0, Math.min(1, Number(fraccion) || 0))
    const llenos = Math.round(f * largo)
    return `${UI.BARRA.lleno.repeat(llenos)}${UI.BARRA.vacio.repeat(largo - llenos)} ${Math.floor(f * 100)}%`
}

function formatoDuracion(ms) {
    const min = Math.ceil(ms / 60000)
    if (min < 60) return `${min} min`
    return `${Math.floor(min / 60)} h ${min % 60} min`
}

/** ¿Es una definición de ítem página? (Tipo incluye "Página" y apunta a un hechizo) */
function esDefinicionPagina(def) {
    if (!def?.hechizo) return false
    const tipos = (Array.isArray(def.Tipo) ? def.Tipo : [def.Tipo]).filter(Boolean)
    return tipos.includes(PAGINAS.TIPO) || def.tipo === "pagina"
}

module.exports = {
    VIAS_PRACTICABLES,
    fechaLocal, escalonDe, nombreEscalon, viasDe, resplandorRequerido, fragmentosRequeridos, dificultad,
    aplicarPractica, hechizoAprendido, aprobado,
    aprendizajeDe, usadasHoy, restantesHoy, cooldownRestante, conoceHechizo, progresoDe, esAfinado,
    validarPagina,
    xmur3, mulberry32, rngDe, secuenciaGestos, rondasMental, selloEscritura,
    normalizarTexto, levenshtein, puntajeHablado, puntajePosicional, contarPalabras,
    barraProgreso, formatoDuracion, esDefinicionPagina,
}
