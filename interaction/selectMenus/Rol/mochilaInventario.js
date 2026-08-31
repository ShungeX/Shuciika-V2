const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const interfazCreate = require("../../../functions/interfazCreate");
const transaccionCache = require("../../../utils/cache");
const { editarOMandarMensaje } = require("../../../utils/utilidadesTexto");

// Handler del selectMenu de filtro contextualizado dentro de la mochila de exploración.
// Los customIds tienen formato: mochilaInventario-userId-characterId-[key]-filter-page-filtrosJoined
module.exports = crearStringSelectMenu({
    customId: "mochilaInventario",
    soloAutor: true,
    multiSelect: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    optionNames: ["filtros"],

    ejecutar: async ({ client, interaction, character, componentData: { extras }, options: { filtros } }) => {
        let key = extras[0];
        let isFaro = false;
        let action, pageRaw, filtrosJoined;

        const userCache = transaccionCache.getUser(interaction.user.id);
        const cache = userCache ? transaccionCache.get(userCache.explorarID) : null;

        if (extras[1] === "faro" || extras[1] === "normal") {
            isFaro = extras[1] === "faro" || Boolean(cache?.enFaro);
            action = extras[2];
            pageRaw = extras[3];
            filtrosJoined = extras[4];
        } else {
            isFaro = Boolean(cache?.enFaro);
            action = extras[1];
            pageRaw = extras[2];
            filtrosJoined = extras[3];
        }

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

        const json = await interfazCreate.mochilaInventarioMensaje(client, interaction, character, 1, key, finalFiltros, isFaro);
        await interaction.deferUpdate().catch(() => {});
        return await editarOMandarMensaje(interaction, cache, cache?.message, { components: json, flags: ["IsComponentsV2"] });
    }
});
