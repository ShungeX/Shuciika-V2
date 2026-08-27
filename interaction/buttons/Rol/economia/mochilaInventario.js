const { crearBoton } = require('../../../../utils/constructores/crearComponente');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { crearCustomId } = require('../../../../utils/constructores/customId');
const interfazCreate = require('../../../../functions/interfazCreate');
const transaccionCache = require('../../../../utils/cache');
const { editarOMandarMensaje } = require('../../../../utils/utilidadesTexto');

// Handler de botones para el inventario contextualizado dentro de la mochila de exploración.
// Los customIds tienen formato: mochilaInventario-userId-characterId-[key]-action-page-filtrosJoined
module.exports = crearBoton({
    customId: "mochilaInventario",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ client, interaction, character, componentData: { userId, extras } }) => {
        // extras = [key, action, page, filtrosJoined]
        const [key, action, pageRaw, filtrosJoined] = extras;
        const page = Number(pageRaw) || 1;
        const filtros = filtrosJoined ? filtrosJoined.split("_") : ["fullbag"];

        const userCache = transaccionCache.getUser(interaction.user.id);
        const cache = userCache ? transaccionCache.get(userCache.explorarID) : null;

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
