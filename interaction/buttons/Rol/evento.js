const { crearBoton } = require('../../../utils/constructores/crearComponente');
const dialogoManager = require('../../../functions/dialogoManager');

module.exports = crearBoton({
    customId: "evento",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: false },
        cachepj: { obtener: true, required: false }
    },

    ejecutar: async ({ client, interaction, character, componentData: { userId, characterId, extras } }) => {
        const eventoTipo = extras && extras.length > 0 ? extras[0] : null;

        if (eventoTipo === "bienvenida_rol") {
            // Deshabilitar el botón en el mensaje original para evitar clics duplicados
            try {
                if (interaction.message?.components?.length > 0) {
                    const clonedComponents = JSON.parse(JSON.stringify(interaction.message.components));
                    for (const row of clonedComponents) {
                        if (row.components && Array.isArray(row.components)) {
                            for (const comp of row.components) {
                                if (comp.type === 2) comp.disabled = false;
                            }
                        }
                    }
                    const updatePayload = { components: clonedComponents };
                    if (interaction.message.flags?.has?.("IsComponentsV2") || interaction.message.flags?.toArray?.()?.includes("IsComponentsV2")) {
                        updatePayload.flags = ["IsComponentsV2"];
                    }
                    await interaction.update(updatePayload).catch(() => {});
                }
            } catch (err) {
                console.error("[evento] Error desactivando botón en mensaje:", err.message);
            }

            const charId = characterId || character?._id;
            await dialogoManager.startDialogue("events", "bienvenida_instituto", interaction, interaction.user, {
                charId: charId,
                context: {
                    characterId: charId
                }
            });
            return;
        }

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Este evento ya no se encuentra disponible 〒▽〒", flags: ["Ephemeral"] });
        }
    }
});
