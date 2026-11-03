const { iniciarSnapshots } = require("../../functions/Economia/snapshotEconomia");

// Foto diaria del dinero (00:00 México), comprobación de cuadre y resumen de alertas al canal privado.
// Va en diferido para no retrasar el resto de clientReady.
module.exports = (client) => {
    setTimeout(() => iniciarSnapshots(client), 15_000);
};
