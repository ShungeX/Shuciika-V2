const { crearBoton } = require('../../../../utils/constructores/crearComponente');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { crearCustomId } = require('../../../../utils/constructores/customId');
const interfazCreate = require('../../../../functions/interfazCreate');
const transaccionCache = require('../../../../utils/cache');
const { editarOMandarMensaje } = require('../../../../utils/utilidadesTexto');

// Handler de botones para inventario contextualizado y talismán dentro de exploración.
module.exports = crearBoton({
    customId: "mochilaInventario",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: false }
    },

    ejecutar: async ({ client, interaction, character, soul, componentData: { userId, extras } }) => {
        const userCache = transaccionCache.getUser(interaction.user.id);
        const cache = userCache ? transaccionCache.get(userCache.explorarID) : null;

        // Caso 1: Paginación del Talismán en Faro (extras: [key, "talisman", action, page])
        if (extras[1] === "talisman") {
            const [key, _, action, pageRaw] = extras;
            const page = Number(pageRaw) || 1;

            const rawTalisman = character.economia?.inventarioTalisman || [];
            const totalPages = Math.max(1, Math.ceil(rawTalisman.length / 12));

            let newPage = page;
            if (action === "prev") newPage = Math.max(1, page - 1);
            if (action === "next") newPage = Math.min(totalPages, page + 1);

            const json = await interfazCreate.faroExploración(client, interaction, key, soul, newPage);
            await interaction.deferUpdate().catch(() => {});
            return await editarOMandarMensaje(interaction, cache, cache?.message, { components: json, flags: ["IsComponentsV2"] });
        }

        // Caso 2: Paginación de Inventario en Mochila (extras: [key, action, page, filtrosJoined])
        const [key, action, pageRaw, filtrosJoined] = extras;
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

            const json = await interfazCreate.mochilaInventarioMensaje(client, interaction, character, newPage, key, activeFiltros);
            await interaction.deferUpdate().catch(() => {});
            return await editarOMandarMensaje(interaction, cache, cache?.message, { components: json, flags: ["IsComponentsV2"] });
        }

        if (action === "jump") {
            const modalCustomId = crearCustomId({
                action: "mochilaInventario",
                userId: interaction.user.id,
                characterId: character._id,
                extras: [key, "jumpModal", page, filtrosJoined || "fullbag"]
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
