const { ChatInputCommandInteraction } = require(`discord.js`)
const { SlashCommandBuilder } = require("@discordjs/builders")
const { obtenerDiagnostico } = require("../../functions/diagnostico")
const { menuPing } = require("../../data/UI_ComponentsV2/menuPing")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Comprueba la latencia y el estado de Navi.")
        .setContexts(['Guild']),

    /**
     * @param {import('discord.js').Client} client
     * @param {ChatInputCommandInteraction} interaction
     */
    ejecutar: async (client, interaction) => {
        // Desglose: lo que tarda el bot en empezar a responder y lo que tarda Discord en confirmar
        const antes = performance.now()
        const internoMs = interaction.recibidaEn != null ? antes - interaction.recibidaEn : null
        await interaction.deferReply();
        const confirmacionMs = performance.now() - antes

        // Ambas marcas de tiempo las pone Discord (no el reloj de este equipo): es el tiempo real
        // desde que el usuario envió el comando hasta que Discord registró la respuesta del bot.
        const respuesta = await interaction.fetchReply();
        const respuestaMs = respuesta.createdTimestamp - interaction.createdTimestamp

        const diagnostico = await obtenerDiagnostico(client)

        await interaction.editReply({
            components: menuPing(diagnostico, { userId: interaction.user.id, respuestaMs, internoMs, confirmacionMs }),
            flags: ["IsComponentsV2"],
            allowedMentions: { parse: [] },
        })
    },

    deleted: false,
}
