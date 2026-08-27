const clientdb = require("../../../../Server");
const db2 = clientdb.db("Rol_db");
const souls = db2.collection("Soul");
const transaccionCache = require("../../../../utils/cache");
const interfazCreate = require("../../../../functions/interfazCreate");
const { battleSwitch } = require("../../../../functions/Exploracion/battleExploration");
const { barrasDeEnergia } = require("../../../../utils/utilidadesTexto");
const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const { crearCustomId } = require('../../../../utils/constructores/customId');

module.exports = crearBoton({
    customId: "exOp",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },
    fieldNames: ["state", "key", "actions"],

    ejecutar: async ({ client, interaction, character, soul, componentData: { userId, extras } }) => {
        const [state, key, actions] = extras;

        const userCache = transaccionCache.getUser(interaction.user.id);

        if (!userCache) {
            return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", ephemeral: true });
        }

        const exploracionCache = transaccionCache.get(userCache.explorarID);
        if (!exploracionCache) {
            return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", flags: ["Ephemeral"] });
        }

        if (exploracionCache.message?.id && interaction.message?.id && exploracionCache.message.id !== interaction.message.id) {
            return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", flags: ["Ephemeral"] });
        }

        const exploracionManager = require("../../../../functions/Exploracion/exploracionManager");

        switch (state) {
            case "zona":
                await interfazCreate.zonaMessage(client, interaction, key, soul);
                break;
            case "battle":
                await battleSwitch(client, interaction, key, soul, actions, userCache);
                break;
            case "mochila":
                const [subAction, extra1, extra2] = (key || "").split("*");

                if (subAction === "añadirObjetos") {
                    const zoneKey = extra1;
                    const json = await interfazCreate.mochilaInventarioMensaje(client, interaction, character, 1, zoneKey);
                    await interaction.deferUpdate().catch(() => { });
                    const { editarOMandarMensaje } = require("../../../../utils/utilidadesTexto");
                    return await editarOMandarMensaje(interaction, cache, cache.message, { components: json, flags: ["IsComponentsV2"] });
                }

                if (subAction === "cerrarInventario") {
                    const zoneKey = extra1;
                    const json = await interfazCreate.mochilaExploración(client, interaction, zoneKey, soul);
                    await interaction.deferUpdate().catch(() => { });
                    const { editarOMandarMensaje } = require("../../../../utils/utilidadesTexto");
                    return await editarOMandarMensaje(interaction, cache, cache.message, { components: json, flags: ["IsComponentsV2"] });
                }

                if (subAction === "confirmar") {
                    const zoneKey = extra1;
                    await interaction.deferUpdate().catch(() => { });
                    if (!exploracionCache || !exploracionCache?.regionSelect || !exploracionCache?.zona) {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true });
                        }
                        return;
                    }
                    return await exploracionManager.ejecutarAccionExploracion({ client, interaction, character, soul, areaSelect: exploracionCache.subzona, interact: "continue" });
                }

                if (subAction === "prev" || subAction === "next") {
                    const pageNum = Number(extra1) || 1;
                    const zoneKey = extra2;
                    const newPage = subAction === "prev" ? Math.max(1, pageNum - 1) : pageNum + 1;
                    const json = await interfazCreate.mochilaExploración(client, interaction, zoneKey, soul, newPage);
                    await interaction.deferUpdate().catch(() => { });
                    const { editarOMandarMensaje } = require("../../../../utils/utilidadesTexto");
                    return await editarOMandarMensaje(interaction, cache, cache.message, { components: json, flags: ["IsComponentsV2"] });
                }
                break;
            default:
                exploracionManager.ejecutarAccionExploracion({ client, interaction, character, soul, areaSelect: exploracionCache.subzona, interact: state })
                break;
        }
    },

    barrasDeEnergia: barrasDeEnergia
});