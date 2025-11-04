const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const Discord = require("discord.js");
const clientdb = require("../Server")
const db = clientdb.db("Rol_db")
const personajes = db.collection("Personajes")
const souls = db.collection("Soul")
const cacheGlobal = require("../utils/cache");
const getXPSoul = require("./getXPSoul.js");
const levelsEmitter = require("./emitterShuciika.js");
const { maxEnergy } = require("../config.js");
const dbobjetos = db.collection("Objetos_globales")
const cron = require('node-cron');


module.exports = {

    /**
     * Actualiza la energia del personaje almacenada en (souls)
     * 
     * 
     * @param {Number} currentEnergy 
     * @param {Object} soul Información del alma del personaje
     * @returns {Number} Energia actualizada
     */

    recargarEnergia: async function (currentEnergy, soul) {
        const ahora = Date.now();
        const regeneracionTime = 10 // Esto en minutos

        const lastUpdate = soul?.lastEnergyUpdate || ahora;

        if (currentEnergy > maxEnergy) {
            return currentEnergy
        }


        const diferenciaMinutos = (ahora - lastUpdate) / (1000 * 60);

        const puntosRegenerados = Math.floor(diferenciaMinutos / regeneracionTime);

        const nuevaEnergia = Math.min(currentEnergy + puntosRegenerados, maxEnergy);

        const newLastUpdate = puntosRegenerados > 0 ? lastUpdate + (puntosRegenerados * 1000 * 60 * regeneracionTime) : lastUpdate;

        await souls.updateOne({ ID: soul.ID },
            {
                $set: {
                    energy: nuevaEnergia, lastEnergyUpdate: newLastUpdate
                }
            }
        );

        return nuevaEnergia;
    },

    /**
     * Incrementa el XP y lo guarda en la base de datos: agrega flags para
     * verificar si se subio de nivel o no
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {String} characterId ID del personaje
     * @param {Number} cantidad XP a agregar
     * @param {Number} bonus XP adicional (Multiplicado / Porcentaje )
     * @returns Contenido en Embed o false
     */
    obtenerXP: async function (interaction, characterId, cantidad, bonus) {
        const xpGet = (bonus || 1) * (cantidad)

        await souls.updateOne({ _id: interaction.user.id },
            {
                $inc: { "XP": xpGet }
            }
        )

        const soul = await souls.findOne({ _id: interaction.user.id })

        if (soul.XP >= (soul?.xpRequired || 1)) {
            const nextLevel = 50 + (soul.nivelMagico * (20 * soul.nivelMagico))
            const LevelR = soul.nivelMagico + 1
            const newHP = Math.floor(100 + (LevelR ^ 1.7) * 7)

            await souls.updateOne({ _id: interaction.user.id }, {
                $set: {
                    "xpRequired": nextLevel,
                    "stats.hpMax": newHP,
                    "HP": newHP
                },
                $inc: {
                    "nivelMagico": 1,
                    "StelarFragments": 1,
                }
            }, {
                upsert: true
            })

            const messagesTitle = [
                "Una estrella nace en tu interior.",
                "Un ascenso hacia las estrellas",
                "El Cielo Teje tu Destino",
                "Las estrellas te observan con atención",
                "Anillos de Luz Te Rodean",
                "Tu energía gravitacional atrae constelaciones enteras",
                "Nubes cósmicas tejen armadura en tu espíritu.",
                "Las constelaciones se alinean con tu ascenso a nivel",
                "Fragmentos de asteroides potencian tu fuerza",
                "La oscuridad fortalece tu instinto de supervivencia.",
            ]

            const messageDescriptions = [
                "«El universo susurra: 'Eres luz hecha forma'»",
                "«Las galaxias giran en torno a tu voluntad.»",
                "«Dejas rastros de polvo estelar en cada paso.»",
                "«Polvo de estrellas se adhiere a tus pasos.»",
                "«Los cielos premian a los audaces.»",
                "«Cuando te conviertas en una gran estrella, ¿llevara tu nombre?»",
            ]

            const messageSecrets = [
                "«La oscuridad no es vacío... está viva.»",
                "«Ella observa desde el plenilunio, silenciosa.»",
                "«¿Fue un susurro... o su risa lo que escuchaste?»",
                "«Los gritos de las lunas extintas son tu melodía.»",
                "«Su silueta sin ojos es solo el principio...»",
            ]

            const gifsNormal = [
                "https://c.tenor.com/lwazM6r0VtIAAAAd/tenor.gif",
                "https://c.tenor.com/H3dQ4D3SiKoAAAAC/tenor.gif",
                "https://c.tenor.com/4MBK5F7GgowAAAAd/tenor.gif",
                "https://c.tenor.com/bNrICnndHXsAAAAd/tenor.gif",
                "https://c.tenor.com/v3KxhM48PpIAAAAd/tenor.gif",
                "https://c.tenor.com/zgBJXZ13cpAAAAAd/tenor.gif",
                "https://c.tenor.com/TYNpGhXizs0AAAAd/tenor.gif",
            ]

            const gifsTetrics = [
                "https://c.tenor.com/3_F3UqbaXsoAAAAd/tenor.gif",
                "https://c.tenor.com/YDkPLFghGXQAAAAd/tenor.gif",
                "https://c.tenor.com/-vOy1q13l7oAAAAd/tenor.gif",
                "https://c.tenor.com/l5URyKeqmvAAAAAd/tenor.gif",
                "https://c.tenor.com/8G8ZZg5e-McAAAAd/tenor.gif",
                "https://c.tenor.com/s_qhCPncTNgAAAAd/tenor.gif",
                "https://c.tenor.com/r8tIml0Dv9QAAAAd/tenor.gif",
                "https://c.tenor.com/6eOFyYUIA5YAAAAd/tenor.gif",
                "https://c.tenor.com/TSp7BYGJitEAAAAd/tenor.gif",
            ]

            const TitleMessage = getRandomMessage(messagesTitle)
            const DescMessage = getRandomMessage(messageDescriptions)
            const secretMessage = getRandomMessage(messageSecrets, [true, 0.1])
            const gifSelect = getRandomMessage(gifsNormal)
            let gifsSelectSecret;

            if (secretMessage.isSecret) {
                gifsSelectSecret = getRandomMessage(gifsTetrics)
            }

            const messageFields = secretMessage.isSecret ? "<:IseeU:1351788227685646377> *̵̻̈r̶͈̂ā̸̘l̸̹̋ë̴̫ṭ̶̂s̴̘̈́ē̷̥ ̶͉͛o̴͕͌t̵̳͊ṅ̴̗ẹ̷͠m̷̥͂g̸̱̓a̷̮̕r̸̢̋F̷̟͛*̵̧̊ ̵̣̆*̴̪̃*̵̭̆1̷̭̇*̵͇̿*̷̟̀" : "<a:KrisJojos:1350664814414004395> **1** *Fragmento estelar*"


            const embed = new EmbedBuilder()
                .setTitle(secretMessage.isSecret ? "s̴͎̚a̸̦̚ĺ̴̞l̷͙̿e̵̓͜r̵͍̽t̴͔̀s̴̟̓e̸̗͗ ̵͚̔s̴̞͆a̷̙͋l̸̘̄ ̸̢̍a̷͔̿i̵͍̎c̴͖͝ã̵̪h̷͓͛ ̶̪̄ò̴̜s̸͎̚n̸̯̊e̶̿͜c̶͖̀s̵̠͛Â̷̳" : TitleMessage.message)
                .setDescription("**¡Felicidades! Has subido al nivel `" + `${soul.nivelMagico + 1}` +
                    "`\n*Tus estadisticas han aumentado*" +
                    "**\n\n-# " + `${secretMessage.isSecret ? secretMessage.message : DescMessage.message}`)
                .addFields(
                    { name: "Has obtenido", value: `${messageFields}` }
                )
                .setTimestamp()
                .setColor("Random")
                .setImage(secretMessage.isSecret ? gifsSelectSecret.message : gifSelect.message)

            return embed
        }

        return false

        function getRandomMessage(array, isProbability = [false, 0]) {
            let message;
            if (isProbability[0] && Math.random() < isProbability[1]) {
                return { message: array[Math.floor(Math.random() * array.length)], isSecret: true }
            }

            message = array[Math.floor(Math.random() * array.length)]

            return { message: message, isSecret: false };
        }
    },


    /**
     * Ajusta el inventario de un personaje: suma moneda, xp o items,
     * y elimina automáticamente los items con Cantidad ≤ 0.
     *
     * @param {String} characterId  ID o _id del personaje
     * @param {Object} changes      Cambios a aplicar:
     *   - lumens:    número (positivo o negativo)
     *   - xp:        número (positivo o negativo)
     *   - items:     array de objetos { ID, Region, Nombre, Tipo, Cantidad, instanciaID? }
     *
     * @returns {Object} Resultado con éxito y mensajes opcionales.
     */
    actualizarInventario: async function (characterId, changes) {
        const { lumens = 0, xp = 0, items = [] } = changes

        // 1) Prepara los operadores de Mongo
        const updateOps = {};
        if (lumens !== 0) updateOps["$inc"] = { Dinero: lumens };
        if (xp !== 0) {
            updateOps["$inc"] = Object.assign(updateOps["$inc"] || {}, { XP: xp });
        }

        const bulkItemUpdates = [];
        for (const item of items) {
            const { ID, Region, Cantidad, instanciaID } = item;
            // Criterio de búsqueda: por instanciaID si existe, si no por ID+Region
            const match = instanciaID
                ? { instanciaID, Region }
                : { ID, Region };

            bulkItemUpdates.push({
                updateOne: {
                    filter: { $and: [{ _id: characterId }, { "Inventario": { $elemMatch: match } }] },
                    update: { $inc: { "Inventario.$.Cantidad": Cantidad } }
                }
            });

            // Y un push “upsert” para cuando no exista
            bulkItemUpdates.push({
                updateOne: {
                    filter: { _id: characterId, "Inventario": { $not: { $elemMatch: match } } },
                    update: {
                        $push: {
                            Inventario: Object.assign(
                                { ID, Region, Nombre: item.Nombre, Tipo: item.Tipo, Fecha: new Date().toISOString() },
                                instanciaID ? { instanciaID } : {},
                                { Cantidad }
                            )
                        }
                    }
                }
            });
        }

        // 3) Operación para limpiar inventario de ítems sin cantidad
        const pullZero = {
            updateOne: {
                filter: { _id: characterId },
                update: { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
            }
        };

        // 4) Ejecuta todo en bulkWrite (incluye moneda/xp y limpieza)
        const bulkOps = [];
        if (Object.keys(updateOps).length) {
            bulkOps.push({ updateOne: { filter: { _id: characterId }, update: updateOps } });
        }
        bulkOps.push(...bulkItemUpdates, pullZero);

        try {
            await personajes.bulkWrite(bulkOps, { ordered: true });
            return { success: true, message: "Inventario ajustado correctamente." };
        } catch (err) {
            console.error("Error ajustando inventario:", err);
            return { success: false, message: "Falló la actualización del inventario." };
        }


        const personaje = await personajes.findOne({
            $or: [
                { ID: characterId },
                { _id: characterId }
            ]
        })
        const objinfoa = await dbobjetos.findOne({ _id: data.Region, "Objetos.ID": data.ID }, { projection: { _id: 0, "Objetos.$": 1 } })
        const objinfo = objinfoa?.Objetos?.[0]



        if (!data.isItem) {
            if (data.typeLoot === "lumens") {
                if (isNaN(data.cantidad)) return `Hubo un error al asignar este valor: ${data.cantidad} - No es un numero`

                await personajes.updateOne({ ID: personaje.ID }, {
                    $inc: {
                        Dinero: data.cantidad
                    }
                })
            } else if (data.typeLoot === "xp") {
                if (isNaN(data.cantidad)) return `Hubo un error al asignar este valor: ${data?.cantidad} - No es un numero`

                const messageXP = await getXPSoul(interaction, characterId, data.cantidad)


                if (messageXP) {

                    levelsEmitter.emit('levelUp', client, interaction, personaje, messageXP)

                    return { message: "`Felicidades, tu personaje ha subido de nivel`", embed: messageXP }
                }


            } else {
                return `No se ha asignado ningun valor, parece ser que este objeto no corresponde a nada: ${typeLoot}`
            }

            return `Se ha asignado correctamente: ${data.typeLoot} - ${data.cantidad} - ${characterId}`
        }

        if (!objinfoa) {
            const channel = client.channels.cache.get("716518718947065868")

            const embedError = new EmbedBuilder()
                .setTitle("Error al agregar un objeto")
                .setDescription(`El objeto que intentas agregar no existe. Es posible que se trate de un objeto eliminado`)
                .addFields(
                    { name: "Objeto?", value: `ID: ${data.ID}\nRegion: ${data.Region}\nEs un... ${data.isItem ? "Objeto" : data.typeLoot}`, inline: true },
                    { name: "Cantidad", value: `${data.cantidad}`, inline: true },
                    { name: "Personaje", value: `[${personaje.ID}] ${personaje.Nombre}`, inline: true },
                    { name: "Resultado (objeto.Nombre)", value: `${objinfo?.Nombre}`, inline: true }
                )
            console.log("Objeto no encontrado", objinfoa)

            return channel.send({ embeds: [embedError] })
        }

        let objfind

        if (typeof data.instanciaID !== "undefined") {
            objfind = personaje.Inventario.find(obj => obj.instanciaID === data.instanciaID && obj.Region === data.Region)
        } else {
            objfind = personaje.Inventario.find(obj => obj.ID === data.ID && obj.Region === data.Region);
        }


        let IDdef = data.instanciaID ? data.instanciaID : data.ID
        let Select = data.instanciaID ? `instanciaID` : `ID`


        try {

            //Permite obtener objetos que estén dentro de un regalo o Mail del usuario.
            //La estructura es distinta a la de los objetos convencionales pues manejan una instancia ID para evitar conflictos con los objetos originales
            if (data?.isMailContent && data?.instanciaID) {
                await personajes.updateOne({ ID: personaje.ID }, {
                    $push: {
                        Inventario: {
                            ...data.itemComplet
                        }
                    }
                })

                return { success: true, messages: "Se ha agregado el regalo correctamente" }
            }


            if (objfind) {
                console.log(objfind, data.instanciaID)
                await personajes.updateOne({ ID: personaje.ID, Inventario: { $elemMatch: { [`${Select}`]: IDdef, Region: objfind.Region } } }, {
                    $inc: {
                        "Inventario.$.Cantidad": data.cantidad
                    }
                })
            } else {
                if (data.instanciaID) {
                    console.log("InstanciaId")
                    await personajes.updateOne({ ID: personaje.ID }, {
                        $push: {
                            Inventario: {
                                ID: objinfo.ID,
                                Region: `${objinfo.Region}`,
                                Nombre: `${objinfo.Nombre}`,
                                Tipo: data.Tipo,
                                Cantidad: data.cantidad,
                                Fecha: new Date().toISOString()
                            }
                        }
                    })
                } else {

                    await personajes.updateOne({ ID: personaje.ID }, {
                        $push: {
                            Inventario: {
                                ID: objinfo.ID,
                                Region: `${objinfo.Region}`,
                                Nombre: `${objinfo.Nombre}`,
                                Tipo: data.Tipo,
                                Cantidad: data.cantidad,
                                Fecha: new Date().toISOString()
                            }
                        }
                    })
                }


            }

            await personajes.updateOne(
                { ID: personaje.ID },
                { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
            );

            console.log("Inventario actualizado")

            return { success: true, messages: "Inventario actualizado correctamente" }

        } catch (error) {

            console.error(error)
            const channel = client.channels.cache.get("716518718947065868")

            const embedError = new EmbedBuilder()
                .setTitle("Error al agregar un objeto")
                .setDescription("```" + error + "```")
                .addFields(
                    { name: "Objeto?", value: `ID: ${data.ID}\nRegion: ${data.Region}\nEs un... ${data.isItem ? "Objeto" : data.typeLoot}`, inline: true },
                    { name: "Cantidad", value: `${data.cantidad}`, inline: true },
                    { name: "Personaje", value: `[${personaje.ID}] ${personaje.Nombre}`, inline: true },
                    { name: "Resultado (objeto.Nombre)", value: `${objinfo?.Nombre}`, inline: true }
                )

            channel.send({ embeds: [embedError] })

            return { success: false, messages: "No se pudo actualizar el inventario" }

        }




    },

    updateCharacterInventory: async function (characterId, data, personajes, interaction) {
        let personaje; // Variable para almacenar la información del personaje
        let objinfo;   // Variable para almacenar la información del objeto (si es un item)

        try {
            // 1. Buscar el personaje. Es crucial tener el _id del personaje para las operaciones bulk.
            personaje = await personajes.findOne({
                $or: [
                    { ID: characterId },
                    { _id: characterId }
                ]
            });

            if (!personaje) {
                // Manejo de error si el personaje no se encuentra
                return { success: false, messages: `Personaje con ID ${characterId} no encontrado.` };
            }

            const bulkOperations = []; // Array para almacenar todas las operaciones bulk

            // --- Manejo de loot que no son ítems (lumens, XP) ---
            if (!data.isItem) {
                if (data.typeLoot === "lumens") {
                    if (isNaN(data.cantidad)) {
                        return `Hubo un error al asignar este valor: ${data.cantidad} - No es un numero`;
                    }
                    // Añadir operación de incremento de dinero a las operaciones bulk
                    bulkOperations.push({
                        updateOne: {
                            filter: { _id: personaje._id }, // Usar _id para apuntar directamente al documento
                            update: { $inc: { Dinero: data.cantidad } }
                        }
                    });
                } else if (data.typeLoot === "xp") {
                    if (isNaN(data.cantidad)) {
                        return `Hubo un error al asignar este valor: ${data?.cantidad} - No es un numero`;
                    }
                    // La lógica de XP involucra una función externa y un emisor de eventos,
                    // por lo que se maneja por separado y no como parte del bulkWrite de MongoDB.
                    const messageXP = await getXPSoul(interaction, characterId, data.cantidad);
                    if (messageXP) {
                        levelsEmitter.emit('levelUp', client, interaction, personaje, messageXP);
                        return { message: "`Felicidades, tu personaje ha subido de nivel`", embed: messageXP };
                    }
                } else {
                    // Si el tipo de loot no es reconocido
                    return `No se ha asignado ningun valor, parece ser que este objeto no corresponde a nada: ${data.typeLoot}`;
                }

                // Si solo se procesó dinero (lumens), ejecutar el bulk y retornar.
                // Si fue XP, ya se retornó arriba si hubo subida de nivel.
                if (bulkOperations.length > 0) {
                    await personajes.bulkWrite(bulkOperations, { ordered: true });
                    return { success: true, messages: `Se ha asignado correctamente: ${data.typeLoot} - ${data.cantidad} - ${characterId}` };
                } else {
                    // Caso para XP que no resultó en subida de nivel o otros tipos de loot no item
                    return `Se ha procesado la solicitud de ${data.typeLoot} para ${characterId}.`;
                }
            }

            // --- Manejo de ítems ---
            // 2. Obtener información detallada del objeto si es un ítem y no viene de un mail (que ya trae itemComplet)
            if (data.isItem && !data.isMailContent) {
                const objinfoa = await dbobjetos.findOne(
                    { _id: data.Region, "Objetos.ID": data.ID },
                    { projection: { _id: 0, "Objetos.$": 1 } }
                );
                objinfo = objinfoa?.Objetos?.[0];

                if (!objinfoa) {
                    // Manejo de error si el objeto no se encuentra en la base de datos de objetos
                    const channel = client.channels.cache.get("716518718947065868");
                    const embedError = new EmbedBuilder()
                        .setTitle("Error al agregar un objeto")
                        .setDescription(`El objeto que intentas agregar no existe. Es posible que se trate de un objeto eliminado`)
                        .addFields(
                            { name: "Objeto?", value: `ID: ${data.ID}\nRegion: ${data.Region}\nEs un... ${data.isItem ? "Objeto" : data.typeLoot}`, inline: true },
                            { name: "Cantidad", value: `${data.cantidad}`, inline: true },
                            { name: "Personaje", value: `[${personaje.ID}] ${personaje.Nombre}`, inline: true },
                            { name: "Resultado (objeto.Nombre)", value: `${objinfo?.Nombre || 'N/A'}`, inline: true }
                        );
                    console.log("Objeto no encontrado", objinfoa);
                    return channel.send({ embeds: [embedError] });
                }
            }

            // Si es contenido de correo (mail), se añade directamente el itemComplet
            if (data?.isMailContent && data?.instanciaID) {
                bulkOperations.push({
                    updateOne: {
                        filter: { _id: personaje._id },
                        update: { $push: { Inventario: { ...data.itemComplet } } }
                    }
                });
            } else {
                // Para ítems regulares, se usa la lógica de upsert (incrementar si existe, añadir si no)
                const matchQuery = data.instanciaID
                    ? { instanciaID: data.instanciaID, Region: data.Region }
                    : { ID: data.ID, Region: data.Region };

                // Operación 1: Intentar incrementar la cantidad si el ítem ya existe en el inventario
                bulkOperations.push({
                    updateOne: {
                        filter: { _id: personaje._id, Inventario: { $elemMatch: matchQuery } },
                        update: { $inc: { "Inventario.$.Cantidad": data.cantidad } }
                    }
                });

                // Operación 2: Si el ítem no existe (la operación anterior no encontró match), añadirlo al inventario
                // Esta es la parte "upsert" de la lógica.
                bulkOperations.push({
                    updateOne: {
                        filter: { _id: personaje._id, Inventario: { $not: { $elemMatch: matchQuery } } },
                        update: {
                            $push: {
                                Inventario: {
                                    ID: objinfo.ID,
                                    Region: `${objinfo.Region}`,
                                    Nombre: `${objinfo.Nombre}`,
                                    Tipo: data.Tipo, // Se usa data.Tipo como en tu código original
                                    Cantidad: data.cantidad,
                                    Fecha: new Date().toISOString(),
                                    ...(data.instanciaID && { instanciaID: data.instanciaID }) // Añadir instanciaID si está presente
                                }
                            }
                        }
                    }
                });
            }

            // 3. Operación para limpiar el inventario (eliminar ítems con cantidad menor o igual a 0)
            bulkOperations.push({
                updateOne: {
                    filter: { _id: personaje._id },
                    update: { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
                }
            });

            // 4. Ejecutar todas las operaciones bulk en orden
            await personajes.bulkWrite(bulkOperations, { ordered: true });

            console.log("Inventario actualizado");
            return { success: true, messages: "Inventario actualizado correctamente" };

        } catch (error) {
            // Manejo de errores centralizado
            console.error(error);
            const channel = client.channels.cache.get("716518718947065868");
            const embedError = new EmbedBuilder()
                .setTitle("Error al agregar un objeto")
                .setDescription("```" + error + "```")
                .addFields(
                    { name: "Objeto?", value: `ID: ${data.ID}\nRegion: ${data.Region}\nEs un... ${data.isItem ? "Objeto" : data.typeLoot}`, inline: true },
                    { name: "Cantidad", value: `${data.cantidad}`, inline: true },
                    { name: "Personaje", value: `[${personaje?.ID || 'N/A'}] ${personaje?.Nombre || 'N/A'}`, inline: true },
                    { name: "Resultado (objeto.Nombre)", value: `${objinfo?.Nombre || 'N/A'}`, inline: true }
                );
            channel.send({ embeds: [embedError] });
            return { success: false, messages: "No se pudo actualizar el inventario" };
        }
    },

    asignarMisionesDiarias: async function (characterId) {
        const personaje = await personajes.findOne({ _id: characterId })
        if (!personaje) return null

        const hoy = new Date().setHours(0, 0, 0, 0);
        const misionesDeHoy = personaje.misionesDiarias?.filter(m =>
            new Date(m.fechaAsignacion).setHours(0, 0, 0, 0) === hoy
        );

        if (misionesDeHoy && misionesDeHoy.length > 0) {
            return personaje.misionesDiarias; // Ya tiene misiones, solo las devolvemos
        }

        const poolDiario = await db.collection('misiones_diarias').findOne({
            fecha: { $gte: new Date(hoy) }
        });


        if (!poolDiario || poolDiario.misiones.length === 0) {
            console.log('No hay un pool de misiones diarias activo.');
            return personaje.misionesDiarias || []; // No hay misiones para asignar
        }

        const misionesElegibles = poolDiario.misiones.filter(mision =>
            personaje.nivel >= mision.requisitos.nivelMinimo &&
            (mision.requisitos.sendero === 'cualquiera' || mision.requisitos.sendero === personaje.sendero)
        );

        const numeroDeMisiones = Math.min(misionesElegibles.length, Math.floor(Math.random() * 4) + 1);
        const misionesAsignadas = [];
        const misionesDisponibles = [...misionesElegibles];

        for (let i = 0; i < numeroDeMisiones; i++) {
            const randomIndex = Math.floor(Math.random() * misionesDisponibles.length);
            const plantilla = misionesDisponibles.splice(randomIndex, 1)[0];

            const fechaAsignacion = new Date();
            const fechaExpiracion = new Date();
            // La expiración es a las 23:30 del día actual
            fechaExpiracion.setHours(23, 30, 0, 0);

            const nuevaMision = {
                missionId: plantilla.missionId,
                nombre: plantilla.nombre,
                progresoActual: 0,
                objetivoMeta: plantilla.objetivo.meta,
                status: 'activa',
                recompensa: plantilla.recompensa,
                fechaAsignacion,
                metodo: plantilla.objetivo.metodo,
            };

            // Preparamos el snapshot inicial según el método
            switch (plantilla.objetivo.metodo) {
                case 'estadistica':
                    const campo = plantilla.objetivo.campoRastreado;

                    if (plantilla?.data === "soul") {
                        const soul = await souls.findOne({ _id: characterId })
                        const valorStat = campo.split('.').reduce((o, k) => o?.[k], soul) || 0;
                        nuevaMision.progresoInicial = valorStat
                        nuevaMision.campoRastreado = campo
                    } else {
                        const valorStat = campo.split('.').reduce((o, k) => o?.[k], personaje) || 0;
                        nuevaMision.progresoInicial = valorStat;
                        nuevaMision.campoRastreado = campo;
                    }

                    break;
                case 'snapshotInventario':
                    const item = personaje.Inventario?.find(i => i.itemId === plantilla.objetivo.itemId);
                    nuevaMision.progresoInicial = item?.cantidad || 0;
                    nuevaMision.itemIdRastreado = plantilla.objetivo.itemId;
                    break;
            }
            misionesAsignadas.push(nuevaMision);
        }

        const misionesViejas = personaje.misionesDiarias?.filter(m =>
            new Date(m.fechaAsignacion).setHours(0, 0, 0, 0) !== hoy
        ) || [];

        const misionesFinales = [...misionesViejas, ...misionesAsignadas];

        await personajes.updateOne(
            { _id: personaje._id },
            { $set: { misionesDiarias: misionesFinales } }
        );

        return misionesFinales;
    },


}
