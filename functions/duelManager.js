const { Duelv2, duelEmitter } = require('./duels');
const { Personaje, NPC } = require('./combatientes')

class duelManager {
    constructor() {
        this.activeDuels = new Map();
    }

    async createDuel(client, isNPC, duelType, parametros) {
        const player1 = new Personaje(parametros.Player);
        const player2 = isNPC ? new NPC(parametros.Rival) : new Personaje(parametros.Rival);
        const duelInstance = new Duelv2(player1, player2, parametros.channel, duelType, isNPC);


        console.log(duelInstance.turnoActual.ownerID)
        this.activeDuels.set(duelInstance.id, duelInstance);
        await this.startDuelMessages(duelInstance, player1, player2)

        return duelInstance;
    }

    getDuel(duelId) {
        return this.activeDuels.get(duelId);
    }

    endDuel(duelId) {
        this.activeDuels.delete(duelId);
    }

    async startDuelMessages(duel, player1, player2) {
        const espectadorJSON = [{
            "type": 17,
            "accent_color": null,
            "spoiler": false,
            "components": [
                {
                    "type": 10,
                    "content": "# ¡El duelo ha comenzado! <a:KrisJojos:1350664814414004395>"
                },
                {
                    "type": 10,
                    "content": `-# Es turno de <@!${player1.ownerID}> (${player1.Nombre})`
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
                            "url": `${player1.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${player1.Nombre} (Lv: ${player1.nivelMagico})`
                        },
                        {
                            "type": 10,
                            "content": "*`HP:`*" + ` ${duel.barradeVida(player1.HP, player1.stats.hpMax)}`
                        }
                    ]
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
                            "url": `${player2.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${player2.Nombre} (Lv: ${player2.nivelMagico}) ${duel.isNPC ? "[NPC]" : ""}`
                        },
                        {
                            "type": 10,
                            "content": "`HP:`" + ` ${duel.barradeVida(player2.HP, player2.stats.hpMax)}`
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
                    "content": "**Ultimas acciones**\n- ¡Empezó el duelo!"
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 10,
                    "content": "-# este es el primer turno..."
                }
            ]
        }
        ]

        duel.message = await duel.channel.send({ components: espectadorJSON, flags: ["IsComponentsV2"], withResponse: true })


        console.log(duel)
        console.log("MDs", duel.MDpj1, duel.MDpj2)
        if (duel.isNPC) {

            const componentAuthor = await duel.messageComponents(duel, player1, player2)
            duel.MDpj1 = await duel.MDpj1.send({ components: componentAuthor, flags: ["IsComponentsV2"] }).catch()
            duel.MDpj2 = null

        } else {
            const AuthorM = await this.messageComponents(duel, player1, player2)
            const rivalM = await this.messageComponents(duel, player2, player1)

            duel.MDpj1 = await duel.MDpj1.send({ components: AuthorM, flags: ["IsComponentsV2"] })
            duel.MDpj2 = await duel.MDpj2.send({ components: rivalM, flags: ["IsComponentsV2"] })
        }

    }

    async actualizarMensajeTurno(duel) {

    }

    async personajeEnDuelo(playerID) {
        for (const duel of this.activeDuels.values()) {
            const playerExist = duel.personajes.some(p => p._id === playerID)
            if (playerExist) {
                return true
            }
        }

        return false
    }


    createActionButtons(duel) {
        let attackDisable = false
        let defendDisable = false
        let bagDisable = false
        let spellsDisable = false
        let surrenderDisable = false

        if (duel.isNPC) {
            const npc = duel.personajes.find(p => p.isNPC === true)
            attackDisable = npc.restrictions.Attack === true
            defendDisable = npc.restrictions.Defend === true
            bagDisable = npc.restrictions.Bag === true
            spellsDisable = npc.restrictions.Spells === true
            surrenderDisable = npc.restrictions.Surrender === true
        }

        const buttonJSON = [
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
                        "style": 2,
                        "label": "Atacar",
                        "emoji": {
                            name: "sword",
                            id: "1370631600454504498"
                        },
                        "disabled": attackDisable,
                        "custom_id": `DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual._id}-attack-${duel.id}`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Defenderse",
                        "emoji": {
                            name: "yellowShield",
                            id: "1370631300616159233"
                        },
                        "disabled": defendDisable,
                        "custom_id": `DuelAct-${duel.turnoActual.ownerID}-${duel.turnoActual._id}-defend-${duel.id}`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Mochila",
                        "emoji": {
                            name: "EmuNui",
                            id: "1370631281028890727"
                        },
                        "disabled": bagDisable,
                        "custom_id": `DuelAct-${duel.turnoActual.ownerID}-${duel.turnoActual._id}-bag-${duel.id}`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Hechizos",
                        "emoji": {
                            name: "SpellBook",
                            id: "1370631319910092811"
                        },
                        "disabled": spellsDisable,
                        "custom_id": `DuelAct-${duel.turnoActual.ownerID}-${duel.turnoActual._id}-spells-${duel.id}`
                    },
                    {
                        "type": 2,
                        "style": 4,
                        "label": "Rendirse",
                        "emoji": {
                            name: "whiteflagpepo",
                            id: "1370631336536047737",
                        },
                        "disabled": surrenderDisable,
                        "custom_id": `DuelAct-${duel.turnoActual.ownerID}-${duel.turnoActual._id}-surrender-${duel.id}`
                    }
                ]
            }
        ]

        return buttonJSON
    }

    async actionGifSelect(action) {
        const actionGifs = {
            "attack": await getGifs("punch"),
            "defend": [
                "https://c.tenor.com/TeLGX2pYe94AAAAd/tenor.gif",
                "https://c.tenor.com/qkt_l6DMI6sAAAAd/tenor.gif",
                "https://c.tenor.com/rkQm2lOfRa0AAAAd/tenor.gif",
                "https://c.tenor.com/5iJ5pmSxVA4AAAAd/tenor.gif",
                "https://c.tenor.com/dDmhCv5dnTMAAAAd/tenor.gif",
                "https://c.tenor.com/B780LEn87eAAAAAd/tenor.gif",
                "https://c.tenor.com/bDi6iF-AAuQAAAAd/tenor.gif",
            ],
            "spell": [
                "https://c.tenor.com/-J0kOHQMBcYAAAAd/tenor.gif",
                "https://c.tenor.com/06Qk37qmP1wAAAAd/tenor.gif",
                "https://c.tenor.com/1ovlqNMdjsEAAAAd/tenor.gif",
                "https://c.tenor.com/qjzML-7bLkwAAAAd/tenor.gif",
                "https://c.tenor.com/u_SvcUXy2NwAAAAd/tenor.gif",
                "https://c.tenor.com/fHVO05yKkEQAAAAd/tenor.gif",
                "https://c.tenor.com/KuvSZ1kYPFAAAAAd/tenor.gif",
                "https://c.tenor.com/TPLVfoIGoEwAAAAd/tenor.gif"
            ],
            "spellFailed": [
                "https://c.tenor.com/mSqEgKfI3uUAAAAd/tenor.gif",
                "https://c.tenor.com/VQEadG8MqCMAAAAd/tenor.giff",
                "https://c.tenor.com/gjBx2zbdJjAAAAAC/tenor.gif",
                "https://c.tenor.com/W3jM5w2gvfoAAAAd/tenor.gif",
                "https://c.tenor.com/kEVg4dod34sAAAAd/tenor.gif",
                "https://c.tenor.com/pQ9jr5TqhUEAAAAd/tenor.gif",
                "https://c.tenor.com/clPun4-Kdu0AAAAd/tenor.gif",
            ],
            "bag": [
                "https://i.gifer.com/DXw.gif",
                "https://c.tenor.com/wiEN5dcIkHcAAAAd/tenor.gif",
                "https://nihonnoichigo.wordpress.com/wp-content/uploads/2017/07/t0qlw.gif",
                "https://c.tenor.com/vLWDELtNl6wAAAAd/tenor.gif",
                "https://c.tenor.com/0obmPDN7oeAAAAAd/tenor.gif",
                "https://c.tenor.com/HI0UBctzeRoAAAAd/tenor.gif",
                "https://c.tenor.com/E6l7l4t9ut4AAAAd/tenor.gif",
            ],
            "surrender": [
                "https://c.tenor.com/5lvXZOwWSq0AAAAd/tenor.gif"
            ]
        }

        if (action === "attack") {
            const actionAtacar = actionGifs[action]
            return actionAtacar.url
        }

        const gif = actionGifs[action]
        return gif ? gif[Math.floor(Math.random() * gif.length)] : "https://c.tenor.com/4jSSY5iIH-MAAAAC/tenor.gif"
    }

    async messageComponents(duel, player, rival, image = false, isEspectador = false) {
        let lastActions;
        let effectsActivesR;
        let effectsActivesU;

        if (duel.historialAcciones.length > 0) {
            const ultimasAcciones = duel.historialAcciones.slice(-5).reverse();
            const historialTexto = ultimasAcciones.map(accion => `- -# ${accion}`).join('\n');
            lastActions = `${historialTexto}`;
        }


        if (isEspectador) {
            const espectadorJSON = [{
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": `# ${duel.ronda === 1 ? "¡El duelo ha comenzado!" : "El duelo esta en curso..."} <a:KrisJojos:1350664814414004395>`
                    },
                    {
                        "type": 10,
                        "content": `-# Es turno de <@!${duel.turnoActual.userAuthor}> (${duel.turnoActual.Nombre})`
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
                                "url": `${duel.personajes[0].avatarURL}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${duel.personajes[0].Nombre} (Lv: ${duel.personajes[0].nivelMagico})`
                            },
                            {
                                "type": 10,
                                "content": "*`HP:`*" + ` ${duel.barradeVida(duel.personajes[0].HP, duel.personajes[0].stats.hpMax)}`
                            }
                        ]
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
                                "url": `${duel.personajes[1].avatarURL}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${duel.personajes[1].Nombre} (Lv: ${duel.personajes[1].nivelMagico}) ${duel.isNPC ? "[NPC]" : ""}`
                            },
                            {
                                "type": 10,
                                "content": "`HP:`" + ` ${duel.barradeVida(duel.personajes[1].HP, duel.personajes[1].stats.hpMax)}`
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
                        "content": `**Ultimas acciones**\n${lastActions}`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 12,
                        "items": [
                            {
                                "media": {
                                    "url": image
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# ${duel.ronda === 1 ? "Es el primer turno" : `Turno: ${duel.ronda}`}`
                    }
                ]
            }
            ]

            return espectadorJSON
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

        const usersDuel = [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": `${rival.avatarURL}`
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": `# ${isTurn}`
                    },
                    {
                        "type": 10,
                        "content": `**Tu rival:** ${rival.Nombre} (Lv: ${rival.nivelMagico}) ${duel.isNPC ? "[NPC]" : ""}\n` +
                            "-# *`HP`*:" + ` ${duel.barradeVida(rival.HP, rival.stats.hpMax)}` + "\n-# *`Mana`*:" + ` ${duel.barradeMana(rival.Mana, rival.stats.manaMax)}` +
                            `\n\n-# **Efectos:** ${effectsActivesR ? `\n${effectsActivesR}` : "Sin efectos"}`
                    }
                ]
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
                        "url": `${player.avatarURL}`
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": `**Tus stats:** ${player.Nombre} (Lv: ${player.nivelMagico})\n` +
                            "-# *`HP`*:" + ` ${duel.barradeVida(player.HP, player.stats.hpMax)}` + "\n-# *`Mana`*:" + ` ${duel.barradeMana(player.Mana, player.stats.manaMax)}` +
                            `\n\n-# **Efectos:** ${effectsActivesU ? `\n${effectsActivesU}` : "Sin efectos"}`
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
                "content": `**Ultimas acciones:**\n${lastActions}`
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
        ]

        if (image) {
            usersDuel.push({
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": ""
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            })

        }


        usersDuel.push({
            "type": 10,
            "content": `-# ${duel.ronda === 1 ? "Es el primer turno" : `Turno: ${duel.ronda}`}`
        })

        const contenedorC = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": usersDuel
            }
        ]

        if (duel.turnoActual._id === player._id) {
            const buttons = this.createActionButtons(duel)

            usersDuel.push(...buttons)
        }

        return contenedorC
    }
}


const duelSystem = new duelManager()

module.exports = { duelSystem }