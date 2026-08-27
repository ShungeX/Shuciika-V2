const { crearBoton } = require('../../../../utils/constructores/crearComponente');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { crearCustomId } = require('../../../../utils/constructores/customId');
const interfazCreate = require('../../../../functions/interfazCreate');

module.exports = crearBoton({
    customId: "inventario",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ client, interaction, character, componentData: { userId, extras } }) => {
        const [action, pageRaw, filtrosJoined] = extras;
        const page = Number(pageRaw) || 1;
        const filtros = filtrosJoined ? filtrosJoined.split("_") : ["fullbag"];

        if (action === "prev" || action === "next") {
            const rawInventario = character.economia?.Inventario || character.Inventario || [];
            const esFullbag = !filtros.length || filtros.includes("fullbag");
            const activeFiltros = esFullbag ? ["fullbag"] : filtros;

            const inventarioFiltrado = interfazCreate.filtrarInventario(rawInventario, activeFiltros);
            const totalPages = Math.max(1, Math.ceil(inventarioFiltrado.length / 10));
            let newPage = page;
            if (action === "prev") newPage = Math.max(1, page - 1);
            if (action === "next") newPage = Math.min(totalPages, page + 1);

            const json = interfazCreate.inventarioMensaje(interaction, character, newPage, activeFiltros);
            return interaction.update({ components: json, flags: ["IsComponentsV2", "SuppressNotifications"] });
        }

        if (action === "jump") {
            const modalCustomId = crearCustomId({
                action: "inventario",
                userId: interaction.user.id,
                characterId: character._id,
                extras: ["jumpModal", page, filtrosJoined || "fullbag"]
            });

            const modal = new ModalBuilder()
                .setCustomId(modalCustomId)
                .setTitle("Saltar a página");

            const pageInput = new TextInputBuilder()
                .setCustomId("numero_pagina")
                .setLabel("Número de página")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Introduce el número de página...")
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(pageInput);
            modal.addComponents(row);

            return await interaction.showModal(modal);
        }
    }
});