// /rol buzon — el buzón del personaje activo: regalos, cartas, paquetes y avisos
// del sistema en una sola bandeja (config/buzon.js). Siempre efímero.
const { SlashCommandSubcommandBuilder } = require("discord.js")
const cfg = require("../../../../config/buzon")
const P = require("../../../../functions/Regalos/pantallas")

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("buzon")
        .setDescription("Abre tu buzón: regalos, cartas y avisos")
        .addStringOption(o => o
            .setName("tipo")
            .setDescription("Muestra solo un tipo")
            .addChoices(...Object.entries(cfg.TIPOS).map(([value, t]) => ({ name: `${t.emoji} ${t.nombre}`, value }))))
        .addBooleanOption(o => o
            .setName("todo")
            .setDescription("Incluir lo que ya abriste o leíste")),

    requirements: {
        character: { obtener: true, required: true },
    },
    isDevOnly: false,
    enMantenimiento: false,

    /**
     * @param {import("discord.js").Client} client
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    ejecutar: async (client, interaction, { character }) => {
        const tipo = interaction.options.getString("tipo") || "todos"
        const vista = interaction.options.getBoolean("todo") ? "todo" : "nuevos"
        await interaction.deferReply({ flags: ["Ephemeral"] })
        const componentes = await P.buzon({ userId: interaction.user.id, personaje: character, vista, tipo })
        return interaction.editReply({ components: componentes, flags: ["IsComponentsV2"], allowedMentions: { parse: [] } })
    },
}
