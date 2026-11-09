// ═══ CLIMA-HORARIO: azar determinista ═══
// Todo el azar del motor sale de aquí: misma (región, hora, propósito) = mismo número.
// Por cada combinación se siembra de nuevo y se usa SOLO el primer número.
// Propósitos: "regimen-inercia", "regimen-sorteo", "trans", "dur", "temp".

/** FNV-1a de 32 bits. Devuelve un uint32. */
function fnv1a32(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** PRNG mulberry32 sembrado con un uint32. */
function mulberry32(semilla) {
    let a = semilla >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Número en [0, 1) para (región, hora, propósito). */
function azar(regionId, horaIndex, proposito) {
    return mulberry32(fnv1a32(`${regionId}:${horaIndex}:${proposito}`))();
}

/** Entero en [min, max] a partir de u ∈ [0, 1). */
function enteroEntre(u, min, max) {
    return min + Math.min(max - min, Math.floor(u * (max - min + 1)));
}

/**
 * Sorteo ponderado con un solo número u ∈ [0, 1).
 * @param {Array<[string, number]>} opciones pares [clave, peso]; pesos <= 0 se ignoran
 * @returns {string|null} null si ningún peso es positivo
 */
function sorteoPonderado(opciones, u) {
    const validas = opciones.filter(([, p]) => p > 0);
    const total = validas.reduce((s, [, p]) => s + p, 0);
    if (total <= 0) return null;
    let objetivo = u * total;
    for (const [clave, peso] of validas) {
        objetivo -= peso;
        if (objetivo < 0) return clave;
    }
    return validas[validas.length - 1][0];
}

module.exports = { fnv1a32, mulberry32, azar, enteroEntre, sorteoPonderado };
