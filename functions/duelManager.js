const { Duelv2, duelEmitter } = require('./duels');
const { Personaje, NPC } = require('./combatientes')

class duelManager {
    constructor() {
        this.activeDuels = new Map();
    }

    async createDuel(client, isNPC, duelType, parametros) {
        const player1 = new Personaje(parametros.player1);
        const player2 = isNPC ? new NPC(parametros.player2) : new Personaje(parametros.player2);
        const duelInstance = new Duelv2(player1, player2, parametros.channel, duelType, isNPC);
        this.activeDuels.set(duelInstance.id, duelInstance);
        await this.startDuelMessages(duelInstance)

        return duelInstance;
    }

    getDuel(duelId) {
        return this.activeDuels.get(duelId);
    }

    endDuel(duelId) {
        this.activeDuels.delete(duelId);
    }

    async startDuelMessages(duel) {
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
                    "content": `-# Es turno de <@!${duel.currentTurn.userAuthor}> (${duel.currentTurn.Nombre})`
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
                            "url": `${duel.player1.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${duel.player1.Nombre} (Lv: ${duel.player1.nivelMagico})`
                        },
                        {
                            "type": 10,
                            "content": "*`HP:`*" + ` ${duel.barradeVida(duel.player1.HP, duel.player1.stats.hpMax)}`
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
                            "url": `${duel.player2.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${duel.player2.Nombre} (Lv: ${duel.player2.nivelMagico}) ${duel.isNPC ? "[NPC]" : ""}`
                        },
                        {
                            "type": 10,
                            "content": "`HP:`" + ` ${duel.barradeVida(duel.player2.HP, duel.player2.stats.hpMax)}`
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

        if (duel.isNPC) {

            const componentAuthor = await duel.messageComponents(duel.player1, duel.player2, duel)
            duel.authorMD = await duel.MdAuthor.send({ components: componentAuthor, flags: ["IsComponentsV2"] }).catch()
            duel.rivalMD = null

        } else {
            const AuthorM = await duel.messageComponents(duel.player1, duel.player2, duel)
            const rivalM = await duel.messageComponents(duel.player2, duel.player1, duel)

            duel.authorMD = await duel.MdAuthor.send({ components: AuthorM, flags: ["IsComponentsV2"] })
            duel.rivalMD = await duel.MdRival.send({ components: rivalM, flags: ["IsComponentsV2"] })
        }

    }

    async personajeEnDuelo(playerID) {
        for(const duel of this.activeDuels.values()) {
            const playerExist = duel.personajes.some(p => p.ID === playerID)
            if (playerExist) {
                return true
            }
        }

        return false
    }
}


const duelSystem = new duelManager()

module.exports = { duelSystem }