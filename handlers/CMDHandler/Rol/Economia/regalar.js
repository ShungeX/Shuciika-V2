// /rol regalar [personaje] — abre (efímero) el menú para enviar un regalo.
// Dentro se elige qué regalar (una Bolsa de regalo ya cerrada o un objeto
// suelto, más Lumens sin bolsa) y a quién (por ID o desde tus relaciones).
// Nada se descuenta hasta pulsar "Enviar" en la vista previa:
// functions/Regalos/menuRegalar.js → regalos.enviarRegalo.
const { SlashCommandSubcommandBuilder } = require("discord.js")
const M = require("../../../../functions/Regalos/menuRegalar")

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("regalar")
        .setDescription("Abre el menú para enviar un regalo al buzón de otro personaje")
        .addIntegerOption(o => o.setName("personaje").setDescription("Para quién es (opcional: también puedes elegirlo en el menú)").setAutocomplete(true)),

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
        await interaction.deferReply({ flags: ["Ephemeral"] })
        const userId = interaction.user.id
        const token = M.abrirMenu(userId, character._id)

        // Destinatario por adelantado (se valida igual que si lo escribiera en el menú)
        const pjId = interaction.options.getInteger("personaje")
        const aviso = pjId !== null ? await M.ponerDestino({ token, character, idTxt: String(pjId) }) : null

        const componentes = await M.pantallaMenu({ userId, token, character, aviso })
        return interaction.editReply({ components: componentes, flags: ["IsComponentsV2"], allowedMentions: { parse: [] } })
    },
}
