const { crearModal } = require("../../../utils/constructores/crearComponente");
const clientdb = require("../../../Server");
const db2 = clientdb.db("Rol_db");
const personajes = db2.collection("Personajes");
const dbobjetos = db2.collection("Objetos_globales");
const interfazCreate = require("../../../functions/interfazCreate");
const transaccionCache = require("../../../utils/cache");
const { editarOMandarMensaje } = require("../../../utils/utilidadesTexto");

module.exports = crearModal({
    customId: "mochilaAddModal",
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
        const desiredQty = parseInt(cantidadRaw, 10);

        if (isNaN(desiredQty) || desiredQty <= 0) {
            return interaction.reply({ content: "Debes ingresar una cantidad numérica válida mayor a 0.", flags: ["Ephemeral"] });
        }

        const equipoList = soul?.equipo || soul?.dominio?.equipo || character?.equipo || character?.dominio?.equipo || [];
        const mochilaEquipada = equipoList.find(i => Number(i.ID) === 983);
        let capacidadMax = 0;

        if (mochilaEquipada) {
            const objDoc = await dbobjetos.findOne({ "Objetos.ID": 983 });
            const itemDef = objDoc?.Objetos?.find(o => Number(o.ID) === 983);
            capacidadMax = itemDef?.atributos?.capacidad ?? 20;
        }

        if (capacidadMax <= 0) {
            return interaction.reply({ content: "No tienes equipada la Mochila adecuada (ID: 983) para guardar objetos.", flags: ["Ephemeral"] });
        }

        const inventario = character.economia?.Inventario || character.Inventario || [];
        const itemInInv = inventario.find(i => (i.ID === itemId || Number(i.ID) === itemId) && (i.Region === cleanRegion || i.Region === itemRegion || !cleanRegion));

        console.log("mochilaAddModal.js", itemIdRaw, itemRegion)

        if (!itemInInv || Number(itemInInv.Cantidad || itemInInv.cantidad || 0) <= 0) {
            return interaction.reply({ content: "No posees este objeto en tu inventario.", flags: ["Ephemeral"] });
        }

        const availableStock = Number(itemInInv.Cantidad || itemInInv.cantidad || 0);

        let itemPeso = Number(itemInInv.atributos?.peso ?? 1);
        if (isNaN(itemPeso) || itemPeso <= 0) {
            const objGlobal = await dbobjetos.findOne({ "Objetos.ID": itemId });
            const globalItemDef = objGlobal?.Objetos?.find(o => Number(o.ID) === itemId);
            itemPeso = Number(globalItemDef?.atributos?.peso ?? 1);
        }

        const mochilaList = character.economia?.Mochila || [];
        let pesoActual = 0;
        mochilaList.forEach(m => {
            const cant = Number(m.Cantidad || m.cantidad || 1);
            const p = Number(m.atributos?.peso ?? 1);
            pesoActual += cant * p;
        });

        const espacioDisponible = Math.max(0, capacidadMax - pesoActual);
        const maxUnitsByWeight = itemPeso > 0 ? Math.floor(espacioDisponible / itemPeso) : 999999;

        const qtyToAdd = Math.max(0, Math.min(desiredQty, availableStock, maxUnitsByWeight));

        let superoPeso = false;
        let superoStock = false;
        let omitidosPeso = 0;
        let omitidosStock = 0;

        if (desiredQty > availableStock) {
            superoStock = true;
            omitidosStock = desiredQty - availableStock;
        } else if (desiredQty > maxUnitsByWeight) {
            superoPeso = true;
            omitidosPeso = desiredQty - Math.max(0, maxUnitsByWeight);
        }

        const nombreObjeto = itemInInv.Nombre || `Objeto ${itemId}`;

        if (qtyToAdd > 0) {
            const newInvQty = availableStock - qtyToAdd;
            if (newInvQty <= 0) {
                character.economia.Inventario = inventario.filter(i => !( (i.ID === itemId || Number(i.ID) === itemId) && (i.Region === itemRegion || !itemRegion) ));
            } else {
                itemInInv.Cantidad = newInvQty;
            }

            if (!character.economia.Mochila) character.economia.Mochila = [];
            const itemInMochila = character.economia.Mochila.find(i => (i.ID === itemId || Number(i.ID) === itemId) && (i.Region === itemRegion || !itemRegion));
            if (itemInMochila) {
                itemInMochila.Cantidad = Number(itemInMochila.Cantidad || itemInMochila.cantidad || 0) + qtyToAdd;
            } else {
                character.economia.Mochila.push({
                    ID: itemInInv.ID,
                    Region: itemInInv.Region || "Global",
                    Nombre: nombreObjeto,
                    Tipo: itemInInv.Tipo || [],
                    Cantidad: qtyToAdd,
                    atributos: { peso: itemPeso },
                    Fecha: new Date().toISOString()
                });
            }

            await personajes.updateOne({ _id: character._id }, {
                $set: {
                    "economia.Inventario": character.economia.Inventario,
                    "economia.Mochila": character.economia.Mochila
                }
            });
        }

        let replyMsg = `Se han añadido ${qtyToAdd} de ${nombreObjeto}.`;
        if (superoPeso && omitidosPeso > 0) {
            replyMsg += ` Ademas se han omitido ${omitidosPeso} de ${nombreObjeto} porque supero el peso total.`;
        } else if (superoStock && omitidosStock > 0) {
            replyMsg += ` Ademas se han omitido ${omitidosStock} de ${nombreObjeto} porque no hay suficientes objetos en el inventario.`;
        }

        if (qtyToAdd === 0 && superoPeso) {
            replyMsg = `No se agregaron objetos de ${nombreObjeto} porque supero el peso total.`;
        } else if (qtyToAdd === 0 && superoStock) {
            replyMsg = `No se agregaron objetos de ${nombreObjeto} porque no hay suficientes objetos en el inventario.`;
        }

        await interaction.reply({ content: replyMsg, flags: ["Ephemeral"] });

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
            console.error("Error al actualizar mensaje de exploración en mochilaAddModal:", e);
        }
    }
});
