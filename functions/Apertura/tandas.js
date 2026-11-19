// functions/Apertura/tandas.js
// Procesa una lista en tandas de N elementos por segundo. discord.js ya respeta
// los rate limits, pero mandar cientos de MD de golpe llena su cola y dispara el
// límite global; a ~10 por segundo, unos cientos de usuarios son segundos.

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Promise<void>} fn  no debe lanzar (si lanza, se registra y se sigue)
 * @param {{ porSegundo?: number, alTerminarTanda?: (hechos: number) => Promise<void>|void }} [opciones]
 */
async function enTandas(items, fn, { porSegundo = 10, alTerminarTanda } = {}) {
    const tam = Math.min(15, Math.max(5, Number(porSegundo) || 10));
    let hechos = 0;
    for (let i = 0; i < items.length; i += tam) {
        const inicio = Date.now();
        const tanda = items.slice(i, i + tam);
        const resultados = await Promise.allSettled(tanda.map(fn));
        for (const r of resultados) {
            if (r.status === 'rejected') console.error('[tandas] Elemento falló:', r.reason?.message || r.reason);
        }
        hechos += tanda.length;
        if (alTerminarTanda) await alTerminarTanda(hechos);
        const resto = 1000 - (Date.now() - inicio);
        if (i + tam < items.length && resto > 0) await esperar(resto);
    }
    return hechos;
}

module.exports = { enTandas };
