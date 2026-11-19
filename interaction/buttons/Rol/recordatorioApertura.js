// Botón «🔔 Avísame cuando abra» de la carta pre-apertura.
// Alterna el recordatorio: MD una hora antes de la ceremonia y otro al sonar la Campana.

const { crearBoton } = require("../../../utils/constructores/crearComponente.js");
const apertura = require("../../../functions/Apertura/apertura");

module.exports = crearBoton({
    customId: "recordatorioApertura",
    soloAutor: true,
    optionNames: [""],

    ejecutar: async ({ interaction, componentData: { characterId } }) => {
        const userId = interaction.user.id;

        if (!apertura.preApertura()) {
            return interaction.reply({
                content: "¡Las puertas ya están abiertas! ヾ(•ω•)o\n-# Usa `/rol perfil` para empezar.",
                flags: ["Ephemeral"]
            });
        }

        if (await apertura.tieneRecordatorio(userId)) {
            await apertura.quitarRecordatorio(userId);
            return interaction.reply({
                content: "Listo, ya no te avisaré. (｡•́︿•̀｡)\n-# Pulsa el botón otra vez si cambias de opinión.",
                flags: ["Ephemeral"]
            });
        }

        await apertura.apuntarRecordatorio(userId, characterId && characterId !== "null" ? characterId : null);
        const T0 = apertura.estado.timestamp;
        return interaction.reply({
            content: "¡Apuntado! ♡( ◡‿◡ ) Te escribiré una hora antes de la ceremonia y cuando se abran las puertas."
                + (T0 ? `\n-# La ceremonia es el <t:${T0}:F>.` : ""),
            flags: ["Ephemeral"]
        });
    }
});
