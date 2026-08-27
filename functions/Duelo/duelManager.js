const { Duelv2, duelEmitter } = require('../duels');
const crypto = require("crypto");
const clientdb = require("../../Server")
const interfazCreate = require('./combateUI');
const client = require("../../bot")
const sesionesCombate = require("./sesionesCombate")
const rewardCalculator = require("../Economia/rewardCalculator")

class duelManager {
    constructor() {
        this.sesiones = new Map()       // sessionId → sesionCombate
        this.enProceso = new Set()      // userIds con acción en curso
        this.enCombate = new Set()      // userIds que están en un combate activo
        this.client = null
    }

    init(client) {
        this.client = client;
        console.log("DuelManager conectado al Client exitosamente.");
    }

    crearSesion({sessionId, duelType, teams, apuestas = null, tipoApuesta = null, modeTest = false}) {
        if (this.sesiones.has(sessionId)) return null
        const sesion = new sesionesCombate({ sessionId, type: duelType, teams, apuestas, tipoApuesta, modeTest })
        sesion.on('jugadorDerrotado', (datos) => {
            console.log("Jugador derrotado:", datos.victima)
            console.log("Jugador causante:", datos.atacante)
        })

        sesion.on('combateFinalizado', async (datos) => {
            const {sessionId, winners, arrayWinner, lossers, arrayLosser, typeWin} = datos;

            // 1. Mostrar estado de 0 HP y log de derrota "sucumbido 💀" en la UI regular
            await interfazCreate.update(sesion, this.client);

            // 2. Cooldown de 4 segundos para visualizar las últimas acciones antes de cerrar el combate
            await new Promise(resolve => setTimeout(resolve, 4000));

            // 3. Resolver recompensas y enviar la pantalla de GameOver final
            const rewardsMap = await rewardCalculator.resolve(sesion, arrayWinner, arrayLosser, client);

            await interfazCreate.updateGameOver(sesion, this.client, datos, rewardsMap);
        });

        sesion.on('actualizarUI', () => {
            interfazCreate.update(sesion, this.client)
        })

        this.sesiones.set(sessionId, sesion)

        // Registrar a todos los participantes como "en combate"
        sesion.getAllCombatientes().forEach(c => this.enCombate.add(c.ID))

        return sesion
    }

    getSesion(sessionId) {
        return this.sesiones.get(sessionId) ?? null
    }

    destruirSesion(sessionId) {
        const sesion = this.sesiones.get(sessionId)
        if (!sesion) return

        // Liberar a todos los participantes
        sesion.getAllCombatientes().forEach(c => {
            this.enCombate.delete(c.ID)
            this.enProceso.delete(c.ID)
        })

        this.sesiones.delete(sessionId)
    }


    // ─── Protección contra acciones duplicadas ────────────────────────────────

    bloquearUsuario(userId) {
        if (this.enProceso.has(userId)) return false  // ya está procesando
        this.enProceso.add(userId)
        return true
    }

    desbloquearUsuario(userId) {
        this.enProceso.delete(userId)
    }

    // ─── Consultas ────────────────────────────────────────────────────────────

    estaEnCombate(userId) {
        return this.enCombate.has(userId)
    }

    getSesionDeUsuario(userId) {
        for (const sesion of this.sesiones.values()) {
            if (sesion.getCombatiente(userId)) return sesion
        }
        return null
    }

    getDuel(duelId) {

        console.log(duelId)
        return this.activeDuels.get(duelId);
    }

    endDuel(duelId) {
        this.activeDuels.delete(duelId);
    }

    async sendDuelMessages(duel) {

        const espectadorJSON = await interfazCreate.duelBattleMessage(duel, duel.equipo1, duel.equipo2, true)
        const channel = await client.channels.fetch("1345239393786527784")


        if (!duel.espectador) {
            const message = await channel.send({ components: espectadorJSON, flags: ["IsComponentsV2"] })
            duel.espectador = message
        } else {
            duel.espectador.edit({ components: espectadorJSON, flags: ["IsComponentsV2"] })
        }


        const allPlayers = [...duel.equipo1, ...duel.equipo2]
        const humanPlayers = allPlayers.filter(player => !player.isNPC)

        const dmPromise = humanPlayers.map(async player => {
            try {
                const mdChannel = duel.MDChannels.get(player.ownerId);

                if (!mdChannel) {
                    throw new Error(`Canal MD no encontrado para el jugador ${player.Nombre} con la ID: ${player.ownerId}`)
                }

                const esDelEquipo1 = duel.equipo1.some(miembro => miembro.ID === player.ID);

                const rivales = esDelEquipo1 ? duel.equipo2 : duel.equipo1;

                const message = await interfazCreate.duelBattleMessage(duel, player, rivales, false)

                const messageToEdit = duel?.activeDMMessages?.get(player.ownerId);

                if (messageToEdit) {

                    await messageToEdit.edit({ components: message, flags: ["IsComponentsV2"] })
                } else {
                    const sentMessage = await mdChannel.send({ components: message, flags: ["IsComponentsV2"] })

                   await duel.activeDMMessages.set(player.ownerId, sentMessage);
                }


            } catch (error) {
                console.log(error)
            }
        })

        await Promise.all(dmPromise)
        console.warn("Mensajes enviados correctamente")

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
                        "custom_id": `DuelAct-${duel.turnoActual.userAuthor}-${duel.turnoActual.ID}-attack-${duel.id}`
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
                        "custom_id": `DuelAct-${duel.turnoActual.onwerId}-${duel.turnoActual.ID}-defend-${duel.id}`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": (duel?.type === "exploration" || duel?.duelType === "exploration" || duel?.isExploracion === true) ? "Mochila" : "Inventario",
                        "emoji": {
                            name: "EmuNui",
                            id: "1370631281028890727"
                        },
                        "disabled": bagDisable,
                        "custom_id": `DuelAct-${duel.turnoActual.onwerId}-${duel.turnoActual.ID}-bag-${duel.id}`
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
                        "custom_id": `DuelAct-${duel.turnoActual.onwerId}-${duel.turnoActual.ID}-spells-${duel.id}`
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
                        "custom_id": `DuelAct-${duel.turnoActual.onwerId}-${duel.turnoActual.ID}-surrender-${duel.id}`
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

    async createCode(longitud = 6) {
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        const longitudCaracteres = caracteres.length;

        const randomValues = crypto.randomBytes(longitud);

        let resultado = "";

        for (let i = 0; i < longitud; i++) {
            const indice = randomValues[i] % longitudCaracteres;
            resultado += caracteres.charAt(indice);
        }

        return resultado;
    }

    async getObjetInfo(region, id) {
        const catalogoObjetos = require("../catalogoObjetos");
        return catalogoObjetos.getObjetoPorId(region, id) ?? null;
    }

    async useItem(session, caster, target, itemData) {
        const TurnProcessor = require("./turnProcessor");
        const targetIds = target ? [target.ID] : [];
        return await TurnProcessor.resolverObjetos(session, caster, itemData, targetIds);
    }

}


const duelSystem = new duelManager()

module.exports = { duelSystem }