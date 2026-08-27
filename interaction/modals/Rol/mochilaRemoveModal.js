const { crearModal } = require("../../../utils/constructores/crearComponente");
const clientdb = require("../../../Server");
const db2 = clientdb.db("Rol_db");
const personajes = db2.collection("Personajes");
const interfazCreate = require("../../../functions/interfazCreate");
const transaccionCache = require("../../../utils/cache");
const { editarOMandarMensaje } = require("../../../utils/utilidadesTexto");
const updateInventario = require("../../../functions/updateInventario");

module.exports = crearModal({
    customId: "mochilaRemoveModal",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true }
    },
    fieldNames: {
        cantidadInput: "cantidadRaw"
    },

    ejecutar: async ({ client, interaction, character, soul, componentData: { extras }, options: { cantidadRaw } }) => {
        const [itemIdRaw, itemRegion, zoneKey] = extras;
        const itemId = isNaN(Number(itemIdRaw)) ? itemIdRaw : Number(itemIdRaw);
        const cleanRegion = String(itemRegion || '').replace(/^\[|\]$/g, '');
        const qtyRequested = parseInt(cantidadRaw, 10);

        if (isNaN(qtyRequested) || qtyRequested <= 0) {
            return interaction.reply({ content: "Debes ingresar una cantidad numérica válida mayor a 0.", flags: ["Ephemeral"] });
        }

        const mochila = character.economia?.Mochila || [];
        const itemInMochila = mochila.find(i => (i.ID === itemId || Number(i.ID) === itemId) && (i.Region === cleanRegion || i.Region === itemRegion || !cleanRegion));

        if (!itemInMochila || Number(itemInMochila.Cantidad || itemInMochila.cantidad || 0) <= 0) {
            return interaction.reply({ content: "No posees este objeto en tu mochila.", flags: ["Ephemeral"] });
        }

        const currentQty = Number(itemInMochila.Cantidad || itemInMochila.cantidad || 1);
        const qtyToRemove = Math.min(qtyRequested, currentQty);

        const newMochilaQty = currentQty - qtyToRemove;
        if (newMochilaQty <= 0) {
            character.economia.Mochila = mochila.filter(i => !( (i.ID === itemId || Number(i.ID) === itemId) && (i.Region === cleanRegion || i.Region === itemRegion || !cleanRegion) ));
        } else {
            itemInMochila.Cantidad = newMochilaQty;
        }

        await personajes.updateOne({ _id: character._id }, {
            $set: {
                "economia.Mochila": character.economia.Mochila
            }
        });

        const nombreObjeto = itemInMochila.Nombre || `Objeto ${itemId}`;

        await updateInventario(client, interaction, character._id, {
            ID: itemInMochila.ID,
            Region: itemInMochila.Region || itemRegion || "Global",
            Nombre: nombreObjeto,
            cantidad: qtyToRemove,
            isItem: true,
            Tipo: itemInMochila.Tipo || []
        });

        await interaction.reply({
            content: `Se han retirado ${qtyToRemove} de ${nombreObjeto} de la mochila y devuelto al inventario.`,
            flags: ["Ephemeral"]
        });

        try {
            const userCache = transaccionCache.getUser(interaction.user.id);
            const exploracionCache = transaccionCache.get(userCache?.explorarID);
            if (exploracionCache && exploracionCache.message) {
                const updatedComponents = await interfazCreate.mochilaExploración(client, interaction, zoneKey, soul);
                let msgToEdit = null;
                if (interaction.channel) {
                    msgToEdit = await interaction.channel.messages.fetch(exploracionCache.message.id).catch(() => null);
                }
                await editarOMandarMensaje(interaction, exploracionCache, msgToEdit || exploracionCache.message, { components: updatedComponents, flags: ["IsComponentsV2"] });
            }
        } catch (e) {
            console.error("Error al actualizar mensaje de exploración en mochilaRemoveModal:", e);
        }
    }
});
