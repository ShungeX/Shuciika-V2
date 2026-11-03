// interaction/eventos/bienvenida_rol.js
// customId: evento-<userId>-<characterId>-bienvenida_rol

const dialogoManager = require('../../functions/dialogoManager');

module.exports = {
    id: "bienvenida_rol",

    // Sin acción en el customId: se ejecuta la acción por defecto
    acciones: {
        default: async ({ interaction, character, componentData: { characterId } }) => {
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
                    await interaction.update(updatePayload).catch(() => { });
                }
            } catch (err) {
                console.error("[evento:bienvenida_rol] Error desactivando botón en mensaje:", err.message);
            }

            const charId = characterId || character?._id;
            await dialogoManager.startDialogue("events", "bienvenida_instituto", interaction, interaction.user, {
                charId: charId,
                context: {
                    characterId: charId
                }
            });
        }
    }
};
