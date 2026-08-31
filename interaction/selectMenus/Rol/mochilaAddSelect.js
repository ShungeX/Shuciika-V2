const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../utils/constructores/customId");
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = crearStringSelectMenu({
    customId: "mochilaAddSelect",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },
    optionNames: ["selectedItem"],

    ejecutar: async ({ client, interaction, character, componentData: { userId, extras }, options: { selectedItem } }) => {
        if (!selectedItem || selectedItem === "none*none") {
            return interaction.reply({ content: "No seleccionaste ningún objeto válido.", flags: ["Ephemeral"] });
        }

        const [itemIdRaw, itemRegion] = selectedItem.split("*");
        const zoneKey = extras[0] || "zone";
        const isFaro = extras[1] === "faro";

        const modalCustomId = crearCustomId({
            action: "mochilaAddModal",
            userId: interaction.user.id,
            characterId: character._id,
            extras: [itemIdRaw, `[${itemRegion}]`, zoneKey, isFaro ? "faro" : "normal"]
        });

        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle("Añadir a la mochila");

        const cantidadInput = new TextInputBuilder()
            .setCustomId("cantidadInput")
            .setLabel("Cantidad a ingresar")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Introduce la cantidad...")
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(cantidadInput);
        modal.addComponents(row);

        return await interaction.showModal(modal);
    }
});
