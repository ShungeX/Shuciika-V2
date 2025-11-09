const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../../config")
const transaccionCache = require("../../../../utils/cache")
const { v4: uuidv4 } = require('uuid')
const { duelSystem } = require("../../../../functions/duelManager")



module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("crear_duelo")
        .setDescription("Crea un duelo contra uno o varios usuarios")
        .addIntegerOption(o =>
            o
                .setName("tipo")
                .setDescription("Selecciona el tipo de duelo")
                .addChoices(
                    { name: "Individual", value: 1 },
                    { name: "Sala", value: 2 }
                )
                .setRequired(true)
        )
        .addBooleanOption(o =>
            o
                .setName("sala_privada")
                .setDescription("Crea una sala privada [acceso solo con codigo]")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o
                .setName("limite_equipo1")
                .setDescription("Ingresa el limite de integrantes para el equipo 1 [Maximo y por defecto 4]")
                .setMaxValue(4)
                .setRequired(false)
        )
        .addIntegerOption(o =>
            o
                .setName("limite_equipo2")
                .setDescription("Ingresa el limite de integrantes para el equipo 2 [Maximo y por defecto 4]")
                .setMaxValue(4)
                .setRequired(false)
        )
        .addIntegerOption(o =>
            o
                .setName("personaje")
                .setDescription("Ingresa la ID del personaje a retar [Opcional]")
                .setAutocomplete(true)
                .setRequired(false)
        ),

    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false },
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, { character, soul }) => {
        const rivalID = interaction.options.getInteger("personaje")
        const tipoDuelo = interaction.options.getInteger("tipo")
        const limiteEquipo1 = interaction.options.getInteger("limite_equipo1") || 4
        const limiteEquipo2 = interaction.options.getInteger("limite_equipo2") || 4
        const salaPrivada = interaction.options.getBoolean("sala_privada")
        const rival = await characters.findOne({ _id: rivalID })
        const userData = await userdb.findOne({ _id: interaction.user.id })

        if (await duelSystem.personajeEnDuelo(character._id)) {
            return interaction.reply({ content: "No puedes iniciar un duelo si tu personaje ya esta en otro ＞﹏＜", flags: ["Ephemeral"] })
        }
        if (soul.nucleo.HP === 0) {
            return interaction.reply({ content: "Tu personaje esta fuera de combate. Necesita recuperar vida... ＞﹏＜\n-# Usa un objeto con `/rol usar_objeto`", flags: ["Ephemeral"] })
        }


        if (tipoDuelo === 2) {
            const codeSala = await duelSystem.createCode(6)

            let privateSala = salaPrivada ? "\n-# `Codigo de sala:` (Privada)" : "\n-# `Codigo de sala:` " + `||${codeSala}||`

            const salaMessage = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/1200x/16/f7/00/16f70096006f074ddba8b9d390e52ac6.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": `# Sala de duelo | ${character.perfil.Nombre}`
                                },
                                {
                                    "type": 10,
                                    "content": "-# `Estado:` *En espera...*\n-# `Creador:` " + `${interaction.user}` + "\n-# `Codigo de sala:` " + `||${codeSala}||`
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `**Retadores:**\n- -# ${character.perfil.Nombre} (Lv: ${soul.nucleo.nivelMagico})`
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "**Contrincantes:**\n- -# Aun sin contricantes..."
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `-# Sistema de combate V3 - Creado hace: <t:${Math.floor(Date.now() / 1000)}:R>`
                        }
                    ]
                },
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 2,
                            "style": 2,
                            "label": salaPrivada ? "Privada" : "Publica",
                            "emoji": null,
                            "disabled": false,
                            "custom_id": salaPrivada ? `preDuel-${interaction.user.id}-publica-${codeSala}` : `preDuel-${interaction.user.id}-privada-${codeSala}`
                        },
                        {
                            "type": 2,
                            "style": 3,
                            "label": "Iniciar Duelo",
                            "emoji": null,
                            "disabled": true,
                            "custom_id": `preDuel-${interaction.user.id}-start-${codeSala}`
                        },
                        {
                            "type": 2,
                            "style": 4,
                            "label": "Eliminar sala",
                            "emoji": null,
                            "disabled": false,
                            "custom_id": `preDuel-${interaction.user.id}-delete-${codeSala}`
                        }
                    ]
                }
            ]
            const serverMessage = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/1200x/16/f7/00/16f70096006f074ddba8b9d390e52ac6.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": `# Sala de duelo | ${character.perfil.Nombre}`
                                },
                                {
                                    "type": 10,
                                    "content": "-# `Estado:` *En espera...*\n-# `Creador:` " + `${interaction.user}` + privateSala
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `**Retadores:**\n- -# ${character.perfil.Nombre} (Lv: ${soul.nucleo.nivelMagico})`
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "**Contrincantes:**\n- -# Aun sin contricantes..."
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": `-# Sistema de combate V3 - Creado hace: <t:${Math.floor(Date.now() / 1000)}:R>`
                        }
                    ]
                }
            ]


            const messageS = await interaction.reply({ components: serverMessage, flags: ["IsComponentsV2"], withResponse: true })

            const messageA = await interaction.user.send({ components: salaMessage, flags: ["IsComponentsV2"] }).catch(err => {
                console.log(err)
                return interaction.channel.send({ content: "No puedo enviarte el mensaje de la sala...\n-# Verifica tus DM" })
            })

            const { aspiracion, Historia, Cumpleaños, Peso, Estatura, Descripcion, Familia, CiudadOrg, Sexo, ...infoperfil } = character.perfil
            const { XP, energy, lastEnergyUpdate, energiaAlmica, ...infoNucleo } = soul.nucleo
            const { hilosLunares, StelarFragments, ...infoSendero } = soul.sendero

            const characterData = {
                ownerId: interaction.user.id,
                perfil: infoperfil,
                social: { compañero: character.social.compañero, team: character.social.team },
                nucleo: infoNucleo,
                stats: soul.stats,
                dominio: soul.dominio,
                sendero: infoSendero
            }

            const dataSala = {
                autor: interaction.user.id,
                autorCharacter: characterData.perfil.Nombre,
                team1: { [character._id]: characterData },
                team2: {},
                limitTeam1: limiteEquipo1,
                limitTeam2: limiteEquipo2,
                code: codeSala,
                isPrivate: salaPrivada,
                isNPC: false,
                estado: "En espera...",
                creado: Math.floor(Date.now() / 1000),
                messageAutor: {
                    guild: messageA.guildId,
                    channel: messageA.channelId,
                    message: messageA.id
                },
                messageServer: {
                    guild: messageS.resource.message.guildId,
                    channel: messageS.resource.message.channelId,
                    message: messageS.resource.message.id
                }
            }

            console.log(dataSala.messageAutor)

            await transaccionCache.set(codeSala, dataSala)
            await transaccionCache.setStatus(character._id, { code: 1, salaCode: codeSala, Nombre: "En sala" }, { active: true, time: 3000 })


        } else if (tipoDuelo === 1) {
            if (!rival) return interaction.reply({ content: `Hmm... No existe ningun personaje con el ID: **${rivalID}**`, flags: ["Ephemeral"] });

            if (character._id === rival?._id) return interaction.reply({ content: `No puedes tener un duelo contigo mismo... ¿O si? (¬_¬")`, flags: ["Ephemeral"] });
            if (userData.nix.personajes.some(p => p.id === rival?._id)) {
                return interaction.reply({ content: `No puedes retar a un personaje que te pertenece. (¬_¬")`, flags: ["Ephemeral"] });
            }
            const soulRival = await souls.findOne({ _id: rivalID })

            if (!soulRival) return interaction.reply({ content: `**${rival.Nombre}** aun no puede combatir... ＞﹏＜`, flags: ["Ephemeral"] });


            if (soulRival.nucleo.HP === 0) {
                return interaction.reply({ content: "No puedes retar a un personaje que esta debilitado ＞﹏＜", flags: ["Ephemeral"] })
            }

            if (await duelSystem.personajeEnDuelo(rival._id)) {
                return interaction.reply({ content: "No puedes retar a este personaje porque esta en un duelo ＞﹏＜", flags: ["Ephemeral"] })

            }


            const rivalUser = client.users.cache.get(rival.ownerID)

            const MD = await interaction.user.createDM()
            const rivalMD = await rivalUser.createDM()


            const gifsDuelo = [
                "https://c.tenor.com/OFsN3R89BIEAAAAd/tenor.gif",
                "https://c.tenor.com/cYSjqD3730UAAAAd/tenor.gif",
                "https://c.tenor.com/dpyPyzrwXzYAAAAd/tenor.gif",
                "https://c.tenor.com/jCA_9r3vL6EAAAAC/tenor.gif",
                "https://i.pinimg.com/originals/e9/fc/84/e9fc840e4200187bc4aa96d76e8c7692.gif"
            ]

            const gifSelect = gifsDuelo[Math.floor(Math.random() * gifsDuelo.length)]

            const embed = new EmbedBuilder()
                .setTitle(`Se aproxima un duelo...`)
                .setDescription(`**${character.perfil.Nombre} (LV: ${soul.nucleo.nivelMagico})** te esta retando a un duelo`)
                .setThumbnail(`${character.perfil.avatarURL}`)
                .setImage(gifSelect)
                .setColor("Red")
                .setTimestamp()

            const transacciónId = uuidv4().replace(/-/g, "")

            const button = new ButtonBuilder()
                .setCustomId(`preDuel-${rivalUser.id}-NaN-${transacciónId}-accept`)
                .setEmoji(`✅`)
                .setLabel("Aceptar")
                .setStyle(ButtonStyle.Secondary)

            const button2 = new ButtonBuilder()
                .setCustomId(`preDuel-${rivalUser.id}-NaN-${transacciónId}-decline`)
                .setEmoji(`❌`)
                .setLabel("Rechazar")
                .setStyle(ButtonStyle.Secondary)

            const row = new ActionRowBuilder().addComponents(button, button2)

            const message = (await interaction.reply({ content: `${rivalUser}`, embeds: [embed], components: [row], withResponse: true })).resource.message



            const obj = {
                characterAuthor: character,
                authorSoul: soul,
                characterRival: rival,
                rivalSoul: soulRival,
                Message: message,
                MdAuthor: MD,
                MdRival: rivalMD,
            }

            await transaccionCache.set(transacciónId, obj)

        }
    }


}