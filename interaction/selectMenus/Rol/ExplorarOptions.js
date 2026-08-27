const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente");
const exploracionManager = require("../../../functions/Exploracion/exploracionManager");
const transaccionCache = require("../../..//utils/cache");
const { recargarEnergia } = require("../../../functions/dataCharacters");

module.exports = crearStringSelectMenu({
    customId: "selectExplorar",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
    },

    optionNames: ["data", "Data1", "Data2"],

    ejecutar: async function ({ client, interaction, character, soul, componentData: { extras }, options: { data} }) {
        const [areaSelect, interact, Data2] = data?.split("*")
        console.log("ExplorarOptions.js", areaSelect, interact, Data2)
        console.log("ExplorarOptions.js", extras)
        if (extras === "subzona") {

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

            const currentEnergy = await recargarEnergia(soul.nucleo?.energy ?? 0, soul);
            subzonaSelect = await exploracionManager.obtenerSubzona(exploracionCache, areaSelect);
            if (currentEnergy < subzonaSelect.energiaNecesaria) {
                if (interaction.deferred) {
                    return interaction.followUp({ content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energía antes de explorar esta área", flags: ["Ephemeral"] })
                }
                return interaction.reply({ content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energía antes de explorar esta área", flags: ["Ephemeral"] });
            }

        }

        return await exploracionManager.ejecutarAccionExploracion({
            client,
            interaction,
            character,
            soul,
            areaSelect,
            interact
        });
    },

    generateMessage: function (soul, zona, data, showInfo, onlyTop = false) {
        return exploracionManager.generateMessage(soul, zona, data, showInfo, onlyTop);
    },

    calcularAmenaza: function (characterData, enemy) {
        return exploracionManager.calcularAmenaza(characterData, enemy);
    }
});
