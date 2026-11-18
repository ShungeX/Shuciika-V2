const { barrerHuerfanas } = require("../../functions/Aprendizaje/servicio");

// Aprendizaje: si el bot se reinició con prácticas abiertas, se devuelven esos intentos
// (no es culpa del jugador). Va en diferido para no retrasar clientReady.
module.exports = () => {
    setTimeout(async () => {
        try {
            const r = await barrerHuerfanas();
            if (r.revisadas) console.log(`[Aprendizaje] Prácticas huérfanas: ${r.revisadas} revisadas, ${r.devueltas} intentos devueltos.`);
        } catch (e) {
            console.error("[Aprendizaje] Error al revisar prácticas huérfanas:", e.message);
        }
    }, 15_000);
};
