const { performance } = require("perf_hooks")
const { obtenerDiagnostico } = require("../../../functions/diagnostico")
const { menuPing } = require("../../../data/UI_ComponentsV2/menuPing")

// Botón "Volver a medir" del comando /ping
module.exports = {
    customId: "ping_button",
    soloAutor: true,

    /**
     * @param {{ client: import('discord.js').Client, interaction: import('discord.js').ButtonInteraction }} param0
     */
    ejecutar: async ({ client, interaction }) => {
        // Tiempo que tarda Discord en confirmar la respuesta del bot (ida y vuelta por HTTP)
        const inicio = performance.now()
        const internoMs = interaction.recibidaEn != null ? inicio - interaction.recibidaEn : null
        await interaction.deferUpdate()
        const confirmacionMs = performance.now() - inicio
        const respuestaMs = confirmacionMs + (internoMs || 0)

        const diagnostico = await obtenerDiagnostico(client)

        await interaction.editReply({
            components: menuPing(diagnostico, { userId: interaction.user.id, respuestaMs, internoMs, confirmacionMs }),
            flags: ["IsComponentsV2"],
            allowedMentions: { parse: [] },
        })
    }
};
