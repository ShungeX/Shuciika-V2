const clientdb = require("../../Server")
const { iniciarBarridoSlots } = require("../../functions/Premium/slotApoyo")

// Slot de personaje por apoyar: se entrega a los 14 días (nunca al instante). Al arrancar y cada hora,
// en diferido para no retrasar clientReady.
module.exports = (client) => {
    setTimeout(() => iniciarBarridoSlots(client, clientdb.db("Server_db").collection("usuarios_server")), 30_000);
};
