const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client } = require(`discord.js`)
const clientdb = require("../Server")
const db = clientdb.db("Server_db")
const userData = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const npcs = db2.collection("NPCs")
const cacheGlobal = require("../utils/cache")
const getXp = require("../functions/getXP")
const { duelSystem } = require("../functions/duelManager")


class InterfazCreate {
    constructor(collection) {

    }


    /**
         * Crea el componente (mensaje) de la sala de duelos.
         * @param {object} salaData - El objeto completo de la sala.
         * @param {string} type - Global, Autor, All
         * @param {string} interactionAutor - la ID del autor de la interacción, esta es opcional
         * @returns {object} - Componente JSON usando V2 components
         */
    async salaDueloMessage(dataSala, type = "global", interactionAutor = null) {

        const privateSala = dataSala.isPrivate ? "\n-# `Codigo de sala:` (Privada)" : "\n-# `Codigo de sala:` " + `||${dataSala.code}||`

        const data = Object.values(dataSala.team1)
        const data2 = Object.values(dataSala.team2)

        const listaNombresEq1 = data.map(ch => {
            return `- -# **${ch.perfil.Nombre}**`
        }).join("\n")


        const listaNombresEq2 = data2.map(ch => {
            return `- -# **${ch.perfil.Nombre}**`
        }).join("\n")

        const batallaEquilibrada = dataSala?.restricted?.equilibrated ? !(data.length === data2.length) : false


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
                                "content": `# Sala de duelo | ${dataSala.autorCharacter}`
                            },
                            {
                                "type": 10,
                                "content": "-# `Estado:`" + `*${dataSala.estado}*` + "\n-# `Creador:` " + `<@!${dataSala.autor}>` + privateSala
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
                        "content": `**Retadores (${data.length}/${dataSala.limitTeam1}):**\n${listaNombresEq1}`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `**Contrincantes (${data2.length}/${dataSala.limitTeam2}):**\n${listaNombresEq2}`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `-# Sistema de combate V3 - Creado hace: <t:${dataSala.creado}:R>`
                    }
                ]
            }
        ]
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
                                "content": `# Sala de duelo | ${dataSala.autorCharacter}`
                            },
                            {
                                "type": 10,
                                "content": "-# `Estado:`" + `*${dataSala.estado}*` + "\n-# `Creador:` " + `<@!${dataSala.autor}>` + "\n-# `Codigo de sala:` " + `||${dataSala.code}||`
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
                        "content": `**Retadores (${data.length}/${dataSala.limitTeam1}):**\n${listaNombresEq1}`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `**Contrincantes (${data2.length}/${dataSala.limitTeam2}):**\n${listaNombresEq2}`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `-# Sistema de combate V3 - Creado hace: <t:${dataSala.creado}:R>`
                    }
                ]
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 2,
                        "label": dataSala.isPrivate ? "Privada" : "Publica",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": dataSala.isPrivate ? `preDuel-${dataSala.autor}-publica-${dataSala.code}` : `preDuel-${dataSala.autor}-privada-${dataSala.code}`
                    },
                    {
                        "type": 2,
                        "style": 3,
                        "label": "Iniciar Duelo",
                        "emoji": null,
                        "disabled": (data2.length < 1 || data.length < 1) || batallaEquilibrada,
                        "custom_id": `preDuel-${dataSala.autor}-start-${dataSala.code}`
                    },
                    {
                        "type": 2,
                        "style": 4,
                        "label": "Eliminar sala",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": `preDuel-${dataSala.autor}-delete-${dataSala.code}`
                    }
                ]
            }
        ]
        const inviteMessage = [
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
                                "url": "https://i.pinimg.com/736x/77/23/82/7723822ab96ea5be434c8b9f6d42c7f7.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Esperando combate..."
                            },
                            {
                                "type": 10,
                                "content": "-# Aqui deberia ir un mensaje curioso, sin embargo... Aun no hay nada "
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 4,
                                "label": "Salir de la sala",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `preDuel-${interactionAutor}-salirse-${dataSala.code}`
                            }
                        ]
                    }
                ]
            }
        ]

        return (type === "all") ? [serverMessage, salaMessage, inviteMessage] : type === "global" ? serverMessage : type === "sala" ? salaMessage : inviteMessage




    }

    async personajeOcupado(characterId) {
        const ocupado = await cacheGlobal.getStatus(characterId)
        if (!ocupado) return null

        const mensajeGlobal = [
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
                                "url": "https://i.pinimg.com/736x/1a/fc/02/1afc025f7a261861d25054bbf8907eb7.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# No puedes realizar esta acción"
                            },
                            {
                                "type": 10,
                                "content": "`Estado:` " + `${ocupado.status.Nombre}`
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    }
                ]
            }
        ]

        if (ocupado.status.code === 1) {
            // 1 = En sala
            const salaData = cacheGlobal.get(ocupado.status.salaCode)

            if (!salaData) {
                cacheGlobal.deleteStatus(characterId)
                return null
            }
            mensajeGlobal[0].components.push({
                "type": 10,
                "content": "Tu personaje se encuentra dentro de una sala. Para poder realizar esta acción debes salirte.\n" + `-# [Haz click aqui para ir al mensaje de la sala](https://discord.com/channels/${salaData.messageServer.guild}/${salaData.messageServer.channel}/${salaData.messageServer.message})`
            })
        }

        if (ocupado.status.code === 2) {
            // 2 = En combate

            mensajeGlobal[0].components.push({
                "type": 10,
                "content": "No puedes iniciar un duelo si tu personaje ya esta en otro. Se paciente y acaba primero tu combate ＞﹏＜"
            })
        }

        return mensajeGlobal
    }
}

module.exports = new InterfazCreate()
