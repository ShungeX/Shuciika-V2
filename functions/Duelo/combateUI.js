const { flatten } = require("underscore")
const { characterComponents } = require("../interfazCreate")
const plantillasDuelo = require("./combatTemplates.js")
const { barraCustom, asciiText, pickRandom } = require("../../utils/utilidadesTexto.js")
const clientdb = require("../../Server")
const db_rol = clientdb.db("Rol_db")
const characters = db_rol.collection("Personajes")
const dbobjetos = db_rol.collection("Objetos_globales")
const { ModalBuilder,
    LabelBuilder,
    CheckboxGroupBuilder,
    CheckboxBuilder } = require("discord.js")
const { crearCustomId } = require("../../utils/constructores/customId")

class CombatUI {
    constructor() {
    }

    formatEfectos(c, sesion) {
        const activos = (c.statusEffect || []).map(e => {
            const name = e.Nombre || e.nombre || e.id || "Efecto";
            return `${name} (${e.duracion} turnos)`;
        });

        const pendientes = [];
        if (sesion && sesion.pendingEffects) {
            sesion.pendingEffects.forEach(e => {
                if (String(e.objetivo) === String(c.ID)) {
                    const name = e.Nombre || e.nombre || e.id || "Efecto";
                    if (!pendientes.some(p => p.startsWith(name))) {
                        pendientes.push(`${name} (Pendiente)`);
                    }
                }
            });
        }

        const total = [...activos, ...pendientes];
        if (total.length === 0) return "Ninguno";
        return total.join(", ");
    }

    async update(sesion, client) {
        console.log("=== CombatUI.update ===")
        console.log("Sesion ID:", sesion.sessionId)
        console.log("Teams:", sesion.teams.map(t => t.map(c => c.Nombre)))
        console.log("Actor actual:", sesion.getCurrentActor()?.Nombre)
        const actor = sesion.getCurrentActor()
        const primeraVez = !sesion.mensajes.espectador.messageId

        //Espectador (canal público)
        const componenteEspectador = this.buildEspectador(sesion, actor)
        await this._enviarOeditar(client, sesion.mensajes.espectador, componenteEspectador, primeraVez)

        //Mensajes individuales (MD de cada jugador, incluyendo derrotados)
        for (const combatiente of sesion.getAllCombatientes()) {
            if (combatiente.isNPC) continue
            if (!combatiente.ownerId || String(combatiente.ownerId).startsWith("NPC_")) continue

            const esSuTurno = !combatiente.defeated && String(actor?.ID) === String(combatiente.ID)
            const esEquipo1 = sesion.teams[0].some(c => String(c.ID) === String(combatiente.ID))
            const rivales = esEquipo1 ? sesion.teams[1] : sesion.teams[0]

            const componente = this.buildActorMessages(sesion, null, esSuTurno, combatiente, rivales)

            await this._enviarOeditar(
                client,
                sesion.mensajes.jugadores.get(combatiente.ownerId),
                componente,
                primeraVez,
                combatiente.ownerId
            )
        }
    }

    async updateGameOver(sesion, client, datosVictoria, rewardsMap) {
        console.log("=== CombatUI.updateGameOver ===")
        const { sessionId, winners, arrayWinner = [], lossers, arrayLosser = [], typeWin } = datosVictoria || {};

        const winArr = arrayWinner || [];
        const lossArr = arrayLosser || [];
        const rMap = rewardsMap || { recompensas: new Map() };

        const contextoPublico = { type: typeWin, isWinner: true, vista: 1 };
        const componenteEspectador = this.buildEndMessage(sesion, null, null, winArr, lossArr, contextoPublico, rMap);

        await this._enviarOeditar(
            client,
            sesion.mensajes.espectador,
            componenteEspectador,
            false // Asumimos que no es primera vez porque el combate ya estaba activo
        );

        for (const combatiente of sesion.getAllCombatientes()) {
            if (combatiente.isNPC) continue;

            const esGanador = winArr.some(w => w.ID === combatiente.ID);
            const contextoDM = { type: typeWin, isWinner: esGanador, vista: 2 };

            const componenteDM = this.buildEndMessage(sesion, combatiente, esGanador, winArr, lossArr, contextoDM, rMap);

            const refMsg = sesion.mensajes.jugadores.get(String(combatiente.ownerId)) || sesion.mensajes.jugadores.get(combatiente.ownerId);

            await this._enviarOeditar(
                client,
                refMsg,
                componenteDM,
                false,
                combatiente.ownerId
            );
        }
    }

    async _enviarOeditar(client, referencia, componente, primeraVez, userId = null) {
        if (userId && (typeof userId !== 'string' || userId.startsWith('NPC_') || isNaN(Number(userId)))) {
            return; // No enviar MD a NPCs
        }

        try {
            if (primeraVez) {
                let message
                if (userId) {
                    // MD del jugador
                    const user = await client.users.fetch(userId)
                    const dm = await user.createDM()
                    message = await dm.send({ components: componente, flags: ["IsComponentsV2"] })
                    referencia.messageId = message.id
                    referencia.channelId = message.channelId
                } else {
                    // Canal del espectador — primera vez: SEND no fetch
                    const channel = await client.channels.fetch(referencia.channelId)
                    message = await channel.send({ components: componente, flags: ["IsComponentsV2"] })
                    referencia.messageId = message.id
                    referencia.channelId = message.channelId
                }
            } else {
                // No es primera vez — editar el mensaje existente
                const channel = await client.channels.fetch(referencia.channelId)
                const message = await channel.messages.fetch(referencia.messageId, { force: true })
                await message.edit({ components: componente, flags: ["IsComponentsV2"] })
            }
        } catch (e) {
            console.error("CombatUI._enviarOEditar error:", e)
        }

    }

    buildEspectador(sesion, targetActor, isEnd) {
        if (isEnd) {
            const { title, descr, gif } = messagesSelects(typeWin, context, win)

            const endMessage = [
                {
                    "type": 10,
                    "content": `# ¡El duelo ha finalizado!`
                },
                {
                    "type": 10,
                    "content": `${descr}`
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
                            "url": `${typeWin === "afk" ? "https://i.pinimg.com/736x/f2/1b/71/f21b710fa12ad372f1776b16437ed966.jpg" : winner.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${winner.Nombre} (Lv: ${winner.nivelMagico}) ${typeWin === "afk" ? "" : "- **Ganador** ✨"}`
                        },
                        {
                            "type": 10,
                            "content": "*`HP:`*" + ` ${barraCustom(winner.HP, winner.stats.hpMax, 1, 10)}`
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
                            "url": `${typeWin === "afk" ? "https://i.pinimg.com/736x/f2/1b/71/f21b710fa12ad372f1776b16437ed966.jpg" : defeated.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${defeated.Nombre} (Lv: ${defeated.nivelMagico}) ${duel.isNPC ? "[NPC]" : ""}`
                        },
                        {
                            "type": 10,
                            "content": "`HP:`" + ` ${barraCustom(defeated.HP, defeated.stats.hpMax, 1, 10)}`
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
                                "url": gif
                            },
                            "description": null,
                            "spoiler": false
                        }
                    ]
                },
                {
                    "type": 10,
                    "content": `-# ${duel.ronda - 1 === 1 ? "IMPOSIBLE. ¿Acabó en el primer turno?" : `Finalizo en el turno: ${duel.turnos}`}`
                }
            ]

        }

        const team1Components = this.espectadorComponents(sesion, sesion.teams[0], sesion.teams[0].length)
        const team2Components = this.espectadorComponents(sesion, sesion.teams[1], sesion.teams[1].length)
        const ultimasAcciones = sesion.log
            .slice(-6)
            .map(log => asciiText(log))
            .join('\n')

        const actor = (targetActor && typeof targetActor === 'object' && targetActor.Nombre) ? targetActor : sesion.getCurrentActor();
        const actorName = actor
            ? (actor.isNPC || !actor.ownerId || String(actor.ownerId).startsWith("NPC_") || isNaN(Number(actor.ownerId))
                ? `**${actor.Nombre}**`
                : `<@!${actor.ownerId}>`)
            : "Final de combate";
        const headerContent = actor ? `# ¡El duelo está en curso!:\n- *Es el turno de: ${actorName}*` : "# ¡El combate ha finalizado!";

        const sup = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": headerContent
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
                                "url": team1Components.image
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": team1Components.teamText
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
                                "url": team2Components.image
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": team2Components.teamText
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
                        "content": "-# **Ultimas acciones**:\n" + `\`\`\`ansi\n${ultimasAcciones}\`\`\``
                    }
                ]
            }
        ]


        return sup
    }

    espectadorComponents(sesion, teams, teamsLength) {
        if (teamsLength > 1) {
            const teamsFormat = this._listaPersonajes(teams)
            const imageTeams = "https://i.pinimg.com/1200x/e5/38/67/e53867f8979e6df0b3dd73728feabf08.jpg" // Modificar, placeholder para imagen de equipo global o clan
            return { image: imageTeams, teamText: teamsFormat }
        } else {
            const imageTeams = teams[0].avatarURL
            const level = teams[0].nivelMagico ?? teams[0].stats?.nivelMagico ?? "???";
            const teamsFormat = `- **${teams[0].Nombre} \`(FE: ${level})\`**` + `\n HP: ${barraCustom(teams[0].HP, teams[0].stats?.hpMax ?? teams[0].HP, 1, 10)}\n`
            return { image: imageTeams, teamText: teamsFormat }
        }
    }

    buildActorMessages(sesion, type, isTurn, actor, rivales, adicional = {}) {

        const { titulo, ambiente, ronda, turnoActualLabel, labelRivales, labelPlayer, imagenURL, statsPlayer, statsRivales, ultimaAccionPersonalited } = adicional
        const mensajeAmbiente = this.mensajeAmbiente(sesion, actor[0] || actor)
        const turnoActual = sesion.getCurrentActor() || { Nombre: "Ninguno", ID: null, avatarURL: "https://i.pinimg.com/736x/bc/30/6b/bc306bced5860828cf4f38273805a607.jpg" }

        const rivalesArray = this._listaPersonajes(rivales || [])

        const labelRivalesFinal = labelRivales ? `### ${labelRivales}` : `### ${(rivales && rivales.length > 1) ? "Tus rivales" : "Tu rival"}`
        const formatStatsRivales = statsRivales ? `${statsRivales}` : rivalesArray

        const playerLevel = actor.nivelMagico ?? actor.stats?.nivelMagico ?? "???";
        const formatStatsPlayer = statsPlayer ? `${statsPlayer}` : `❧ **${actor.Nombre} (FE: ${playerLevel})**:\n` +
            `-# ${barraCustom(actor.HP, actor.stats?.hpMax ?? actor.HP, 1, 10)}` +
            `\n-# Mana: ${barraCustom(actor.Mana, actor.stats?.manaMax ?? actor.Mana, 2, 5)}` +
            `\n\nEfectos: ${this.formatEfectos(actor, sesion)}`

        const ultimasAcciones = sesion.log
            .slice(-6)
            .map(log => asciiText(log))
            .join('\n')
        const textoColoreado = ultimaAccionPersonalited ? this.asciiText(ultimaAccionPersonalited) : ultimasAcciones

        let tituloCalculado = titulo;
        if (!tituloCalculado) {
            if (actor.defeated || actor.HP <= 0) {
                tituloCalculado = "Has sido derrotado en combate 💀";
            } else if (turnoActual && turnoActual.ID && String(actor.ID) === String(turnoActual.ID)) {
                tituloCalculado = "¡Es tu turno!";
            } else {
                tituloCalculado = "Esperando la acción del rival...";
            }
        }

        const component = [
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
                                "url": imagenURL ?? (turnoActual.avatarURL || "https://i.pinimg.com/736x/bc/30/6b/bc306bced5860828cf4f38273805a607.jpg")
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${tituloCalculado}`
                            },
                            {
                                "type": 10,
                                "content": `-# 〝${ambiente ?? mensajeAmbiente}〞\n\n-# ⁍  *Ronda: ${ronda ?? sesion.ronda}*\n-# ⁍  *Turno actual: ${turnoActualLabel ?? turnoActual.Nombre}*`
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
                        "content": `### ${labelRivales ?? "Tus rivales"}`
                    },
                    {
                        "type": 10,
                        "content": `${formatStatsRivales}`
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
                                "url": imagenURL ?? (actor.avatarURL || "https://i.pinimg.com/736x/bc/30/6b/bc306bced5860828cf4f38273805a607.jpg")
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "### Tu personaje"
                            },
                            {
                                "type": 10,
                                "content": `${formatStatsPlayer}`
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
                        "content": `-# **Últimas acciones**\n\`\`\`ansi\n${textoColoreado}\`\`\``
                    }
                ]
            }
        ]


        if (isTurn) {
            const buttons = this.createActionButtons(sesion, actor)
            component[0].components.push(...buttons)
        }

        return component
    }

    _listaPersonajes(arrayPersonajes) {
        return arrayPersonajes.map(pj => {
            const level = pj.nivelMagico ?? pj.stats?.nivelMagico ?? "???";
            return `❧ **${pj.Nombre} (FE: ${level})**:\n` +
                `-# ${barraCustom(pj.HP, pj.stats?.hpMax ?? pj.HP, 1, 10)}`;
        }).join("\n\n")
    }

    buildEndMessage(sesion, combatiente, esGanador, arrayWinner = [], arrayLosser = [], context, rewardsMap = null) {
        const winList = Array.isArray(arrayWinner) ? arrayWinner : [];
        const lossList = Array.isArray(arrayLosser) ? arrayLosser : [];
        const esGrupo = (winList.length > 1) || (lossList.length > 1);
        const loserNombre = lossList.map(c => c ? c.Nombre : "").filter(Boolean).join(", ") || "Nadie";
        const winnerNombre = winList.map(c => c ? c.Nombre : "").filter(Boolean).join(", ") || "Nadie";

        context.turno = context.turno || context.ronda || sesion?.ronda || 1;

        if (!context.logs) {
            const ultimasAcciones = (sesion?.log || [])
                .slice(-6)
                .map(log => {
                    const ascii = asciiText(log);
                    return Array.isArray(ascii) ? ascii.join('\n') : ascii;
                })
                .filter(Boolean)
                .join('\n');

            context.logs = ultimasAcciones
                ? `\`\`\`ansi\n${ultimasAcciones}\n\`\`\``
                : "```ansi\n\u001b[2;34m- El combate ha finalizado\n```";
        }

        const message = this.messagesSelects(context.type, {
            ...context,
            winner: winnerNombre,
            defeated: loserNombre
        }, esGanador)


        let componente;

        console.log(context.vista)
        if (context.vista === 1) {
            console.log("Generando mensaje espectador")
            componente = !esGrupo
                ? plantillasDuelo.endEspectador1vs1(sesion, arrayWinner[0], arrayLosser[0], context, message, rewardsMap)
                : plantillasDuelo.endEspectadorNvsN(sesion, arrayWinner, arrayLosser, context, message, rewardsMap)
            return componente
        } else {
            const rivales = esGanador ? arrayLosser : arrayWinner;
            componente = plantillasDuelo.endGameDuel(sesion, combatiente, arrayWinner, rivales, context, message, rewardsMap)
            return componente
        }
    }

    messagesSelects(type, context = {}, win) {
        const endDuelAssets = {
            hp0: {
                victory: {
                    titles: [
                        "¡Victoria aplastante!",
                        "¡Triunfo absoluto!",
                        "¡Te alzas como vencedor!",
                        "¡Dominio total!",
                        "✧˖° La melodía fue tuya ✧˖°"
                    ],
                    description: [
                        "*¡La estrella del duelo brilla para ti! {{defeated}} se inclina ante tu dominio*",
                        "*¡Victoria Épica! {{winner}} Celebra con emoción!*",
                        "*¡Increible dominio! {{defeated}}  no pudo descifrar tus runas de combate*",
                    ],
                    gifs: [
                        "https://c.tenor.com/YXXkNqv16AgAAAAd/tenor.gif",
                        "https://c.tenor.com/oTCZi_rw6FsAAAAd/tenor.gif",
                        "https://c.tenor.com/mjTBpxxGig8AAAAd/tenor.gif",
                        "https://c.tenor.com/cegQvCIt34UAAAAd/tenor.gif",
                        "https://c.tenor.com/8Gu7ihnHlr8AAAAd/tenor.gif",
                        "https://c.tenor.com/uYUQPKe2S3QAAAAd/tenor.gif",
                        "https://c.tenor.com/CcjgaZNW_rkAAAAd/tenor.gif",
                        "https://c.tenor.com/S4e7zz52p8gAAAAd/tenor.gif",
                        "https://c.tenor.com/lvlf2XuFYrIAAAAd/tenor.gif",
                        "https://c.tenor.com/uiak6BECN_sAAAAd/tenor.gif",
                        "https://c.tenor.com/hogpCcg50NIAAAAC/tenor.gif"
                    ]
                },

                defeated: {
                    titles: [
                        "Has caído en combate...",
                        "Tu fuerza no fue suficiente esta vez.",
                        "Te has desplomado ante el poder rival.",
                        "Una amarga derrota...",
                        "Has sido superado en esta danza de hechizos.",
                    ],
                    description: [
                        `*Tu varita se apaga... {{winner}} te ha superado en esta batalla. Suerte la proxima vez*`,
                        `*Tu personaje no puede más... {{winner}} ha agotado toda tu energia. ¡Recupera fuerzas para la revancha!*`,
                        `*El oraculo predijo esta derrota... {{winner}} ha hecho que esta profecia se cumpliera*`,
                    ],
                    gifs: [
                        "https://c.tenor.com/y0dPmn6pPF8AAAAd/tenor.gif",
                        "https://c.tenor.com/sho2lF0Ai2EAAAAd/tenor.gif",
                        "https://c.tenor.com/qEBvxi73QRYAAAAd/tenor.gif",
                        "https://c.tenor.com/Sm05Mnf5Rr4AAAAd/tenor.gif",
                        "https://c.tenor.com/8Gu7ihnHlr8AAAAd/tenor.gif",
                        "https://c.tenor.com/ZtMsZWD9jEcAAAAd/tenor.gif",
                    ]
                },

                espectador: {
                    titles: [
                        "¡El duelo ha finalizado!"
                    ],
                    description: [
                        `¡El piso tiembla! {{winner}} dejó enterrado a {{defeated}} en escombros`,
                        `¡DUELO LEGENDARIO! {{winner}} y {{defeated}} chocaron como titanes, pero solo uno pudo alzarse a la victoria ({{winner}})`,
                        `¡Historia en cada hechizo! Luego de {{turnos}} rondas, {{winner}} se alza con el triunfo`,
                        `¿Eso fue un duelo o un tutorial? {{winner}} gano en {{turnos}} rondas. ¡Los espectadores bostezaron!`,
                    ],
                    gifs: [
                        "https://c.tenor.com/L-9qPsfXVRsAAAAC/tenor.gif"
                    ],
                }
            },

            surrender: {
                victory: {
                    titles: ["El enemigo se ha rendido"],
                    description: [
                        `¡VICTORIA POR DEFAULT! {{defeated}} ha huido del campo de batalla. La gloria es tuya, aunque el combate quedó inconcluso`,
                        `¿Miedo o sabiduría? Aceptas la rendición de {{defeated}} con un gesto noble, pero tu ego pide más acción`,
                        `¡LA ARENA CORONA A SU CAMPÉON! Recibes una lluvia de petalos al aceptar la rendición de {{defeated}}`,
                        `¡JAQUE MATE PSICOLÓGICO! {{defeated}} no soportó tu mirada intimidante y huyó`,
                        `¡BRILLO TÁCTICO! {{defeated}} se rindio al ver tu sonrisa de confianza. ¿Estrategia o suerte?`
                    ],
                    gifs: [
                        "https://c.tenor.com/QyxNhEWGZmgAAAAd/tenor.gif",
                        "https://c.tenor.com/rKqdDp_s0oYAAAAd/tenor.gif",
                        "https://c.tenor.com/fjgE4PiJdAMAAAAd/tenor.gif",
                        "https://c.tenor.com/ZE1DnkL3qigAAAAd/tenor.gif",
                    ]
                },
                defeated: {
                    titles: [
                        "Te rindes ante la adversidad.",
                        "El orgullo duele más que las heridas.",
                        "La derrota voluntaria… aún respiras.",
                        "Has soltado tu varita."
                    ],
                    description: [
                        "A veces es mejor saber cuando retirarse..."
                    ],
                    gifs: [
                        "https://c.tenor.com/MMA6_WvqS60AAAAd/tenor.gif",
                        "https://c.tenor.com/am4tzoTsnRoAAAAd/tenor.gif",
                        "https://c.tenor.com/mUIXigPWPuYAAAAd/tenor.gif",
                        "https://c.tenor.com/XbfdY2Lx-zwAAAAd/tenor.gif",
                        "https://c.tenor.com/QflxuGwf_IwAAAAd/tenor.gif", //Apartir de este gif empiezan retiradas normales
                        "https://c.tenor.com/sigrrzQkKi4AAAAd/tenor.gif",
                        "https://c.tenor.com/ScWPoTxfu5cAAAAd/tenor.gif",
                        "https://c.tenor.com/5lvXZOwWSq0AAAAd/tenor.gif",
                    ],
                },

                espectador: {
                    titles: ["¡El duelo ha finalizado por rendicion!"],
                    description: ["¡¿Que acaba de pasar?!, {{defeated}} se acaba de rendir"],
                    gifs: ["https://c.tenor.com/5lvXZOwWSq0AAAAC/tenor.gif"],
                },
            },

            afk: {
                titles: [
                    "Una pausa eterna",
                    "El tiempo se detuvo",
                    "Atrapados en el limbo",
                    "El duelo fue cancelado"
                ],
                description: [
                    `*"El tiempo magico se congeló... el duelo se ha cancelado debido a que los dos jugadores se quedaron afk*`,
                    `*¿Siguen ahi? El duelo fue cancelado debido a que los jugadores se quedaron AFK*`,
                    `*Fueron enviado al reino de los AFK.  El duelo fue cancelado debido a que los jugadores se quedaron AFK`,
                ],
                gifs: [
                    "https://c.tenor.com/wI_7nfZiX2UAAAAd/tenor.gif",
                    "https://c.tenor.com/urs-gwqkOV8AAAAd/tenor.gif",
                    "https://c.tenor.com/4o5tuOdYvTAAAAAd/tenor.gif",
                    "https://c.tenor.com/2TowZVLGj2oAAAAd/tenor.gif",
                    "https://c.tenor.com/UVHo2m3hHckAAAAd/tenor.gif",
                    "https://c.tenor.com/gjBx2zbdJjAAAAAd/tenor.gif",
                    "https://c.tenor.com/MUh5wIdD-E0AAAAd/tenor.gif",
                    "https://c.tenor.com/1fgzvqahPHAAAAAd/tenor.gif",
                ]
            },
        }

        let title;
        let descr;
        let gif;


        const getMessage = endDuelAssets[type]
        if (!getMessage) throw new Error(`Tipo de fin de duelo desconocido ${type}`)

        const typeSelect = win === null ? "espectador" : win ? "victory" : "defeated"


        if (type === "afk") {
            title = pickRandom(getMessage.titles)
            descr = pickRandom(getMessage.description)
            gif = pickRandom(getMessage.gifs)
        } else {
            title = pickRandom(getMessage[typeSelect].titles)
            descr = pickRandom(getMessage[typeSelect].description)
            gif = pickRandom(getMessage[typeSelect].gifs)

        }




        const turnosVal = context.turno || context.ronda || context.turnos || sesion?.ronda || 1;
        const winnerVal = context.winner || "Vencedor";
        const defeatedVal = context.defeated || "Perdedor";

        descr = descr
            .replaceAll("{{winner}}", winnerVal)
            .replaceAll("{{defeated}}", defeatedVal)
            .replaceAll("{{turnos}}", String(turnosVal));

        title = title
            .replaceAll("{{winner}}", winnerVal)
            .replaceAll("{{defeated}}", defeatedVal)
            .replaceAll("{{turnos}}", String(turnosVal));

        return { title, descr, gif }
    }


    // Funciones auxiliares para construir componentes específicos, como barras de vida, mensajes de ambiente, etc. **** 

    // Modificar diseño final, estado incompleto.
    mensajeAmbiente(sesion, yo = null) {
        const actor = sesion.getCurrentActor()
        const todos = sesion.getAllCombatientes()

        // ── Variables del estado ──────────────────────────────────────────────
        const hpPromedioGeneral = todos.reduce((s, c) => s + (c.HP / c.stats.hpMax), 0) / todos.length
        const hpYo = yo ? yo.HP / yo.stats.hpMax : null
        const hpActor = actor ? actor.HP / actor.stats.hpMax : null
        const esUltimaRonda = sesion.compasMax < 100
        const hayEfectos = todos.some(c => c.statusEffect.length > 0)
        const alguienCritico = todos.some(c => (c.HP / c.stats.hpMax) < 0.15)
        const esMiTurno = yo && String(actor?.ID) === String(yo.ID)
        const rivalCritico = yo
            ? sesion.teams.find(t => !t.some(c => String(c.ID) === String(yo.ID)))
                ?.some(c => (c.HP / c.stats.hpMax) < 0.15)
            : false

        // ── Prioridad de mensajes (de más específico a más general) ──────────

        // Situaciones muy específicas — estas son las "mágicas"
        if (esMiTurno && hpYo < 0.15) return this._random([
            "El peso de tus heridas amenaza con apagarte... ¿Tienes algo guardado?",
            "Tu cuerpo grita que pares. Tu alma dice lo contrario.",
            "Un último aliento. Úsalo bien."
        ])

        if (rivalCritico && esMiTurno) return this._random([
            "Hueles la victoria. No la dejes escapar.",
            "Está a punto de caer. Un golpe más.",
            "La batalla casi termina... ¿O eso crees?"
        ])

        if (esUltimaRonda && alguienCritico) return this._random([
            "El tiempo se agota. Alguien no verá el próximo compás.",
            "La ronda llega a su fin... y alguien también.",
        ])

        if (hayEfectos && alguienCritico) return this._random([
            "El veneno hace su trabajo silenciosamente.",
            "Los efectos cobran su precio. El campo de batalla huele a desesperación.",
        ])

        if (sesion.ronda === 1) return this._random([
            "El primer compás siempre define el resto.",
            "Nadie sabe aún quién dominará este campo.",
            "La tensión antes del primer golpe es casi tangible.",
        ])

        if (hayEfectos) return this._random([
            "El campo de batalla está lleno de efectos activos. La magia cruje en el aire.",
            "Los hechizos reverberan entre los combatientes.",
        ])

        // General según HP promedio
        if (hpPromedioGeneral > 0.75) return this._random([
            "La batalla apenas comienza. Nadie cede terreno.",
            "Ambos lados conservan sus fuerzas. Por ahora.",
            "El equilibrio es frágil. Cualquier error lo rompe.",
        ])

        if (hpPromedioGeneral > 0.4) return this._random([
            "La batalla se intensifica lentamente.",
            "Las heridas comienzan a acumularse.",
            "El cansancio empieza a notarse en cada movimiento.",
        ])

        return this._random([
            "La desesperación flota en el aire.",
            "Nadie saldrá ileso de esto.",
            "El final se acerca para alguien.",
        ])
    }

    _random(arr) {
        return arr[Math.floor(Math.random() * arr.length)]
    }

    // Funciones de interacción para interfaz de combate, interactuar con la sesión, construir componentes dinámicos según el estado del combate, etc. ****

    createActionButtons(sesion, actor) {
        if (!actor) return [];
        const esNPC = actor.isNPC
        const restrictions = esNPC ? actor.restrictions : {}

        return [
            { type: 14, divider: true, spacing: 1 },
            {
                type: 1,
                components: [
                    {
                        type: 2, style: 2,
                        label: "Atacar",
                        emoji: { name: "sword", id: "1370631600454504498" },
                        disabled: restrictions.Attack === true,
                        custom_id: `DuelAct-${actor.ownerId}-${actor.ID}-attack-${sesion.sessionId}`
                    },
                    {
                        type: 2, style: 2,
                        label: "Defenderse",
                        emoji: { name: "yellowShield", id: "1370631300616159233" },
                        disabled: restrictions.Defend === true,
                        custom_id: `DuelAct-${actor.ownerId}-${actor.ID}-defend-${sesion.sessionId}`
                    },
                    {
                        type: 2, style: 2,
                        label: (sesion?.type === "exploration" || sesion?.duelType === "exploration" || sesion?.isExploracion === true) ? "Mochila" : "Inventario",
                        emoji: { name: "EmuNui", id: "1370631281028890727" },
                        disabled: restrictions.Bag === true,
                        custom_id: `DuelAct-${actor.ownerId}-${actor.ID}-bag-${sesion.sessionId}`
                    },
                    {
                        type: 2, style: 2,
                        label: "Hechizos",
                        emoji: { name: "SpellBook", id: "1370631319910092811" },
                        disabled: restrictions.Spells === true,
                        custom_id: `DuelAct-${actor.ownerId}-${actor.ID}-spells-${sesion.sessionId}`
                    },
                    {
                        type: 2, style: 4,
                        label: "Rendirse",
                        emoji: { name: "whiteflagpepo", id: "1370631336536047737" },
                        disabled: restrictions.Surrender === true,
                        custom_id: `DuelAct-${actor.ownerId}-${actor.ID}-surrender-${sesion.sessionId}`
                    }
                ]
            }
        ]
    }

    buildTarget(sesion, actor, rivales, action, spellId = null) {

        const opciones = rivales.map(target => {
            const level = target.nivelMagico ?? target.stats?.nivelMagico ?? "???";
            return {
                label: `${target.Nombre} (FE: ${level})`,
                value: `duel_target*${spellId}*${target.ID}`,
                description: `HP: ${target.HP}/${target.stats?.hpMax ?? target.HP}`,
                emoji: null,
                default: false,
            };
        })

        const rivalesVivos = rivales.filter(t => !t.defeated)
        const rivalesMessage = rivalesVivos.map(t => {
            const level = t.nivelMagico ?? t.stats?.nivelMagico ?? "???";
            return `❧ **${t.Nombre} (FE: ${level})**\n` +
                `-# HP: ${barraCustom(t.HP, t.stats?.hpMax ?? t.HP, 1, 10)}`;
        }).join("\n\n")

        const jsonMessage = [
            {
                type: 17,
                accent_color: null,
                spoiler: false,
                components: [
                    {
                        type: 10,
                        content: `Selecciona tu objetivo para ${action === "attack" ? "atacar" : "lanzar el hechizo"}:`

                    },
                    {
                        type: 10,
                        content: rivalesMessage || "No hay rivales disponibles para seleccionar. (Si el error persiste, crea una publicación en <#1319812744035438642>.)"
                    },
                    {
                        type: 14,
                        divider: true,
                        spacing: 1
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: `UseSpell-${actor.ownerId}-${sesion.sessionId}`,
                                options: opciones,
                                placeholder: "¿A quién atacas?",
                                min_values: 1,
                                max_values: 1,
                                disabled: false
                            }
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 4,
                                label: "Cancelar",
                                emoji: null,
                                disabled: false,
                                custom_id: `DuelAct-${actor.ownerId}-${actor.ID}-cancelar-${sesion.sessionId}`
                            }
                        ]
                    }
                ]
            }
        ]

        console.log("Depuración 1:", jsonMessage[0].components[1].content)
        console.log("Depuración 2:", jsonMessage[0].components[4].components[0])

        return jsonMessage
    }

    createObjetivesModal(sesion, actor, arg3, arg4, arg5 = null) {
        if (arg5 && !arg5.Mecanicas && !arg5.ID && !arg5._id) {
            return arg5;
        }

        if (Array.isArray(arg4) || (arg5 && (arg5.Mecanicas || arg5._id))) {
            const candidatosDamage = arg3 || [];
            const candidatosHealing = arg4 || [];
            const hechizo = arg5;

            const modal = new ModalBuilder()
                .setTitle(`Objetivos (${hechizo.Nombre})`)
                .setCustomId(`ObjetivesModal-${actor.ownerId}-${sesion.sessionId}`);

            if (candidatosDamage.length > 0) {
                const options = candidatosDamage.map(target => ({
                    label: `${target.Nombre} (FE: ${target.nivelMagico})`,
                    value: String(target.ID),
                    description: `HP: ${target.HP}/${target.stats.hpMax}`
                }));

                const checkGroup = new CheckboxGroupBuilder()
                    .setCustomId('targets_damage')
                    .setMaxValues(hechizo.Mecanicas?.cantidad || 1)
                    .addOptions(options);


                const checkLabel = new LabelBuilder()
                    .setLabel('Objetivos para el Daño:')
                    .setCheckboxGroupComponent(checkGroup);

                modal.addLabelComponents(checkLabel);
            }

            if (candidatosHealing.length > 0) {
                const options = candidatosHealing.map(target => ({
                    label: `${target.Nombre} (FE: ${target.nivelMagico})`,
                    value: String(target.ID),
                    description: `HP: ${target.HP}/${target.stats.hpMax}`
                }));

                const checkGroup = new CheckboxGroupBuilder()
                    .setCustomId('targets_healing')
                    .setMaxValues(hechizo.Mecanicas?.cantidad || 1)
                    .addOptions(options);

                const checkLabel = new LabelBuilder()
                    .setLabel('Objetivos para la Curación:')
                    .setCheckboxGroupComponent(checkGroup);

                modal.addLabelComponents(checkLabel);
            }

            return modal;
        }

        const candidatos = arg3;
        const cantidad = arg4;
        const preSelectedIds = arg5;

        if (preSelectedIds && preSelectedIds.length > 0) {
            return preSelectedIds;
        }
        if (candidatos && candidatos.length > 0) {
            return candidatos.slice(0, cantidad).map(c => c.ID);
        }
        return null;
    }

    async duelBattleMessage(duel, player, rivalTeam, isEspectador = false) {


        if (player.statusEffect?.length > 0) {
            const efectosActivos = player.statusEffect.map(effect => `- -# ${effect.Nombre} [Duracion: ${effect.duracion}]`).join('\n');
            effectsActivesU = `${efectosActivos}`
        }

        if (rivalTeam.statusEffect?.length > 0) {
            const efectosActivos = rivalTeam.statusEffect.map(effect => `- -# ${effect.Nombre} [Duracion: ${effect.duracion}]`).join('\n');
            effectsActivesR = `${efectosActivos}`
        }

        const isTurn = duel.turnoActual.ID === player.ID ? "¡Es tu turno!" : "Esperando la acción del rival..."



        if (rivalTeam.length > 1) {
            for (const pj of rivalTeam) {
                const level = pj.nivelMagico ?? pj.stats?.nivelMagico ?? "???";
                rivalTeams += `- **${pj.Nombre} \`(FE: ${level})\`**` + `| HP: ${await this.characterComponents(pj, true, true)}\n`
            }
        } else if (rivalTeam.length === 1) {
            for (const pj of rivalTeam) {
                const level = pj.nivelMagico ?? pj.stats?.nivelMagico ?? "???";
                rivalTeams = `- **${pj.Nombre} \`(FE: ${level})\` **` + `\n-# HP: ${await this.characterComponents(pj, false, true)}`
            }

        } else {
            rivalTeams = "No hay rivales.";
        }

        const userDuelsMini = [
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
                                "url": duel.turnoActual.avatarURL
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `${messageTitle}` + `\n\n${rivalTeam.length > 1 ? "Tus rivales:" : "**Tu rival**"}`
                            }
                        ]
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
                        "content": `Tu personaje: **${player.Nombre} \`(FE: ${player.nivelMagico ?? player.stats?.nivelMagico ?? "???"})\`**` + `\n-# HP: ${await this.characterComponents(player, false, true)}` +
                            `\n-# Mana: ${barraCustom(player.Mana, player.stats.manaMax, 2, 5)}` + `\n\nEfectos: ${this.formatEfectos(player, duel)}`
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


        if (duel.turnoActual.ID === player.ID) {
            const buttons = this.createActionButtons(duel)

            userDuelsMini[0].components.push(...buttons)
        }

        return userDuelsMini
    }


    /**
     * 
     * @param {Object} author El autor de la sala
     * @param {boolean} isPrivate  La sala es privada o publica
     * @param {Object} data - Información de la sala: Character, Soul, codeSala, nombreSala, modoDuelo
     * @param {boolean} waiting - Solo para jugadores que se unen y que son diferentes al creador de la sala, si es true, se mostrará un mensaje de espera
     * @returns {Array} - Componente de mensaje para la sala de duelo
     */
    buildSalaMessage(author, isPrivate, data, waiting = false, interaction_user) {
        const { character, soul, imageSala, apuestas, tipoApuesta } = data
        const codeSala = data.codeSala || data.code;
        const nombreSala = data.nombreSala;
        const modoDuelo = data.modoDuelo || (data.limitTeam1 && data.limitTeam2 ? `${data.limitTeam1} vs ${data.limitTeam2}` : '1 vs 1');
        const creatorName = character?.perfil?.Nombre || data.autorCharacter || 'Personaje';

        const t1Count = data.team1 ? Object.keys(data.team1).length : 1;
        const t2Count = data.team2 ? Object.keys(data.team2).length : 0;
        const totalPlayers = t1Count + t2Count;
        const disableStart = totalPlayers <= 1 || (data.isNPC && (data.estado === "Configurando NPCs..." || !data.npcLobbyStarted));

        const imageDefault = "https://i.pinimg.com/1200x/16/f7/00/16f70096006f074ddba8b9d390e52ac6.jpg"
        const mediaUrl = imageSala || imageDefault;

        const nombresMap = {
            espejo: 'Apuesta Espejo',
            equivalente: 'Rareza Equivalente',
            fijo: 'Lumens Fijos',
            libre: 'Entrada Libre'
        };
        const nombreTipo = nombresMap[tipoApuesta] || null;
        const tipoApuestaStr = nombreTipo ? `\n-# \`Tipo apuesta:\` ${nombreTipo}` : '';

        if (waiting) {
            const waitingMessage = [
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
                                    "custom_id": `preDuel-${interaction_user.id}-salirse-${codeSala}`
                                }
                            ]
                        }
                    ]
                }
            ]
            return waitingMessage
        }

        // Generar listas dinámicas de Retadores (Equipo 1) y Contrincantes (Equipo 2)
        let retadoresContent = "";
        if (data.team1 && Object.keys(data.team1).length > 0) {
            const list = Object.values(data.team1).map(char => {
                const isNPC = !!(char.isNPC || (typeof char._id === 'string' && char._id.startsWith("NPC-")));
                const nombre = char.perfil?.Nombre || char.Nombre || 'Combatiente';
                const nivel = isNPC
                    ? (char.nivelMagico || char.stats?.nivelMagico || '')
                    : (char.sendero?.StelarFragmentsTotal ?? char.sendero?.StelarFragments ?? char.fragmentos?.StelarFragmentsTotal ?? char.fragmentos?.StelarFragments ?? char.StelarFragments ?? char.StelarFragmentsTotal ?? '');
                const labelTag = isNPC ? `(Lv: ${nivel})` : `(FE: ${nivel})`;
                return `- -# ${nombre}${isNPC ? ' [NPC]' : ''}${nivel !== '' ? ` ${labelTag}` : ''}`;
            }).join('\n');
            retadoresContent = `**Retadores:**\n${list}`;
        } else {
            const creatorFE = soul?.sendero?.StelarFragmentsTotal ?? soul?.sendero?.StelarFragments ?? soul?.fragmentos?.StelarFragmentsTotal ?? soul?.fragmentos?.StelarFragments ?? soul?.StelarFragments ?? '';
            retadoresContent = `**Retadores:**\n- -# ${creatorName}${creatorFE !== '' ? ` (FE: ${creatorFE})` : ''}`;
        }

        let contrincantesContent = "";
        if (data.team2 && Object.keys(data.team2).length > 0) {
            const list = Object.values(data.team2).map(char => {
                const isNPC = !!(char.isNPC || (typeof char._id === 'string' && char._id.startsWith("NPC-")));
                const nombre = char.perfil?.Nombre || char.Nombre || 'Combatiente';
                const nivel = isNPC
                    ? (char.nivelMagico || char.stats?.nivelMagico || '')
                    : (char.sendero?.StelarFragmentsTotal ?? char.sendero?.StelarFragments ?? char.fragmentos?.StelarFragmentsTotal ?? char.fragmentos?.StelarFragments ?? char.StelarFragments ?? char.StelarFragmentsTotal ?? '');
                const labelTag = isNPC ? `(Lv: ${nivel})` : `(FE: ${nivel})`;
                return `- -# ${nombre}${isNPC ? ' [NPC]' : ''}${nivel !== '' ? ` ${labelTag}` : ''}`;
            }).join('\n');
            contrincantesContent = `**Contrincantes:**\n${list}`;
        } else {
            contrincantesContent = `**Contrincantes:**\n- -# Aun sin contrincantes...`;
        }

        // Construir componentes para salaMessage
        const salaComponents = [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": mediaUrl
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": nombreSala ? `# ${nombreSala}` : `# Sala de duelo | ${creatorName}`
                    },
                    {
                        "type": 10,
                        "content": "-# `Estado:` *En espera...*\n-# `Creador:` " + `${author}` + "\n-# `Codigo de sala:` " + `||${codeSala}||` + `\n-# \`Modo de duelo:\` ${modoDuelo}` + tipoApuestaStr
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
                "content": retadoresContent
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": contrincantesContent
            }
        ];

        // Construir componentes para serverMessage
        const serverComponents = [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": mediaUrl
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": nombreSala ? `# ${nombreSala}` : `# Sala de duelo | ${creatorName}`
                    },
                    {
                        "type": 10,
                        "content": "-# `Estado:` *En espera...*\n-# `Creador:` " + `${author}` + "\n-# `Codigo de sala:` " + `${isPrivate ? `Privada` : codeSala}` + `\n-# \`Modo de duelo:\` ${modoDuelo}` + tipoApuestaStr
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
                "content": retadoresContent
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": contrincantesContent
            }
        ];

        // Añadir apuestas si existen y tienen valor
        if (apuestas && (apuestas.lumens > 0 || (apuestas.objetos && apuestas.objetos.length > 0))) {
            const blockApuestas = [
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 10,
                    "content": "### Apuestas:"
                }
            ];

            let contentApuestas = "";
            if (apuestas.lumens > 0) {
                contentApuestas += `- -# Lumens: ${apuestas.lumens}\n`;
            }
            if (apuestas.objetos && apuestas.objetos.length > 0) {
                apuestas.objetos.forEach(obj => {
                    contentApuestas += `- -# ${obj.nombre} x ${obj.cantidad}\n`;
                });
            }
            contentApuestas = contentApuestas.trim();

            blockApuestas.push({
                "type": 10,
                "content": contentApuestas
            });

            salaComponents.push(...blockApuestas);
            serverComponents.push(...blockApuestas);
        }

        // Añadir footer final de combate V3
        const blockFooter = [
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 10,
                "content": `-# Sistema de combate V3 - Creado hace: <t:${Math.floor(Date.now() / 1000)}:R>`
            }
        ];

        salaComponents.push(...blockFooter);
        serverComponents.push(...blockFooter);

        const salaMessage = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": salaComponents
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 2,
                        "label": isPrivate ? "Privada" : "Publica",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": isPrivate ? `preDuel-${author.id}-publica-${codeSala}` : `preDuel-${author.id}-privada-${codeSala}`
                    },
                    {
                        "type": 2,
                        "style": 3,
                        "label": "Iniciar Duelo",
                        "emoji": null,
                        "disabled": disableStart,
                        "custom_id": `preDuel-${author.id}-start-${codeSala}`
                    },
                    {
                        "type": 2,
                        "style": 4,
                        "label": "Eliminar sala",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": `preDuel-${author.id}-delete-${codeSala}`
                    }
                ]
            }
        ];

        const serverMessage = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": serverComponents
            }
        ];



        return { salaMessage, serverMessage }
    }

    async buildBagMessage(sesion, actor, page = 1) {
        const catalogoObjetos = require("../catalogoObjetos");
        const character = await characters.findOne({ _id: Number(actor.ID) });
        const isExploracion = Boolean(sesion?.type === "exploration" || sesion?.duelType === "exploration" || sesion?.isExploracion === true);
        const inventario = isExploracion
            ? (character?.economia?.Mochila || [])
            : (character?.economia?.Inventario || character?.Inventario || []);

        const noItemsMsg = isExploracion
            ? "No tienes objetos en tu mochila para usar en este combate"
            : "No tienes objetos en tu inventario para usar en este combate";

        if (!inventario || inventario.length === 0) {
            return noItemsMsg;
        }

        const filteredItems = [];
        for (const item of inventario) {
            const itemId = Number(item.ID || item.id);
            const itemRegion = item.Region || item.region;
            const globalObj = catalogoObjetos.getObjetoPorId(itemRegion, itemId);
            const inCombat = globalObj?.uso?.contexto === "combate" ||
                globalObj?.uso?.contexto === "ambos" ||
                globalObj?.restricciones?.InCombat === true;
            if (!sesion || inCombat) {
                filteredItems.push({
                    ...item,
                    ID: itemId,
                    Nombre: item.Nombre || globalObj?.Nombre || "Objeto Desconocido",
                    Region: item.Region || globalObj?.Region || "",
                    Tipo: item.Tipo || globalObj?.Tipo || [],
                    Descripcion: globalObj?.Descripcion || "Sin descripción",
                    Rareza: globalObj?.Rareza || "Común"
                });
            }
        }

        if (filteredItems.length === 0) {
            return noItemsMsg;
        }

        const itemsPerPage = 7;
        const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
        const currentPage = Math.max(1, Math.min(totalPages, page));
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        const listText = paginatedItems.map(item => {
            const cant = item.Cantidad ?? item.cantidad ?? 1;
            return `-# **${item.Nombre}** (x${cant}) - *${item.Rareza}*`;
        }).join("\n");

        const contentDescription = `**Página ${currentPage}/${totalPages}**\n\nContenido:\n${listText || "- No hay objetos en esta página"}`;

        const dropdownOptions = paginatedItems.map(item => {
            return {
                label: item.Nombre.substring(0, 100),
                value: `duelo*${item.ID}*${item.Region}`,
                description: item.Descripcion ? (item.Descripcion.length > 100 ? item.Descripcion.substring(0, 97) + "..." : item.Descripcion) : "Sin descripción",
                emoji: null,
                default: false
            };
        });

        const sesId = sesion ? (sesion.sessionId || sesion.id) : "backpack";
        const titleHeader = isExploracion ? "### Mochila" : "### Inventario";
        const labelCerrar = isExploracion ? "Cerrar mochila" : "Cerrar inventario";

        const jsonPlantilla = [
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
                                "url": "https://i.pinimg.com/736x/04/22/54/042254499e121c59a46e3b9941282b88.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": titleHeader
                            },
                            {
                                "type": 10,
                                "content": contentDescription
                            }
                        ]
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `UseItem-${actor.ownerId}-${sesId}`,
                                "options": dropdownOptions,
                                "placeholder": "Selecciona un objeto",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": dropdownOptions.length === 0
                            }
                        ]
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 2,
                                "label": "<",
                                "emoji": null,
                                "disabled": currentPage <= 1,
                                "custom_id": `DuelAct-${actor.ownerId}-${actor.ID}-bag_atras-${sesId}-${currentPage}`
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": ">",
                                "emoji": null,
                                "disabled": currentPage >= totalPages,
                                "custom_id": `DuelAct-${actor.ownerId}-${actor.ID}-bag_adelante-${sesId}-${currentPage}`
                            },
                            {
                                "type": 2,
                                "style": 4,
                                "label": labelCerrar,
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `DuelAct-${actor.ownerId}-${actor.ID}-bag_cerrar-${sesId}`
                            }
                        ]
                    }
                ]
            }
        ];

        return jsonPlantilla;
    }

    async buildSpellList(sesion, actor, page = 1) {
        const emojiMap = {
            "Pyró": "🔥",
            "Kryo": "❄️",
            "Rakau": "🌳",
            "Electro": "⚡",
            "Lux": "✨",
            "Wind": "🍃",
            "Aqua": "💧",
            "Lapis": "🪨"
        }

        const TurnProcessor = require("./turnProcessor");
        const hechizosColl = db_rol.collection("Hechizos_globales");

        const userSpellsIds = actor.hechizos || [];
        const idsDeHechizos = userSpellsIds.map(hechizo => hechizo.ID);


        if (userSpellsIds.length === 0) {
            return "No tienes hechizos disponibles en tu grimorio";
        }

        const allSpells = await hechizosColl.find({ _id: { $in: idsDeHechizos } }).toArray();
        const validSpells = [];

        console.log(allSpells, "Todos los hechizos del usuario");

        for (const spell of allSpells) {
            const check = await TurnProcessor.checkSpellRequirements(actor, spell, sesion);
            console.log(check, "Resultado de la verificación del hechizo");
            if (check.success) {
                validSpells.push(spell);
            }
        }

        console.log(validSpells, "Hechizos válidos después de la verificación");

        if (validSpells.length === 0) {
            return "No cumples con los requisitos (maná, cooldown, etc.) para lanzar ninguno de tus hechizos actualmente.";
        }

        const itemsPerPage = 5;
        const totalPages = Math.ceil(validSpells.length / itemsPerPage) || 1;
        const currentPage = Math.max(1, Math.min(totalPages, page));
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedSpells = validSpells.slice(startIndex, startIndex + itemsPerPage);

        const listText = paginatedSpells.map(spell => {
            const manaCost = spell.Costos?.mana ?? 0;
            const castTime = spell.Mecanicas?.cast?.tiempo ?? 1;

            const effectsList = [];
            if (spell.Mecanicas?.damage) {
                effectsList.push(`Daño base: ${spell.Mecanicas.damage.base}`);
            }
            if (spell.Mecanicas?.healing) {
                effectsList.push(`Curación base: ${spell.Mecanicas.healing.base}`);
            }
            if (spell.Mecanicas?.Efectos) {
                for (const [k, v] of Object.entries(spell.Mecanicas.Efectos)) {
                    effectsList.push(`${v.Nombre || k} (${v.duracion} turnos)`);
                }
            }
            const effectsStr = effectsList.length > 0 ? effectsList.join(', ') : 'Ninguno';

            let desc = spell.Descripcion || 'Sin descripción';
            if (desc.length > 100) {
                desc = desc.substring(0, 97) + '...';
            }

            return `-# ➺ ${emojiMap[spell.Elemento] || '`❓`'} | **${spell.Nombre}** [${manaCost} de mana] - [\`⏳\`: ${castTime}]\n-# *${desc}*\n-# *Efectos: [${effectsStr}]*`;
        }).join('\n');

        const hpMax = actor.stats?.hpMax ?? actor.perfil?.HP ?? actor.HP ?? 100;
        const manaMax = actor.stats?.manaMax ?? actor.perfil?.Mana ?? actor.Mana ?? 100;

        const mainContent = `### Hechizos Disponibles\n\n- -# Mana Disponible: ${actor.Mana}/${manaMax}\n- -# HP disponible: ${actor.HP}/${hpMax}`;
        const spellsDetailContent = `${listText}`;

        const dropdownOptions = paginatedSpells.map(spell => {
            const manaCost = spell.Costos?.mana ?? 0;
            const castTime = spell.Mecanicas?.cast?.tiempo ?? 1;
            return {
                label: spell.Nombre.substring(0, 100),
                value: `duelo*${spell._id}`,
                description: `Costo mana: ${manaCost}, ⏳: ${castTime}.`,
                emoji: emojiMap[spell.Elemento] || '❓',
                default: false
            };
        });

        const sesId = sesion ? (sesion.sessionId || sesion.id) : "grimorio";
        const firstSpellImg = paginatedSpells[0]?.imagenURL || paginatedSpells[0]?.imagen || 'https://i.pinimg.com/1200x/93/ac/38/93ac3824d9c66ee139aa873a13feed33.jpg';

        const jsonPlantilla = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": mainContent
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
                                "url": firstSpellImg
                            },
                            "description": "Imagen del hechizo",
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": spellsDetailContent
                            }
                        ]
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": crearCustomId({
                                    action: "UseSpell",
                                    characterId: actor.id,
                                    userId: actor.ownerId,
                                    extras: [`${sesId}`]
                                }),
                                "options": dropdownOptions,
                                "placeholder": "Selecciona tu hechizo",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": dropdownOptions.length === 0
                            }
                        ]
                    }
                ]
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 2,
                        "label": "<",
                        "emoji": null,
                        "disabled": currentPage <= 1,
                        "custom_id": crearCustomId({
                            action: "DuelAct",
                            characterId: actor.ID,
                            userId: actor.ownerId,
                            extras: ["spells_atras", `${sesId}`, `${currentPage}`]
                        })
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": ">",
                        "emoji": null,
                        "disabled": currentPage >= totalPages,
                        "custom_id": crearCustomId({
                            action: "DuelAct",
                            characterId: actor.ID,
                            userId: actor.ownerId,
                            extras: ["spells_adelante", `${sesId}`, `${currentPage}`]
                        })
                    },
                    {
                        "type": 2,
                        "style": 4,
                        "label": "Cerrar grimorio",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": crearCustomId({
                            action: "DuelAct",
                            characterId: actor.ID,
                            userId: actor.ownerId,
                            extras: ["spells_cerrar", `${sesId}`, `${currentPage}`]
                        })
                    },
                    {
                        "type": 2,
                        "style": 3,
                        "label": "¿Suerte?",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": crearCustomId({
                            action: "DuelAct",
                            characterId: actor.ID,
                            userId: actor.ownerId,
                            extras: ["spells_suerte", `${sesId}`, `${currentPage}`]
                        })
                    }
                ]
            }
        ];

        return jsonPlantilla;
    }
}

module.exports = new CombatUI()