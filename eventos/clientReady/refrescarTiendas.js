const clientdb = require("../../Server");
const { guild } = require("../../config/configslash.json");
const { refrescarPaneles } = require("../../functions/mensajesServidor");

// Al arrancar, los paneles de tienda se redibujan si algún precio u objeto cambió mientras el bot estaba apagado.
// Va en diferido para no retrasar el resto de clientReady (los eventos se ejecutan en serie).
module.exports = (client) => {
    setTimeout(() => {
        refrescarPaneles(client, guild, clientdb.db("Server_db"), clientdb.db("Rol_db"))
            .catch(err => console.error("[Tiendas] Error refrescando paneles al arrancar:", err));
    }, 10_000);
};
