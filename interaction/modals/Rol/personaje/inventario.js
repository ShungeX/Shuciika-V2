const { crearModal } = require("../../../../utils/constructores/crearComponente");
const interfazCreate = require("../../../../functions/interfazCreate");

module.exports = crearModal({
    customId: "inventario",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    fieldNames: {
        "numero_pagina": "paginaInput"
    },

    ejecutar: async ({ client, interaction, character, componentData: { extras }, options: { paginaInput } }) => {
        const [action, pageRaw, filtrosJoined] = extras;
        const filtros = filtrosJoined ? filtrosJoined.split("_") : ["fullbag"];

        const requestedPage = parseInt(paginaInput, 10);
        const rawInventario = character.economia?.Inventario || character.Inventario || [];

        const esFullbag = !filtros.length || filtros.includes("fullbag");
        const activeFiltros = esFullbag ? ["fullbag"] : filtros;

        const inventarioFiltrado = interfazCreate.filtrarInventario(rawInventario, activeFiltros);
        const totalPages = Math.max(1, Math.ceil(inventarioFiltrado.length / 10));

        let targetPage = 1;
        if (!isNaN(requestedPage)) {
            if (requestedPage > totalPages) {
                targetPage = totalPages;
            } else if (requestedPage < 1) {
                targetPage = 1;
            } else {
                targetPage = requestedPage;
            }
        }

        const json = interfazCreate.inventarioMensaje(interaction, character, targetPage, activeFiltros);
        return interaction.update({ components: json, flags: ["IsComponentsV2", "SuppressNotifications"] });
    }
});
