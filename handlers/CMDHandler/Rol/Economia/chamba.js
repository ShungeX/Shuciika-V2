const { SlashCommandSubcommandBuilder } = require("discord.js")
const juegos = require("../../../../functions/Economia/minijuegosTrabajo")

// /rol trabajar: abre el gafete de empleado del personaje activo (o la lista de empleos si no tiene puesto).
// El pago lo calcula functions/Economia/motorPago.js; puestos, renuncia y minijuegos viven en functions/Economia/minijuegosTrabajo.js
module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("trabajar")
        .setDescription("Trabaja para obtener algunos lumens [Beta]"),

    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false },
    },
    isDevOnly: false,
    enMantenimiento: false,

    /**
     * @param {import('discord.js').Client} client
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    ejecutar: async (client, interaction, { character, soul }) => {
        return juegos.abrirMenu(interaction, character, soul)
    },
}
