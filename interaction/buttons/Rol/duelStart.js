const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const userData = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const npcs = db2.collection("NPCs")
const transaccionCache = require("../../../utils/cache")
const getXp = require("../../../functions/getXP")
const { duelSystem } = require("../../../functions/Duelo/duelManager")
const interfazCreate = require("../../../functions/interfazCreate")
const verificarCondiciones = require("../../../functions/Duelo/verificarCondiciones")
const combateUI = require("../../../functions/Duelo/combateUI")
const { crearBoton } = require("../../../utils/constructores/crearComponente")

module.exports = crearBoton({
    customId: "preDuel",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true },
        soul: { require: true, obtener: true }
    },

    ejecutar: async ({ client, interaction, character, soul, componentData: { userId, extras } }) => {
        const [id, cache, response] = extras;

        const getCache = transaccionCache.get(cache)

        console.log("Cache obtenida:", response, id)

        if (!getCache) return interaction.reply({ content: "Esta interacción ya expiro ＞﹏＜", flags: ["Ephemeral"] });

        //Aqui empieza la logica para unirse a la sala
        if (getCache.code) {
            if (id === "team1" || id === "team2") {
                const activeCharacter = await userData.findOne({ _id: interaction.user.id })
                const ocupado = await interfazCreate.personajeOcupado(activeCharacter.nix.personajeActivo)
                if (ocupado) {
                    return interaction.reply({ components: ocupado, flags: ["Ephemeral", "IsComponentsV2"] })
                }



                const character = await characters.findOne({ _id: activeCharacter.nix.personajeActivo })
                if (!character) return interaction.reply({ content: "Ocurrio un error al ingresar al duelo [Personaje no encontrado]\n-# Vuelve a usar el comando", flags: ["Ephemeral"] })
                const soul = await souls.findOne({ _id: character._id })

                // Verificar y congelar apuestas de la sala de acuerdo a sus reglas
                if (getCache.apuestas && (getCache.apuestas.lumens > 0 || (getCache.apuestas.objetos && getCache.apuestas.objetos.length > 0))) {
                    const playerLumens = character.economia?.Lumens ?? 0;
                    const tipo = getCache.tipoApuesta || 'espejo';

                    let lumensAFreeze = 0;
                    let objetosAFreeze = [];

                    if (tipo === 'espejo') {
                        if (playerLumens < getCache.apuestas.lumens) {
                            return interaction.reply({ content: `No tienes suficientes Lumens para unirte. La sala requiere apostar exactamente **${getCache.apuestas.lumens} Lumens** (tienes ${playerLumens}).`, flags: ["Ephemeral"] });
                        }

                        for (const reqObj of getCache.apuestas.objetos) {
                            const playerObj = (character.economia?.Inventario || []).find(i => i.ID === reqObj.id || i.Nombre === reqObj.nombre);
                            const invCantidad = playerObj ? (playerObj.Cantidad ?? playerObj.cantidad ?? 0) : 0;
                            if (invCantidad < reqObj.cantidad) {
                                return interaction.reply({ content: `No tienes suficientes **${reqObj.nombre}** para unirte a este duelo espejo (requieres ${reqObj.cantidad}, tienes ${invCantidad}).`, flags: ["Ephemeral"] });
                            }
                            objetosAFreeze.push({ id: reqObj.id, nombre: reqObj.nombre, cantidad: reqObj.cantidad });
                        }
                        lumensAFreeze = getCache.apuestas.lumens || 0;
                    }
                    else if (tipo === 'equivalente') {
                        if (playerLumens < getCache.apuestas.lumens) {
                            return interaction.reply({ content: `No tienes suficientes Lumens para unirte. La sala requiere apostar exactamente **${getCache.apuestas.lumens} Lumens** (tienes ${playerLumens}).`, flags: ["Ephemeral"] });
                        }

                        const creatorCharacterId = Number(Object.keys(getCache.team1).find(k => !isNaN(k)) || Object.keys(getCache.team1)[0]);
                        const creatorChar = await characters.findOne({ _id: creatorCharacterId });
                        const creatorInv = creatorChar?.economia?.Inventario || [];

                        const playerInvCopy = (character.economia?.Inventario || []).map(i => ({ ...i }));

                        for (const reqObj of getCache.apuestas.objetos) {
                            const creatorItem = creatorInv.find(i => i.ID === reqObj.id || i.Nombre === reqObj.nombre);
                            const requiredRarity = creatorItem?.Rareza;
                            if (!requiredRarity) {
                                return interaction.reply({ content: `Error: No se pudo determinar la rareza de la apuesta del creador: ${reqObj.nombre}.`, flags: ["Ephemeral"] });
                            }

                            const matchingItem = playerInvCopy.find(i => i.Rareza === requiredRarity && (i.Cantidad ?? i.cantidad ?? 0) >= reqObj.cantidad);
                            if (!matchingItem) {
                                return interaction.reply({ content: `No tienes ningún objeto de rareza **${requiredRarity}** con cantidad suficiente (${reqObj.cantidad}) para igualar la apuesta equivalente.`, flags: ["Ephemeral"] });
                            }

                            if (typeof matchingItem.Cantidad !== 'undefined') matchingItem.Cantidad -= reqObj.cantidad;
                            else matchingItem.cantidad -= reqObj.cantidad;

                            objetosAFreeze.push({
                                id: matchingItem.ID || matchingItem.id,
                                nombre: matchingItem.Nombre || matchingItem.nombre,
                                cantidad: reqObj.cantidad
                            });
                        }
                        lumensAFreeze = getCache.apuestas.lumens || 0;
                    }
                    else if (tipo === 'fijo') {
                        if (playerLumens < getCache.apuestas.lumens) {
                            return interaction.reply({ content: `No tienes suficientes Lumens para unirte. La sala requiere apostar exactamente **${getCache.apuestas.lumens} Lumens** (tienes ${playerLumens}).`, flags: ["Ephemeral"] });
                        }
                        lumensAFreeze = getCache.apuestas.lumens || 0;
                    }

                    // Congelar los recursos en base de datos (excepto Entrada Libre)
                    if (tipo !== 'libre') {
                        const congelarHelper = require("../../../functions/Economia/congelarHelper");
                        const congeladoOk = await congelarHelper.congelar(character._id, lumensAFreeze, objetosAFreeze);
                        if (!congeladoOk) {
                            return interaction.reply({ content: "Error al intentar congelar tus recursos de la apuesta. Verifica que tengas los lumens/objetos necesarios.", flags: ["Ephemeral"] });
                        }
                    }
                }
                const { aspiracion, Historia, Cumpleaños, Peso, Estatura, Descripcion, Familia, CiudadOrg, Sexo, ...infoperfil } = character.perfil || {}
                const { XP, energy, lastEnergyUpdate, energiaAlmica, ...infoNucleo } = soul.nucleo || {}

                const characterData = {
                    ownerId: interaction.user.id,
                    perfil: infoperfil,
                    social: { compañero: character.social?.compañero, team: character.social?.team },
                    nucleo: infoNucleo,
                    stats: soul.stats,
                    dominio: soul.dominio,
                    sendero: soul.sendero
                }

                getCache[id][character._id] = characterData

                const autorUser = await client.users.fetch(getCache.autor).catch(() => null);
                const waitingMessage = await combateUI.buildSalaMessage(autorUser || interaction.user, getCache.isPrivate, getCache, true, interaction.user)

                if (getCache.autor !== interaction.user.id) {
                    try {
                        await interaction.user.send({ components: waitingMessage, flags: ["IsComponentsV2"] })
                        await transaccionCache.setStatus(character._id, { code: 1, salaCode: getCache.code, Nombre: "En sala" }, { active: true, time: 3000 })
                    } catch (error) {
                        console.log(error)
                        return interaction.reply({ content: "No puedo enviarte el mensaje de la sala...\n-# Verifica tus DM para poder unirte", flags: ["Ephemeral"] })
                    }
                }

                const message = await combateUI.buildSalaMessage(autorUser || interaction.user, getCache.isPrivate, getCache)

                if (getCache.messageAutor && getCache.messageAutor.channel && getCache.messageAutor.message) {
                    try {
                        const messageAutor = await client.channels.fetch(getCache.messageAutor.channel).then(c => c.messages.fetch(getCache.messageAutor.message))
                        await messageAutor.edit({ components: message.salaMessage })
                        interaction.reply({ content: "Te has unido correctamente a la sala. Espera a que el administrador la inicie\n-# Puedes borrar este mensaje", flags: ["Ephemeral"] })
                    } catch (error) {
                        if (error.code === 10008) {
                            interaction.reply({ content: "Ocurrio un error al ingresar a la sala. Es posible que esta ya no exista...", flags: ["Ephemeral"] })
                        } else {
                            console.log(error)
                            interaction.reply({ content: "Te has unido correctamente a la sala. Espera a que el administrador la inicie\n-# Puedes borrar este mensaje", flags: ["Ephemeral"] })
                        }
                    }
                } else {
                    interaction.reply({ content: "Te has unido correctamente a la sala. Espera a que el administrador la inicie\n-# Puedes borrar este mensaje", flags: ["Ephemeral"] })
                }

                if (getCache.messageServer && getCache.messageServer.channel && getCache.messageServer.message) {
                    try {
                        const messageServer = await interaction.guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                        await messageServer.edit({ components: message.serverMessage })
                    } catch (error) {
                        console.log(error)
                        if (error.code === 10008) {
                            const channel = await interaction.guild.channels.fetch("1434739977291567215")
                            await channel.send({ components: message.serverMessage, flags: ["IsComponentsV2"] }).then(m => {
                                getCache.messageServer.guild = interaction.guild.id
                                getCache.messageServer.channel = m.channelId
                                getCache.messageServer.message = m.id
                            })
                        }
                    }
                }


                //Aqui termina la logica para unirse a la sala
            }

            if (id === "delete") {
                await interaction.deferReply()

                try {
                    if (getCache.messageAutor && getCache.messageAutor.channel && getCache.messageAutor.message) {
                        const messageAutor = await client.channels.fetch(getCache.messageAutor.channel).then(c => c.messages.fetch(getCache.messageAutor.message))
                        messageAutor.delete().catch(() => null)
                    }
                } catch (error) {
                    console.warn("No se pudo eliminar el mensaje de la sala en el autor", error)
                }

                try {
                    if (getCache.messageServer && getCache.messageServer.guild && getCache.messageServer.channel && getCache.messageServer.message) {
                        const guild = await client.guilds.fetch(getCache.messageServer.guild)
                        const messageServer = await guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                        messageServer.delete().catch(() => null)
                    }
                } catch (error) {
                    console.warn("No se pudo eliminar el mensaje de la sala en el servidor", error)
                }

                try {
                    const charactersToFree = [
                        ...Object.keys(getCache.team1 || {}),
                        ...Object.keys(getCache.team2 || {})
                    ];
                    const congelarHelper = require("../../../functions/Economia/congelarHelper");
                    for (const characterId of charactersToFree) {
                        const char = await characters.findOne({ _id: Number(characterId) });
                        if (char && char.economia?.congelado) {
                            await congelarHelper.descongelar(char._id, char.economia.congelado.lumens, char.economia.congelado.objetos);
                        }
                        transaccionCache.deleteStatus(characterId)
                        console.log("Personaje liberado y descongelado correctamente", characterId)
                    }
                    console.warn("Personajes liberados correctamente")

                    transaccionCache.delete(cache)

                    const cacheExiste = transaccionCache.get(cache)
                    console.warn("Sala eliminada correctamente\n Verificación (¿vacio?):", cacheExiste)

                } catch (error) {
                    console.log(error)
                    return interaction.editReply({ content: "Ocurrio un error al intentar eliminar esta sala...\n Intenta de nuevo, si el error persiste contacta con el owner ＞﹏＜" })
                }

                interaction.editReply({ content: "Sala eliminada correctamente... ＞﹏＜" })
            }

            if (id === "salirse") {
                if (getCache.estado === "En combate") return interaction.reply({ content: "¡El duelo ha comenzado!. No puedes huir, ya es demasiado tarde...", flags: ["Ephemeral"] })

                const activeCharacter = await userData.findOne({ _id: interaction.user.id })
                const character = await characters.findOne({ _id: activeCharacter.nix.personajeActivo })

                // Descongelar recursos del jugador antes de sacarlo de los equipos
                if (character && character.economia?.congelado) {
                    const congelarHelper = require("../../../functions/Economia/congelarHelper");
                    await congelarHelper.descongelar(character._id, character.economia.congelado.lumens, character.economia.congelado.objetos);
                }

                delete getCache.team1[character._id]
                delete getCache.team2[character._id]

                const seBorroCorrectamente = !getCache.team1.hasOwnProperty(character._id) || !getCache.team2.hasOwnProperty(character._id)
                const autor = await client.users.fetch(getCache.autor)
                const message = await combateUI.buildSalaMessage(autor, getCache.isPrivate, getCache)

                if (getCache.messageAutor && getCache.messageAutor.channel && getCache.messageAutor.message) {
                    try {
                        const messageAutor = await client.channels.fetch(getCache.messageAutor.channel).then(c => c.messages.fetch(getCache.messageAutor.message))
                        await messageAutor.edit({ components: message.salaMessage })
                    } catch (error) {
                        console.log(error)
                    }
                }

                if (seBorroCorrectamente) {
                    transaccionCache.deleteStatus(character._id)
                    interaction.reply({ content: "Has salido correctamente de la sala.\n-# Puedes borrar este mensaje", flags: ["Ephemeral"] })
                } else {
                    interaction.reply({ content: "No has podido salir de la sala.\n-# Es posible que se trate de un error, intenta de nuevo...", flags: ["Ephemeral"] })
                }

                try {
                    const guild = await client.guilds.fetch(getCache.messageServer.guild)
                    const messageServer = await guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                    messageServer.edit({ components: message.serverMessage })
                } catch (error) {
                    console.log(error)
                    if (error.code === 10008) {
                        const channel = await interaction.guild.channels.fetch("1434739977291567215")
                        await channel.send({ components: message.serverMessage, flags: ["IsComponentsV2"] }).then(m => {
                            getCache.messageServer.guild = interaction.guild.id
                            getCache.messageServer.channel = m.channelId
                            getCache.messageServer.message = m.id
                        })
                    }
                }

            }

            if (id === "publica" || id === "privada") {
                console.log("Cambiando privacidad de la sala a:", id)
                getCache.isPrivate = id === "privada" ? true : false
                const message = await combateUI.buildSalaMessage(await client.users.fetch(getCache.autor), getCache.isPrivate, getCache)

                try {
                    interaction.update({ components: message.salaMessage })


                } catch (error) {
                    if (error.code === 10008) {
                        interaction.reply({ content: "Ocurrio un error al cambiar la privacidad de la sala. Es posible que esta ya no exista...", flags: ["Ephemeral"] })
                    } else {
                        console.log(error)
                        interaction.reply({ content: "Ocurrio un error al cambiar la privacidad de la sala. [Error desconocido]", flags: ["Ephemeral"] })
                    }
                }
                try {
                    const guild = await client.guilds.fetch(getCache.messageServer.guild)
                    const messageServer = await guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                    messageServer.edit({ components: message.serverMessage })
                } catch (error) {
                    console.log(error)
                    if (error.code === 10008) {
                        const channel = await interaction.guild.channels.fetch("1434739977291567215")
                        await channel.send({ components: message.serverMessage, flags: ["IsComponentsV2"] }).then(m => {
                            getCache.messageServer.guild = interaction.guild.id
                            getCache.messageServer.channel = m.channelId
                            getCache.messageServer.message = m.id
                        })
                    }
                }
            }

            if (id === "start") {
                await interaction.deferReply()
                const team1Ids = Object.keys(getCache.team1)
                const team2Ids = Object.keys(getCache.team2)
                const todosIds = [...team1Ids, ...team2Ids]

                // Filtrar solo IDs de jugadores reales (omitir NPCs)
                const playerIds = todosIds.filter(id => {
                    const charObj = getCache.team1[id] || getCache.team2[id];
                    return charObj && !charObj.isNPC && !isNaN(id);
                });

                //Verificar MDs (solo a jugadores)
                const verificarMds = playerIds.map(async (characterId) => {
                    const ownerId = getCache.team1[characterId]?.ownerId ?? getCache.team2[characterId]?.ownerId
                    if (!ownerId) return;

                    try {
                        const user = await client.users.fetch(ownerId)
                        const md = await user.createDM()
                        const m = await md.send({
                            content: "-# Mensaje de comprobación (se borra en 3s).",
                            flags: "SuppressNotifications"
                        })
                        setTimeout(() => m.delete().catch(e => { }), 3000);
                        return { characterId, ownerId, md };
                    } catch (e) {
                        const user = client.users.cache.get(ownerId)
                        throw new Error(`\`${user ? user.globalName : `Usuario (${ownerId})`}\` tiene los DMs deshabilitados.`)
                    }
                })

                const results = await Promise.allSettled(verificarMds)
                const errores = results
                    .filter(result => result.status === 'rejected')
                    .map(result => result.reason.message)

                if (errores.length > 0) {
                    return interaction.editReply({
                        content: "**No se puede iniciar el duelo porque los siguientes usuarios no cumplen un requisito:**\n" +
                            `${errores.join("\n")}`
                    })
                }

                const soulsFrescos = await Promise.all(
                    playerIds.map(characterId => souls.findOne({ _id: Number(characterId) }))
                )

                const erroresCondiciones = []

                soulsFrescos.forEach((soul, index) => {
                    const characterId = playerIds[index]
                    const ownerId = getCache.team1[characterId]?.ownerId
                        ?? getCache.team2[characterId]?.ownerId
                    const verificar = verificarCondiciones(ownerId, soul)
                    if (!verificar.puede) {
                        const nombre = getCache.team1[characterId]?.perfil?.Nombre ?? getCache.team1[characterId]?.Nombre ?? getCache.team2[characterId]?.perfil?.Nombre ?? getCache.team2[characterId]?.Nombre ?? `Personaje (${characterId})`
                        erroresCondiciones.push(`**${nombre}**: ${verificar.razon}`)

                    }
                })

                if (erroresCondiciones.length > 0) {
                    return interaction.editReply({
                        content: "**No se puede iniciar el duelo porque los siguientes personajes no cumplen un requisito:**\n" +
                            `${erroresCondiciones.join("\n")}`
                    })
                }

                const { Personaje, NPC } = require("../../../functions/Duelo/combatientes")

                // Contar NPCs duplicados entre ambos equipos para etiquetar con [NPC - 1], [NPC - 2], etc.
                const nameCounts = {};
                const nameIndices = {};
                const todosCombatientesCache = [...Object.entries(getCache.team1 || {}), ...Object.entries(getCache.team2 || {})];
                todosCombatientesCache.forEach(([id, data]) => {
                    if (data.isNPC || id.startsWith("NPC-")) {
                        const baseName = data.Nombre || data.perfil?.Nombre || "NPC";
                        nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
                    }
                });

                const construirEquipo = (teamCache) =>
                    Object.entries(teamCache).map(([characterId, data]) => {
                        if (data.isNPC || characterId.startsWith("NPC-")) {
                            const baseName = data.Nombre || data.perfil?.Nombre || "NPC";
                            let finalName = baseName;
                            if (nameCounts[baseName] > 1) {
                                nameIndices[baseName] = (nameIndices[baseName] || 0) + 1;
                                finalName = `${baseName} [NPC - ${nameIndices[baseName]}]`;
                            }
                            return new NPC(characterId, { ...data, Nombre: finalName });
                        }
                        const freshSoul = soulsFrescos.find(s => s && String(s._id) === String(characterId));
                        return new Personaje(Number(characterId), {
                            ownerId: data.ownerId,
                            perfil: data.perfil,
                            nucleo: freshSoul?.nucleo || data.nucleo,
                            stats: freshSoul?.stats || data.stats,
                            dominio: freshSoul?.dominio || data.dominio,
                            sendero: freshSoul?.sendero || data.sendero
                        });
                    })

                const equipo1 = construirEquipo(getCache.team1)
                const equipo2 = construirEquipo(getCache.team2)

                // Crear sesión
                const channelCombate = client.channels.cache.get("1345239393786527784")


                console.log("Duelo tipo:", getCache.duelType)
                const sesion = duelSystem.crearSesion({
                    sessionId: channelCombate.id,
                    duelType: getCache.duelType,
                    teams: [equipo1, equipo2],
                    apuestas: getCache.apuestas,
                    tipoApuesta: getCache.tipoApuesta,
                    modeTest: !!getCache.modeTest
                })

                if (!sesion) {
                    return interaction.editReply({
                        content: "Ocurrió un error al iniciar el duelo. Intenta de nuevo, si el error persiste contacta con el owner ＞﹏＜"
                    })
                }

                transaccionCache.delete(cache)
                for (const c of sesion.getAllCombatientes()) {
                    await transaccionCache.deleteStatus(c.ID)
                }
                sesion.state = "ACTIVO"

                sesion.addLog("inicio", "El duelo ha comenzado")

                await interaction.editReply({
                    content: `⚔️ ¡El combate ha comenzado! Canal Espectador: <#${channelCombate.id}>`
                })

                const CombatUI = require("../../../functions/Duelo/combateUI")
                await CombatUI.update(sesion, client)

                // Si el primer actor del combate es un NPC (o está incapacitado / canalizando),
                // ejecutar advanceCompas para que la IA tome su turno de inmediato
                const TurnProcessor = require("../../../functions/Duelo/turnProcessor")
                const firstActor = sesion.getCurrentActor()
                if (firstActor && (firstActor.isNPC || firstActor.activeCast)) {
                    await TurnProcessor.advanceCompas(sesion, null)
                } else {
                    sesion.iniciarWatchdogTurno(client);
                }
            }
        }


        const characterAuthor = getCache.characterAuthor
        const authorSoul = getCache.authorSoul
        const characterRival = getCache.characterRival
        const rivalSoul = getCache.rivalSoul
        const MdAuthor = getCache.MdAuthor
        const MdRival = getCache.MdRival

        const channelDuel = client.channels.cache.get("1345239393786527784")



        if (response === "accept") {

            const errores = []

            try {
                await MdAuthor.send({ content: "-# Mensaje de comprobación para verificar que se pueden enviar mensajes directos\n-# **Se borra automaticamente despues de un rato**", flags: "SuppressNotifications" })
                    .then(m => setTimeout(() => m.delete(), 3000))
            } catch (error) {
                console.error(error)
                const author = await client.users.fetch(authorSoul._id)
                errores.push("`" + `${author.globalName} ` + "`" + ` Tiene deshabilitados los Mensajes Directos para este servidor.`)
            }

            try {
                await MdRival.send({ content: "-# Mensaje de comprobación para verificar que se pueden enviar mensajes directos\n-# **Se borra automaticamente despues de un rato**", flags: "SuppressNotifications" })
                    .then(m => setTimeout(() => m.delete(), 3000))
            } catch (error) {
                console.error(error)
                errores.push("`" + `${interaction.user.globalName}` + "`" + `Tiene deshabilitados los Mensajes Directos para este servidor `)
            }

            if (errores.length > 0) {
                return interaction.reply("**No se puede iniciar el duelo porque los siguientes usuarios no cumplen un requisito:**" +
                    `\n${errores.join("\n")}`
                )
            }


            if (await duelSystem.personajeEnDuelo(characterRival.ID)) {
                getCache.Message.edit({ components: [] })
                return interaction.reply({ content: "No puedes aceptar este duelo porque ya estas en uno", flags: ["Ephemeral"] })
            }


            if (await duelSystem.personajeEnDuelo(characterAuthor.ID)) {
                getCache.Message.edit({ components: [] })
                return interaction.reply({ content: "No puedes aceptar este duelo. Quien te reto ya esta en un duelo actualmente", flags: ["Ephemeral"] })
            }


            const gifsObjets = [
                "https://c.tenor.com/jT0dXkuoRLEAAAAd/tenor.gif",
                "https://c.tenor.com/wEnKyplBh8EAAAAd/tenor.gif",
                "https://c.tenor.com/OS8sRwN-nlYAAAAd/tenor.gif",
                "https://c.tenor.com/T3-_RasuG7gAAAAC/tenor.gif"
            ]

            const gifSelect = gifsObjets[Math.floor(Math.random() * gifsObjets.length)]

            console.log(gifSelect)
            console.log(getCache.characterRival.avatarURL)
            const embed = new EmbedBuilder()
                .setTitle(`${getCache.characterRival.perfil.Nombre} a aceptado el duelo`)
                .setDescription("Preparando el duelo...")
                .setThumbnail(`${getCache.characterRival.perfil.avatarURL}`)
                .setImage(gifSelect)


            await getCache.Message.edit({ components: [] })
            const messagesend = await interaction.reply({ content: `<@!${getCache.characterAuthor.ownerId}>`, embeds: [embed], fetchReply: true })

            transaccionCache.delete(cache)

            embed.setDescription("El duelo esta en curso...\n-# puedes ver el duelo en el canal: <#1345239393786527784>")
            let messageError;

            const PlayerSoul = {
                ...characterAuthor,
                ...authorSoul,
            }
            const RivalSoul = {
                ...characterRival,
                ...rivalSoul,
            }

            const data = {
                Player: PlayerSoul,
                Rival: RivalSoul,
                channel: channelDuel,
                Mdauthor: MdAuthor,
                Mdrival: MdRival,
            }

            const duel = await duelSystem.createDuel(client, false, "pvp", data).catch((e) => {
                messageError = e.code
                console.log(e)
            })

            if (messageError === 50007) {
                return interaction.channel.send(`No se pudo iniciar el duelo porque alguno de los dos usuarios tiene los MD cerrados...`)
            } else if (messageError) {
                return interaction.channel.send(`Ocurrio un error al intentar iniciar el duelo.`)
            }

            messagesend.edit({ embeds: [embed] })



        } else if (response === "decline") {
            const embed = new EmbedBuilder()
                .setTitle(`${getCache.characterRival.perfil.Nombre} a rechazado el duelo ＞﹏＜`)
                .setDescription("Quizás para la proxima")
                .setThumbnail(`${getCache.characterRival.perfil.avatarURL}`)
                .setImage("https://c.tenor.com/UDzn7Mcr_gwAAAAC/tenor.gif")


            await getCache.Message.edit({ components: [] })
            transaccionCache.delete(cache)
            return interaction.reply({ content: `<@!${getCache.characterAuthor.ownerId}>`, embeds: [embed] })

        }
    }
})