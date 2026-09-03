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
            return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", flags: ["Ephemeral"] });
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
                const { editarOMandarMensaje } = require("../../../../utils/utilidadesTexto");

                if (subAction === "añadirObjetos") {
                    const zoneKey = extra1;
                    const isFaro = extra2 === "faro" || Boolean(exploracionCache?.enFaro);
                    const json = await interfazCreate.mochilaInventarioMensaje(client, interaction, character, 1, zoneKey, ["fullbag"], isFaro);
                    await interaction.deferUpdate().catch(() => { });
                    return await editarOMandarMensaje(interaction, exploracionCache, exploracionCache.message, { components: json, flags: ["IsComponentsV2"] });
                }

                if (subAction === "cerrarInventario") {
                    const zoneKey = extra1;
                    const isFaro = extra2 === "faro" || Boolean(exploracionCache?.enFaro);
                    const json = await interfazCreate.mochilaExploración(client, interaction, zoneKey, soul, 1, isFaro);
                    await interaction.deferUpdate().catch(() => { });
                    return await editarOMandarMensaje(interaction, exploracionCache, exploracionCache.message, { components: json, flags: ["IsComponentsV2"] });
                }

                if (subAction === "cerrarFaro" || subAction === "cerrarMochilaFaro") {
                    const zoneKey = extra1 || exploracionCache.subzona;
                    const json = await interfazCreate.faroExploración(client, interaction, zoneKey, soul);
                    await interaction.deferUpdate().catch(() => { });
                    return await editarOMandarMensaje(interaction, exploracionCache, exploracionCache.message, { components: json, flags: ["IsComponentsV2"] });
                }

                if (subAction === "confirmar") {
                    const zoneKey = extra1;
                    await interaction.deferUpdate().catch(() => { });
                    if (!exploracionCache || !exploracionCache?.regionSelect || !exploracionCache?.zona) {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", flags: ["Ephemeral"] });
                        }
                        return;
                    }
                    return await exploracionManager.ejecutarAccionExploracion({ client, interaction, character, soul, areaSelect: exploracionCache.subzona, interact: "continue" });
                }

                if (subAction === "prev" || subAction === "next") {
                    const pageNum = Number(extra1) || 1;
                    const zoneKey = extra2;
                    const isFaro = (key || "").includes("*faro") || Boolean(exploracionCache?.enFaro);
                    const newPage = subAction === "prev" ? Math.max(1, pageNum - 1) : pageNum + 1;
                    const json = await interfazCreate.mochilaExploración(client, interaction, zoneKey, soul, newPage, isFaro);
                    await interaction.deferUpdate().catch(() => { });
                    return await editarOMandarMensaje(interaction, exploracionCache, exploracionCache.message, { components: json, flags: ["IsComponentsV2"] });
                }
                break;
            case "purificar": {
                const subAction = (key || "").includes("*") ? key.split("*")[0] : key;
                const zoneKey = actions || ((key || "").includes("*") ? key.split("*")[1] : null) || exploracionCache?.subzona;
                const { editarOMandarMensaje } = require("../../../../utils/utilidadesTexto");

                if (subAction === "cancelar") {
                    const json = await interfazCreate.faroExploración(client, interaction, zoneKey, soul);
                    await interaction.deferUpdate().catch(() => { });
                    return await editarOMandarMensaje(interaction, exploracionCache, exploracionCache.message, { components: json, flags: ["IsComponentsV2"] });
                }

                if (subAction === "confirmar") {
                    const charIdNum = isNaN(Number(character._id)) ? character._id : Number(character._id);
                    const freshChar = await db2.collection("Personajes").findOne({
                        $or: [{ _id: charIdNum }, { _id: character._id }]
                    });

                    const rawTalisman = freshChar?.economia?.inventarioTalisman || [];
                    if (rawTalisman.length === 0) {
                        return interaction.reply({ content: "Tu talismán está vacío, no hay nada que purificar.", flags: ["Ephemeral"] });
                    }

                    const { getObjetoPorId } = require("../../../../functions/catalogoObjetos");
                    const base = 1.6;
                    const profundidad = Math.max(1, exploracionCache?.profundidad || 1);

                    const getRarezaMult = (rarezaStr) => {
                        const r = String(rarezaStr || "").toLowerCase().trim();
                        if (
                            r.includes("luminoso") ||
                            r.includes("arcano") ||
                            r.includes("divino") ||
                            r.includes("nix") ||
                            r.includes("legendario") ||
                            r.includes("mitico") ||
                            r.includes("mítico") ||
                            r.includes("etereo") ||
                            r.includes("etéreo") ||
                            r.includes("singular")
                        ) {
                            return 1.4;
                        }
                        if (r.includes("resonante") || r.includes("raro") || r.includes("inusual")) {
                            return 1.2;
                        }
                        return 1.0;
                    };

                    let costoTotal = 0;
                    for (const item of rawTalisman) {
                        const cant = Number(item.Cantidad || item.cantidad || 1);
                        let rareza = item.Rareza || item.rareza;
                        if (!rareza) {
                            const objDef = getObjetoPorId(item.Region, item.ID);
                            rareza = objDef?.Rareza || objDef?.rareza;
                        }
                        const mult = getRarezaMult(rareza);
                        costoTotal += base * Math.pow(mult, profundidad) * cant;
                    }
                    const costo = Math.round(costoTotal);
                    const currentLumens = Number(freshChar?.economia?.Lumens ?? 0);

                    if (currentLumens < costo) {
                        return interaction.reply({ content: `No tienes suficientes Lumens (${currentLumens}/${costo} :lumens:) para purificar estos objetos.`, flags: ["Ephemeral"] });
                    }

                    // Fusión de inventario con talismán (evitando duplicados y asegurando descontaminación)
                    const { sanitizarObjetoInventario } = require("../../../../../functions/catalogoObjetos");
                    const currentInventario = [...(freshChar.economia?.Inventario || [])];
                    for (const tItem of rawTalisman) {
                        const tId = Number(tItem.ID);
                        const tCant = Number(tItem.Cantidad || tItem.cantidad || 1);
                        const tRegion = tItem.Region || "Global";

                        const existing = currentInventario.find(i => Number(i.ID) === tId && (i.Region === tRegion || !i.Region || !tRegion));
                        if (existing) {
                            existing.Cantidad = Number(existing.Cantidad || existing.cantidad || 0) + tCant;
                            if (typeof existing.contaminable !== "undefined") existing.contaminable = false;
                            if (typeof existing.purificable !== "undefined") existing.purificable = false;
                            if (existing.cantidad !== undefined) delete existing.cantidad;
                        } else {
                            const cleanItem = sanitizarObjetoInventario(tItem, tCant, { contaminable: false, purificable: false });
                            currentInventario.push(cleanItem);
                        }
                    }

                    // Actualización atómica en MongoDB
                    await db2.collection("Personajes").updateOne(
                        { _id: freshChar._id },
                        {
                            $set: {
                                "economia.Inventario": currentInventario,
                                "economia.inventarioTalisman": []
                            },
                            $inc: {
                                "economia.Lumens": -costo,
                                Dinero: -costo
                            }
                        }
                    );

                    const json = await interfazCreate.faroExploración(client, interaction, zoneKey, soul);
                    await interaction.deferUpdate().catch(() => { });
                    return await editarOMandarMensaje(interaction, exploracionCache, exploracionCache.message, { components: json, flags: ["IsComponentsV2"] });
                }
                break;
            }
            default:
                exploracionManager.ejecutarAccionExploracion({ client, interaction, character, soul, areaSelect: exploracionCache.subzona, interact: state })
                break;
        }
    },

    barrasDeEnergia: barrasDeEnergia
});