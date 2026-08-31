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

    ejecutar: async function ({ client, interaction, character, soul, componentData: { extras }, options: { data } }) {
        const parts = data ? data.split("*") : [];
        let interact = null;
        let areaSelect = null;

        const extraAction = Array.isArray(extras) ? extras[0] : extras;
        const knownActions = new Set(["subzona", "mochila", "purificar", "continue", "surrend", "cambiarZona", "zona", "battle"]);

        if (parts.length === 1) {
            if (extraAction === "subzona") {
                interact = "subzona";
                areaSelect = parts[0];
            } else if (knownActions.has(parts[0])) {
                interact = parts[0];
                areaSelect = null;
            } else {
                areaSelect = parts[0];
                interact = extraAction || null;
            }
        } else if (parts.length === 2) {
            if (knownActions.has(parts[0])) {
                interact = parts[0];
                areaSelect = parts[1] !== "null" ? parts[1] : null;
            } else if (knownActions.has(parts[1])) {
                interact = parts[1];
                areaSelect = parts[0] !== "null" ? parts[0] : null;
            } else {
                interact = parts[0] === "null" ? parts[1] : parts[0];
                areaSelect = parts[0] === "null" ? null : parts[1];
            }
        } else if (parts.length >= 3) {
            // Estructuras como "null*mochila*TOB_INS_BIB" o "region*accion*area"
            if (knownActions.has(parts[1])) {
                interact = parts[1];
                areaSelect = parts[2] !== "null" ? parts[2] : (parts[0] !== "null" ? parts[0] : null);
            } else if (knownActions.has(parts[0])) {
                interact = parts[0];
                areaSelect = parts[2] !== "null" ? parts[2] : (parts[1] !== "null" ? parts[1] : null);
            } else {
                interact = parts[1] !== "null" ? parts[1] : parts[0];
                areaSelect = parts[2] !== "null" ? parts[2] : null;
            }
        }

        if (interact === "subzona" || extraAction === "subzona") {
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
            const subzonaSelect = await exploracionManager.obtenerSubzona(exploracionCache, areaSelect);
            if (subzonaSelect && currentEnergy < subzonaSelect.energiaNecesaria) {
                if (interaction.deferred) {
                    return interaction.followUp({ content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energía antes de explorar esta área", flags: ["Ephemeral"] });
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
