const { calcularNivelJugador } = require("../Duelo/combatientes");
const { leerProgreso } = require("../Economia/progresionEstelar");

// ─── Probabilidad de huida (ajustable) ───────────────────────────────────────
// Jugador y enemigo se comparan en la MISMA escala logarítmica (calcularNivelJugador):
// FE totales del jugador contra el nivel del NPC. Cada punto de diferencia
// equivale aprox. a duplicar el valor del otro.
const HUIDA = {
    BASE: 0.60,              // mismo nivel, mismas stats, dificultad 0 → 60%
    POR_NIVEL: 0.10,         // ±10% por cada nivel de diferencia
    POR_AGILIDAD: 0.015,     // ±1.5% por punto de agilidad de diferencia
    POR_INTELIGENCIA: 0.005, // ±0.5% por punto de inteligencia de diferencia
    PESO_DIFICULTAD: 0.50,   // restrictions.probabilidadEscape (0-1): 0.1 → -5%, 0.3 → -15%
    PENALIZACION_JEFE: 0.15,
    PISO: 0.05,
    TECHO: 0.95,
};

/** Acepta 0.1 (fracción, como está en la BD) o 10 (porcentaje) */
function normalizarDificultad(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(1, n > 1 ? n / 100 : n);
}

/**
 * Probabilidad de escapar de un enemigo.
 * Antes: solo usaba agilidad/inteligencia y dividía probabilidadEscape (0.1) entre 100,
 * así que el término de dificultad aportaba siempre ~60% y el nivel no influía → ~75% fijo.
 */
function getEscapeP(soul, enemy) {
    const stats = soul?.stats || {};
    const statsE = enemy?.stats || {};

    const nivelJugador = calcularNivelJugador(leerProgreso(soul || {}).ganados);
    const nivelEnemigo = calcularNivelJugador(Number(enemy?.nivel ?? enemy?.restrictions?.fe_min) || 0);

    const agilidad = Number(stats.agilidad ?? soul?.agilidad ?? 1) || 0;
    const inteligencia = Number(stats.inteligencia ?? soul?.inteligencia ?? 1) || 0;
    const agilidadE = Number(statsE.agilidad ?? 1) || 0;
    const inteligenciaE = Number(statsE.inteligencia ?? 1) || 0;

    const dificultad = normalizarDificultad(enemy?.restrictions?.probabilidadEscape);
    const esJefe = enemy?.isBoss || String(enemy?.Type || enemy?.tipo || "").toLowerCase() === "boss";

    let p = HUIDA.BASE
        + (nivelJugador - nivelEnemigo) * HUIDA.POR_NIVEL
        + (agilidad - agilidadE) * HUIDA.POR_AGILIDAD
        + (inteligencia - inteligenciaE) * HUIDA.POR_INTELIGENCIA
        - dificultad * HUIDA.PESO_DIFICULTAD
        - (esJefe ? HUIDA.PENALIZACION_JEFE : 0);

    p = Math.max(HUIDA.PISO, Math.min(HUIDA.TECHO, p));

    return { value: p, porcentaje: Math.round(p * 100), nivelJugador, nivelEnemigo };
}

module.exports = { getEscapeP, HUIDA };
