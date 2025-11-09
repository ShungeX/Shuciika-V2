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


class InterfazCreate {
    constructor() {
        this.colores = {
            reset: '[0m',
            bold: '[1m',
            red: '[2;31m',
            green: '[2;32m',
            yellow: '[2;33m',
            blue: '[2;34m',
            // ... los colores que Discord soporte
        };
        this.ESC = '\u001b';
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

    /**
     * Formatea la vida en simbolos: [Emoji] hpactual/hpmax
     * @param {Number} current - valor actual del jugador
     * @param {Number} max - valor maximo del jugador
     * @param {Number | Object} emoji - [Predeterminado: 1 = vida, 2 = mana] o custom {vacio: id_emoji o texto, lleno: [ID_emoji o texto]}
     * @param {Number} barraLenght - Tamaño de la barra a mostrar (Predeterminado: 10) 
     * @returns Texto formateado
     */
    barraCustom(current, max, emoji, barraLenght = 10) {
        let emojiSet;

        switch (emoji) {
            case 1: // Vida
                emojiSet = {
                    lleno: "❤︎",
                    vacio: "𖹭",
                    especial: '<a:AttencionHeart:1345256576167968828>'
                };
                break;
            case 2: //mana
                emojiSet = {
                    lleno: '<:iconMana:1370897534083534978>',
                    vacio: ".",
                }
            default:
                if (typeof emoji === "object" && emoji.lleno && emoji.vacio) {
                    emojiSet = emoji
                } else {
                    emojiSet = {
                        lleno: '█',
                        vacio: '░',
                    }
                }
        }

        const porcentaje = (current / max) * 100
        let filledBars = Math.round((current / max) * barraLenght);

        if (current > 0 && filledBars === 0) {
            filledBars = 1
        }

        if (current <= 0) {
            filledBars = 0
        }

        const emptyBars = barraLenght - filledBars;

        let barraLlena = '';
        const barraVacia = emojiSet.vacio.repeat(emptyBars);

        if (emojiSet.especial && porcentaje < 10 && filledBars > 0) {
            barraLlena = emojiSet.lleno.repeat(filledBars - 1) + emojiSet.especial
        } else {
            barraLlena = emojiSet.lleno.repeat(filledBars)
        }
        return `[${barraLlena}${barraVacia}] **(${current}/${max})**`;
    }

    async duelBattleMessage(duel, player, rivalTeam, isEspectador = false) {
        const lastActions = await this.asciiText(duel.historialAcciones[duel.historialAcciones.length - 1])

        let effectsActivesR;
        let effectsActivesU;

        const imagesTeams = []


        if (isEspectador) {
            const sup = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "# ¡El duelo ha comenzado!:\n- *Es el turno de: " + `<@!${duel.turnoActual.ownerId}>*`
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": player.length > 1 ? `${imagesTeams[0]}` : `${player[0].avatarURL}`
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": await this.characterComponents(player, player.length > 1)
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": rivalTeam.length > 1 ? `${imagesTeams[1]}` : `${rivalTeam[0].avatarURL}`
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": await this.characterComponents(rivalTeam, rivalTeam.length > 1)
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "-# **Ultimas acciones**:\n" + `\`\`\`ansi\n${lastActions}\`\`\``
                        }
                    ]
                }
            ]


            return sup
        }

        if (player.statusEffect.length > 0) {
            const efectosActivos = player.statusEffect.map(effect => `- -# ${effect.Nombre} [Duracion: ${effect.duracion}]`).join('\n');
            effectsActivesU = `${efectosActivos}`
        }

        if (rival.statusEffect.length > 0) {
            const efectosActivos = rival.statusEffect.map(effect => `- -# ${effect.Nombre} [Duracion: ${effect.duracion}]`).join('\n');
            effectsActivesR = `${efectosActivos}`
        }

        const isTurn = duel.turnoActual._id === player._id ? "¡Es tu turno!" : "Esperando la acción del rival..."

        const messageTitle = `# ${isTurn}\n-# Turno: ${duel.ronda}\n`
        let rivalTeams

        if (rivalTeam.length > 1) {
            rivalTeam.forEach(pj => {
                rivalTeams = "\n" + `**${pj.Nombre} (ARM: ${pj.nivelMagico})`
            })
        }

        const userDuelsMini = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": messageTitle + `\n${rivalTeam.length > 1 ? "Tus rivales:" : "Tu rival:"}`
                    },
                    {
                        "type": 10,
                        "content": rivalTeams
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `Tu: ${player.Nombre}` + `\n-# HP: ${this.characterComponents(player, false, true)}` +
                            `\n-# Mana: ${interfazCreate.barraCustom(player.Mana, player.stats.manaMax, 2, 5)}` + "\n\nEfectos: [En desarrollo]"
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": "-# **Ultimas acciones**:\n" + `\`\`\`ansi\n${lastActions}\`\`\``
                    },
                ]
            }
        ]


        if (duel.turnoActual._id === player._id) {
            const buttons = this.createActionButtons(duel)

            userDuelsMini[0].components.push(...buttons)
        }

        return userDuelsMini
    }

    async characterComponents(team, small = false, isOnePlayer = false) {


        if (isOnePlayer) return `${this.barraCustom(team.HP, team.stats.hpMax, 1, 10)}`

        const teamJSON = []

        if (team.length > 1) teamJSON.push(
            {
                "type": 10,
                "content": "_**Team 1**_"
            }
        )

        team.forEach(pj => {
            if (small) {
                teamJSON.push(
                    {
                        "type": 10,
                        "content": `${this.barraCustom(pj.HP, pj.stats.hpMax, 1, 10)} | ${pj.Nombre}}`
                    }
                )
            } else {
                teamJSON.push(
                    {
                        "type": 10,
                        "content": `**${pj.Nombre} (LV: ${pj.nivelMagico})**`
                    },
                    {
                        "type": 10,
                        "content": `${this.barraCustom(pj.HP, pj.stats.hpMax, 1, 10)}`
                    }
                )
            }
        })

        return teamJSON
    }

    colorizeText(text, color) {
        return `${this.ESC}${colorCode}${text}${this.ESC}${this.colores.reset}`;
    }

    async asciiText(accion) {
        switch (accion.tipo) {
            case 'ataque': {
                const atacante = this.colorize(accion.data.atacante, this.colores.green);
                const defensor = this.colorize(accion.data.defensor, this.colores.red);
                const daño = this.colorize(accion.data.daño, this.colores.yellow);
                return `${atacante} inflige ${daño} de daño a ${defensor}.`;
            }

            case 'derrota': {
                const derrotado = this.colorize(accion.data.derrotado, this.colores.bold);
                const mensaje = this.colorize(accion.data.mensaje, this.colores.red);
                return `${derrotado} ha sido vencido. ${mensaje}`;
            }

            case 'hechizo': {
                const lanzador = this.colorize(accion.data.lanzador, this.colores.green);
                const hechizo = this.colorize(accion.data.nombreHechizo, this.colores.blue);
                return `${lanzador} lanza el hechizo ${hechizo}.`;
            }

            case 'inicioDuelo': {
                const parte1 = this.colorize('El duelo ha', this.colores.green);
                const parte2 = this.colorize('comenzado', accion.data.esJefe ? this.colores.red : this.colores.green);
                return `${parte1} ${parte2}`;
            }

            default:
                return 'Acción desconocida.';
        }
    }
}

module.exports = new InterfazCreate()
