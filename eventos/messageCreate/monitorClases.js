const { puntuarMensaje } = require('../../functions/clases/evaluadorClases');

/**
 * Evento messageCreate para monitoreo y puntuación de clases en tiempo real.
 * Si el canal no pertenece a una clase activa, la comprobación se descarta de inmediato en memoria.
 * 
 * @param {import('discord.js').Client} client 
 * @param {import('discord.js').Message} message 
 */
module.exports = async (client, message) => {
    if (!message || !message.channelId) return;
    puntuarMensaje(message);
};
