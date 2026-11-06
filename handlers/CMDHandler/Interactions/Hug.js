// /interact hug — la lógica, textos y gifs viven en functions/Amistad/ (accionesInteraccion.js).
const ejecutarInteraccion = require("../../../functions/Amistad/ejecutarInteraccion")

/**
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
module.exports = (client, interaction) => ejecutarInteraccion(client, interaction, "hug")
