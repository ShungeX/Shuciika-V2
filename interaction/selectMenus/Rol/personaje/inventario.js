const { crearStringSelectMenu } = require("../../../../utils/constructores/crearComponente");
const interfazCreate = require("../../../../functions/interfazCreate");

module.exports = crearStringSelectMenu({
    customId: "inventario",
    soloAutor: true,
    multiSelect: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    optionNames: ["filtros"],

    ejecutar: async ({ client, interaction, character, componentData: { extras }, options: { filtros } }) => {
        const [action, pageRaw, filtrosJoined] = extras;
        const previousFilters = filtrosJoined ? filtrosJoined.split("_") : ["fullbag"];
        const hadFullbag = previousFilters.includes("fullbag");

        const selectedValues = Array.isArray(filtros) ? filtros : [filtros];
        let finalFiltros = [];

        if (selectedValues.includes("fullbag")) {
            if (selectedValues.length === 1) {
                finalFiltros = ["fullbag"];
            } else if (hadFullbag) {
                finalFiltros = selectedValues.filter(f => f !== "fullbag");
            } else {
                finalFiltros = ["fullbag"];
            }
        } else {
            finalFiltros = selectedValues.length ? selectedValues : ["fullbag"];
        }

        const json = interfazCreate.inventarioMensaje(interaction, character, 1, finalFiltros);
        return interaction.update({ components: json, flags: ["IsComponentsV2", "SuppressNotifications"] });
    }
});