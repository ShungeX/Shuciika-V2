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
const interfazCreate = require("../../../../functions/interfazCreate")



module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("unirse_duelo")
        .setDescription("Unete a la sala de un duelo")
        .addStringOption(o =>
            o
                .setName("codigo")
                .setDescription("Ingresa el codigo de la sala")
                .setRequired(true)
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
        const code = interaction.options.getString("codigo")
        const userData = await userdb.findOne({ _id: interaction.user.id })

        if (await duelSystem.personajeEnDuelo(character._id)) {
            return interaction.reply({ content: "No puedes entrar en un duelo si tu personaje ya esta en otro ＞﹏＜", flags: ["Ephemeral"] })
        }

        const ocupado = await interfazCreate.personajeOcupado(character._id)
        if (ocupado) {
            return interaction.reply({ components: ocupado, flags: ["Ephemeral", "IsComponentsV2"] })
        }
        if (soul.nucleo.HP === 0) {
            return interaction.reply({ content: "Tu personaje esta fuera de combate. Necesita recuperar vida... ＞﹏＜\n-# Usa un objeto con `/rol usar_objeto`", flags: ["Ephemeral"] })
        }

        const sala = await transaccionCache.get(code)

        if (!sala) return interaction.reply({ content: "No existe ninguna sala con el codigo " + `**${code}** ＞﹏＜`, flags: ["Ephemeral"] })

        const data = Object.values(sala.team1)
        const data2 = Object.values(sala.team2)

        if (data.length >= sala.limitTeam1 && data2.length >= sala.limitTeam2) return interaction.reply({ content: `La sala ingresada (${code} ya esta llena... ＞﹏＜)`, flags: ["Ephemeral"] })
        const listaNombresEq1 = data.map(ch => {
            return `- -# **${ch.perfil.Nombre}**`
        }).join("\n")


        const listaNombresEq2 = data2.map(ch => {
            return `- -# **${ch.perfil.Nombre}**`
        }).join("\n")

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
                                "url": "https://i.pinimg.com/1200x/e5/38/67/e53867f8979e6df0b3dd73728feabf08.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# ¡Prepárate para el combate!\n\n**Selecciona un equipo**\n-# **Atención:** Al entrar a la sala, tu personaje y tu build quedarán fijos. Asegúrate de que todo esté listo antes de continuar."
                            },
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `**Equipo 1** (${data.length} / ${sala.limitTeam1})\n${listaNombresEq1}`
                    },
                    {
                        "type": 10,
                        "content": `**Equipo 2** (${data2.length} / ${sala.limitTeam2})\n${listaNombresEq2}`
                    }
                ]
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Equipo 1",
                        "emoji": null,
                        "disabled": data.length >= sala.limitTeam1,
                        "custom_id": `preDuel-${interaction.user.id}-team1-${sala.code}`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Equipo 2",
                        "emoji": null,
                        "disabled": data2.length >= sala.limitTeam2,
                        "custom_id": `preDuel-${interaction.user.id}-team2-${sala.code}`
                    }
                ]
            }
        ]

        interaction.reply({ components: salaMessage, flags: ["IsComponentsV2", "Ephemeral"] })
    }


}