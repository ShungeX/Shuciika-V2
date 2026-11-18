const path = require("path");
const crearCargador = require('./cargarHandlers');

module.exports = crearCargador(path.join(__dirname, "..", "interaction", "buttons"), "botón");
