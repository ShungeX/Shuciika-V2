// ═══ CLIMA-HORARIO (API pública) ═══
// Reloj interno, fases, estaciones, clima por hora con persistencia, temperatura y noticiero.
// Fuera de alcance: cierre/apertura de canales y eventos nocturnos. Para eso, suscribirse a
// `eventos` ("cambioHora", "cambioFase", "cambioDia", "cambioEstacion", "cambioClima";
// payload { regionId, anterior, nuevo, estado }).
//
//   const clima = require("./functions/Clima");
//   const est = await clima.getEstado("TOB-001");
//   const prox = await clima.getPronostico("TOB-001", 12);

const estadoRegion = require("./estadoRegion");
const noticiero = require("./noticiero");
const { REGIONES, ESTADOS, FASES } = require("./config");

let iniciado = false;

/** Arranque desde clientReady: recupera horas perdidas, arma los ticks y reanuda los noticieros. */
async function iniciar(client) {
    if (iniciado) return;
    iniciado = true;
    noticiero.configurar(client);          // suscribirse ANTES de la recuperación
    await estadoRegion.iniciarTicks();
    for (const regionId of Object.keys(REGIONES)) {
        // El mensaje pudo quedar desfasado o borrado mientras el bot estaba apagado
        noticiero.actualizarNoticiero(regionId)
            .catch((err) => console.error(`[Clima] No se pudo reanudar el noticiero de ${regionId}:`, err));
    }
}

module.exports = {
    iniciar,
    eventos: estadoRegion.eventos,
    REGIONES, ESTADOS, FASES,
    getEstado: estadoRegion.getEstado,
    getPronostico: estadoRegion.getPronostico,
    ponerOverride: estadoRegion.ponerOverride,
    quitarOverride: estadoRegion.quitarOverride,
    reiniciarClima: estadoRegion.reiniciarClima,
    adelantarReloj: estadoRegion.adelantarReloj,
    infoAdmin: estadoRegion.infoAdmin,
    iniciarNoticiero: noticiero.iniciarNoticiero,
    detenerNoticiero: noticiero.detenerNoticiero,
    reenviarNoticiero: noticiero.reenviarNoticiero,
    actualizarNoticiero: noticiero.actualizarNoticiero
};
