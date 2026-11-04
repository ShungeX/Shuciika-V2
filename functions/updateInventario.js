const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const Discord = require("discord.js");
const clientdb = require("../Server")
const db2 = clientdb.db("Rol_db")
const personajes = db2.collection("Personajes")
const souls = db2.collection("Soul")
const transaccionCache = require("../utils/cache");
const dbobjetos = db2.collection("Objetos_globales")
const { moverLumens } = require("./Economia/lumens")
            /**
             * 
             * @param {Client} client
             * @param {Discord.CommandInteraction} interaction
             * 
             * 
             */

/*  
"InteractionFriends": 1,
"InteractionCouple": 2,
"InteractionFriendly": 3,
"InteractionNeutral": 4
//** */



module.exports = async(client, interaction, characterId, data) => {
    const charIdNum = isNaN(Number(characterId)) ? characterId : Number(characterId);
    const personaje = await personajes.findOne({$or: [
        { _id: charIdNum },
        { _id: characterId }
    ]});

    if (!personaje) {
        return { success: false, messages: "Personaje no encontrado" };
    }

    const pjFilter = { _id: personaje._id };

    if (!data.isItem) {
        if (data.typeLoot === "lumens") {
            if (isNaN(data.cantidad)) return `Hubo un error al asignar este valor: ${data.cantidad} - No es un numero`;

            await moverLumens({
                personajeId: personaje._id, delta: Number(data.cantidad), motivo: data.motivo || "exploracion",
                opId: data.opId, ref: data.ref || {},
            });
        } else if (data.typeLoot === "polvo" || data.typeLoot === "polvoEstelar") {
            const cantidadPolvo = Math.floor(Number(data.cantidad));
            if (!Number.isFinite(cantidadPolvo)) return `Hubo un error al asignar este valor: ${data?.cantidad} - No es un numero`;
            // El Polvo vive en el alma; se condensa en Fragmentos aparte (progresionEstelar.convertirPolvo)
            if (cantidadPolvo > 0) {
                await souls.updateOne({ _id: personaje._id }, { $inc: { "nucleo.polvoEstelar": cantidadPolvo } });
            }
        } else {
            return `No se ha asignado ningun valor, parece ser que este objeto no corresponde a nada: ${data.typeLoot}`;
        }

        return `Se ha asignado correctamente: ${data.typeLoot} - ${data.cantidad} - ${characterId}`;
    }

    const catalogoObjetos = require("./catalogoObjetos");

    // Buscar información en el catálogo en memoria o en Objetos_globales como fallback
    let objinfo = null;
    if (data.ID !== undefined && data.ID !== null) {
        objinfo = catalogoObjetos.getObjetoPorId(data.Region, data.ID);
        if (!objinfo) {
            const objinfoa = await dbobjetos.findOne({ "Objetos.ID": Number(data.ID) });
            objinfo = objinfoa?.Objetos?.find(o => Number(o.ID) === Number(data.ID)) || objinfoa?.Objetos?.[0];
        }
    }

    const isTalisman = Boolean(data.isTalisman || data.talisman || data.destino === "inventarioTalisman");
    const isMochila = Boolean(data.isMochila || data.fromMochila || data.mochila || data.destino === "Mochila" || data.destino === "mochila");
    const arrayField = isMochila 
        ? "economia.Mochila" 
        : (isTalisman ? "economia.inventarioTalisman" : "economia.Inventario");

    // Buscar objeto dentro del inventario correspondiente del personaje
    const inventario = (isMochila 
        ? personaje.economia?.Mochila 
        : (isTalisman ? personaje.economia?.inventarioTalisman : personaje.economia?.Inventario)) || [];
    let objfind;

    if (data.instanciaID !== undefined && data.instanciaID !== null) {
        objfind = inventario.find(obj => String(obj.instanciaID) === String(data.instanciaID));
    }
    if (!objfind && data.ID !== undefined && data.ID !== null) {
        objfind = inventario.find(obj => String(obj.ID) === String(data.ID));
    }
    if (!objfind && (data.Nombre || objinfo?.Nombre)) {
        const nameToSearch = String(data.Nombre || objinfo?.Nombre || '').toLowerCase();
        objfind = inventario.find(obj => obj.Nombre && obj.Nombre.toLowerCase() === nameToSearch);
    }

    // Máximo en inventario: solo cuando entra algo nuevo al Inventario. No aplica al talismán (temporal),
    // ni a mover de la mochila al inventario (el total no cambia), ni a restar (cantidad negativa).
    let avisoLimite = null;
    const esEntrada = !data.consumir && !isMochila && !isTalisman && !data.esMovimiento && Number(data.cantidad ?? 1) > 0;
    if (esEntrada) {
        const { limitarEntradas, motivoNoCabe } = require("./Objetos/limiteInventario");
        const entrada = { ID: data.ID, Region: data.Region, cantidad: Number(data.cantidad ?? 1), Nombre: data.Nombre || objinfo?.Nombre };
        if (data.isMailContent) {
            // Un regalo entra entero o se queda en el buzón
            const motivo = await motivoNoCabe(personaje, entrada);
            if (motivo) return { success: false, lleno: true, messages: motivo };
        } else {
            const { admitidos, aviso } = await limitarEntradas(personaje, [entrada]);
            avisoLimite = aviso;
            if (!admitidos.length) {
                console.log(`[updateInventario] ${personaje._id} no recibió ${data.Region}:${data.ID}: inventario al máximo`);
                return { success: false, lleno: true, messages: aviso };
            }
            data = { ...data, cantidad: admitidos[0].cantidad };
        }
    }

    try {
        if (data.consumir) {
            if (objfind) {
                const currentQty = Number(objfind.Cantidad ?? objfind.cantidad ?? 1);
                const consumeQty = Number(data.cantidad || 1);

                if (currentQty - consumeQty <= 0) {
                    const pullFilter = objfind.instanciaID 
                        ? { instanciaID: objfind.instanciaID }
                        : (objfind.ID !== undefined ? { ID: objfind.ID } : { Nombre: objfind.Nombre });

                    await personajes.updateOne(pjFilter, {
                        $pull: { [arrayField]: pullFilter }
                    });
                } else {
                    const elemMatch = objfind.instanciaID
                        ? { instanciaID: objfind.instanciaID }
                        : (objfind.ID !== undefined ? { ID: objfind.ID } : { Nombre: objfind.Nombre });

                    await personajes.updateOne(
                        { _id: personaje._id, [arrayField]: { $elemMatch: elemMatch } },
                        { $inc: { [`${arrayField}.$.Cantidad`]: -consumeQty } }
                    );
                }

                // Limpieza de seguridad: eliminar cualquier ítem que haya quedado con Cantidad <= 0
                await personajes.updateOne(pjFilter, {
                    $pull: {
                        [arrayField]: {
                            $or: [
                                { Cantidad: { $lte: 0 } },
                                { cantidad: { $lte: 0 } }
                            ]
                        }
                    }
                });

                console.log(`[updateInventario] ${arrayField} actualizado por consumo de:`, objfind.Nombre || data.ID);
                return { success: true, messages: "Inventario actualizado correctamente por consumo" };
            } else {
                console.warn(`[updateInventario] Objeto no encontrado en ${arrayField} para consumir:`, data);
                return { success: false, messages: "Objeto no encontrado en el inventario para consumir" };
            }
        }

        if (data?.isMailContent && data?.instanciaID) {
            await personajes.updateOne(pjFilter, {
                $push: {
                    [arrayField]: {
                        ...data.itemComplet
                    }
                }
            });

            return { success: true, messages: "Se ha agregado el regalo correctamente" };
        }

        if (objfind) {
            const elemMatch = objfind.instanciaID
                ? { instanciaID: objfind.instanciaID }
                : (objfind.ID !== undefined ? { ID: objfind.ID } : { Nombre: objfind.Nombre });

            await personajes.updateOne(
                { _id: personaje._id, [arrayField]: { $elemMatch: elemMatch } },
                { $inc: { [`${arrayField}.$.Cantidad`]: Number(data.cantidad || 1) } }
            );
        } else {
            const itemToPush = catalogoObjetos.sanitizarObjetoInventario(
                { ...objinfo, ...data },
                Number(data.cantidad || 1),
                {
                    contaminable: typeof data.contaminable !== "undefined"
                        ? Boolean(data.contaminable)
                        : (typeof objinfo?.contaminable !== "undefined" ? Boolean(objinfo.contaminable) : isTalisman),
                    purificable: typeof data.purificable !== "undefined"
                        ? Boolean(data.purificable)
                        : (typeof objinfo?.purificable !== "undefined" ? Boolean(objinfo.purificable) : false)
                }
            );

            await personajes.updateOne(pjFilter, {
                $push: {
                    [arrayField]: itemToPush
                }
            });
        }

        await personajes.updateOne(pjFilter, {
            $pull: {
                [arrayField]: {
                    $or: [
                        { Cantidad: { $lte: 0 } },
                        { cantidad: { $lte: 0 } }
                    ]
                }
            }
        });

        console.log(`[updateInventario] ${arrayField} actualizado exitosamente`);
        return { success: true, messages: "Inventario actualizado correctamente", aviso: avisoLimite, recortado: Boolean(avisoLimite) };

    } catch (error) {
        console.error(`[updateInventario] Error al actualizar ${arrayField}:`, error);
        return { success: false, messages: "No se pudo actualizar el inventario" };
    }
};
