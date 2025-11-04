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
const { duelSystem } = require("../../../functions/duelManager")
const interfazCreate = require("../../../functions/interfazCreate")

module.exports = {
    customId: "preDuel",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, id, cache, response) => {

        console.log(cache)

        const getCache = transaccionCache.get(cache)

        if (!getCache) return interaction.reply({ content: "Esta interacción ya expiro ＞﹏＜", ephemeral: true });

        if (getCache.code) {
            if (id === "team1" || id === "team2") {
                const activeCharacter = await userData.findOne({ _id: interaction.user.id })
                const ocupado = await interfazCreate.personajeOcupado(activeCharacter.nix.personajeActivo)
                if (ocupado) {
                    return interaction.reply({ components: ocupado, flags: ["Ephemeral", "IsComponentsV2"] })
                }



                const character = await characters.findOne({ _id: activeCharacter.nix.personajeActivo })

                if (!character) return interaction.reply({ content: "Ocurrio un error al ingresar al duelo [Personaje no encontrado]\n-# Vuelve a usar el comando", flags: ["Ephemeral"] })
                const { aspiracion, Historia, Cumpleaños, Peso, Estatura, ...infoperfil } = character.perfil

                const characterData = {
                    perfil: infoperfil,
                    social: { compañero: character.social.compañero, team: character.social.team }
                }

                getCache[id][character._id] = characterData

                console.log(getCache.team1)

                const message = await interfazCreate.salaDueloMessage(getCache, "all", interaction.user.id)

                if (getCache.autor !== interaction.user.id) {
                    try {
                        await interaction.user.send({ components: message[2], flags: ["IsComponentsV2"] })
                        await transaccionCache.setStatus(character._id, { code: 1, salaCode: getCache.code, Nombre: "En sala" }, { active: true, time: 3000 })
                    } catch (error) {
                        return interaction.reply({ content: "No puedo enviarte el mensaje de la sala...\n-# Verifica tus DM para poder unirte", flags: ["Ephemeral"] })
                    }
                }


                try {
                    const messageAutor = await client.channels.fetch(getCache.messageAutor.channel).then(c => c.messages.fetch(getCache.messageAutor.message))
                    messageAutor.edit({ components: message[1] })
                    interaction.reply({ content: "Te has unido correctamente a la sala. Espera a que el administrador la inicie\n-# Puedes borrar este mensaje", flags: ["Ephemeral"] })
                } catch (error) {
                    if (error.code === 10008) {
                        interaction.reply({ content: "Ocurrio un error al ingresar a la sala. Es posible que esta ya no exista...", flags: ["Ephemeral"] })
                    } else {
                        console.log(error)
                        interaction.reply({ content: "Ocurrio un error al ingresar a la sala. [Error desconocido]", flags: ["Ephemeral"] })
                    }
                }

                try {
                    const messageServer = await interaction.guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                    messageServer.edit({ components: message[0] })
                } catch (error) {
                    console.log(error)
                    if (error.code === 10008) {
                        const channel = await interaction.guild.channels.fetch("1434739977291567215")
                        await channel.send({ components: message[0], flags: ["IsComponentsV2"] }).then(m => {
                            getCache.messageServer.guild = interaction.guild.id
                            getCache.messageServer.channel = m.channelId
                            getCache.messageServer.message = m.id
                        })
                    }
                }


            }

            if (id === "delete") {
                await interaction.deferReply()

                try {
                    const messageAutor = await client.channels.fetch(getCache.messageAutor.channel).then(c => c.messages.fetch(getCache.messageAutor.message))
                    messageAutor.delete()
                } catch (error) {
                    console.warn("No se pudo eliminar el mensaje de la sala en el autor", error)
                }

                try {
                    const guild = await client.guilds.fetch(getCache.messageServer.guild)
                    const messageServer = await guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                    messageServer.delete()
                } catch (error) {
                    console.warn("No se pudo eliminar el mensaje de la sala en el servidor", error)
                }

                try {
                    for (const character of [...Object.keys(getCache.team1), ...Object.keys(getCache.team2)]) {
                        transaccionCache.deleteStatus(character)
                        console.log("Personaje liberado correctamente", character)
                    }
                    console.warn("Personajes liberados correctamente")

                    transaccionCache.delete(cache)

                    const cacheExiste = transaccionCache.get(cache)
                    console.warn("Sala eliminada correctamente\n Verificación (¿vacio?):", cacheExiste)


                } catch (error) {
                    console.log(error)
                    interaction.editReply({ content: "Ocurrio un error al intentar eliminar esta sala...\n Intenta de nuevo, si el error persiste contacta con el owner ＞﹏＜" })
                }

                interaction.editReply({ content: "Sala eliminada correctamente... ＞﹏＜" })
            }

            if (id === "salirse") {
                if (getCache.estado === "En combate") return interaction.reply({ content: "¡El duelo ha comenzado!. No puedes huir, ya es demasiado tarde...", flags: ["Ephemeral"] })

                const activeCharacter = await userData.findOne({ _id: interaction.user.id })
                const character = await characters.findOne({ _id: activeCharacter.nix.personajeActivo })
                delete getCache.team1[character._id]
                delete getCache.team2[character._id]

                const seBorroCorrectamente = !getCache.team1.hasOwnProperty(character._id) || !getCache.team2.hasOwnProperty(character._id)
                const message = await interfazCreate.salaDueloMessage(getCache, "all", interaction.user.id)

                try {
                    const messageAutor = await client.channels.fetch(getCache.messageAutor.channel).then(c => c.messages.fetch(getCache.messageAutor.message))
                    messageAutor.edit({ components: message[1] })

                    if (seBorroCorrectamente) {
                        transaccionCache.deleteStatus(character._id)
                        interaction.reply({ content: "Has salido correctamente de la sala.\n-# Puedes borrar este mensaje", flags: ["Ephemeral"] })
                    } else {
                        interaction.reply({ content: "No has podido salir de la sala.\n-# Es posible que se trate de un error, intenta de nuevo...", flags: ["Ephemeral"] })
                    }

                } catch (error) {
                    if (error.code === 10008) {
                        interaction.reply({ content: "Ocurrio un error al salir de la sala. Es posible que esta ya no exista...", flags: ["Ephemeral"] })
                    } else {
                        console.log(error)
                        interaction.reply({ content: "Ocurrio un error al salir de la sala. [Error desconocido]", flags: ["Ephemeral"] })
                    }
                }

                try {
                    const guild = await client.guilds.fetch(getCache.messageServer.guild)
                    const messageServer = await guild.channels.fetch(getCache.messageServer.channel).then(c => c.messages.fetch(getCache.messageServer.message))
                    messageServer.edit({ components: message[0] })
                } catch (error) {
                    console.log(error)
                    if (error.code === 10008) {
                        const channel = await interaction.guild.channels.fetch("1434739977291567215")
                        await channel.send({ components: message[0], flags: ["IsComponentsV2"] }).then(m => {
                            getCache.messageServer.guild = interaction.guild.id
                            getCache.messageServer.channel = m.channelId
                            getCache.messageServer.message = m.id
                        })
                    }
                }

            }

            if (id === "publica" || id === "privada") {
                getCache.isPrivate = id === "privada" ? true : false
                const message = await interfazCreate.salaDueloMessage(getCache, "all", interaction.user.id)

                try {
                    interaction.update({ components: message[1] })


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
                    messageServer.edit({ components: message[0] })
                } catch (error) {
                    console.log(error)
                    if (error.code === 10008) {
                        const channel = await interaction.guild.channels.fetch("1434739977291567215")
                        await channel.send({ components: message[0], flags: ["IsComponentsV2"] }).then(m => {
                            getCache.messageServer.guild = interaction.guild.id
                            getCache.messageServer.channel = m.channelId
                            getCache.messageServer.message = m.id
                        })
                    }
                }
            }

            if (id === "start") {
                const team1_ids = Object.keys(getCache.team1)
                const team2_ids = Object.keys(getCache.team2)

                const allids = [...team1_ids, ...team2_ids]

                const verificarMds = allids.map(async (id) => {
                    try {
                        const user = await client.users.fetch(id)
                        const md = await user.createDM()

                        await md.send({
                            content: "-# Mensaje de comprobación (se borra en 3s).",
                            flags: "SuppressNotifications"
                        }).then(m => setTimeout(() => m.delete().catch(e => { }), 3000));

                        return { status: 'success', userId: userId };

                    } catch (error) {
                        const user = await client.users.cache.get(userId) || { globalName: `Usuario (${userId})` };
                        throw new Error(`\`${user.globalName}\` tiene los DMs deshabilitados.`);
                    }
                })

                const result = await Promise.allSettled(verificarMds)

                const errores = result.filter(result => result.status === 'rejected').map(result => result.reason.message)

                if (errores.length > 0) {
                    return interaction.reply({
                        content: "**No se puede iniciar el duelo porque los siguientes usuarios no cumplen un requisito:**\n" +
                            `${errores.join("\n")}`
                    })
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
                return interaction.reply({ content: "No puedes aceptar este duelo porque ya estas en uno", ephemeral: true })
            }


            if (await duelSystem.personajeEnDuelo(characterAuthor.ID)) {
                getCache.Message.edit({ components: [] })
                return interaction.reply({ content: "No puedes aceptar este duelo. Quien te reto ya esta en un duelo actualmente", ephemeral: true })
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
            const messagesend = await interaction.reply({ content: `<@!${getCache.characterAuthor.ownerID}>`, embeds: [embed], fetchReply: true })

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
            return interaction.reply({ content: `<@!${getCache.characterAuthor.ownerID}>`, embeds: [embed] })

        }

    }
}