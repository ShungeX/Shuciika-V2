const { barraCustom, asciiText } = require("../../utils/utilidadesTexto.js")
const { etiquetaPoder } = require("./combatientes")

const NL = "\n"
const AVATAR_DEFAULT ="https://i.pinimg.com/736x/1a/1f/1d/1a1f1d639f5e61ffa219819b1e2f5b44.jpg"
const IMAGEN_EQUIPO_DEFAULT = "https://i.pinimg.com/1200x/e5/38/67/e53867f8979e6df0b3dd73728feabf08.jpg"

function etiquetaNivel(c) {
    return etiquetaPoder(c, "LV")
}

/** Bloque de estado de un combatiente para la vista de espectador en curso */
function bloqueCombatiente(c, info, encabezado = "##") {
    const esTurno = info.actorId != null && String(info.actorId) === String(c.ID) && !c.defeated
    const estado = c.defeated ? " 💀" : (esTurno ? " ⟡ *En turno*" : "")
    return [
        `${encabezado} ${c.Nombre} (${etiquetaNivel(c)})${c.isNPC ? " - [NPC]" : ""}${estado}`,
        "*`HP:`* " + barraCustom(c.HP, c.stats?.hpMax ?? c.HP, 1),
        "*`Mana:`* " + barraCustom(c.Mana, c.stats?.manaMax ?? c.Mana, 2, 5),
        "-# Efectos: " + (info.efectos ? info.efectos(c) : "Ninguno")
    ].join(NL)
}

function cabeceraEnCurso(sesion, info) {
    const ambiente = info.ambiente || "El aire se tensa entre los combatientes."
    return [
        { "type": 10, "content": "# ¡El duelo está en curso!" },
        {
            "type": 10,
            "content": [
                "-# 〝" + ambiente + "〞",
                "",
                "-# ⁍  *Ronda: " + sesion.ronda + "*",
                "-# ⁍  *Turno de: " + (info.actorLabel || "Nadie") + "*"
            ].join(NL)
        },
        { "type": 14, "divider": true, "spacing": 1 }
    ]
}

function pieEnCurso(info) {
    const fence = "```"
    return [
        { "type": 14, "divider": true, "spacing": 1 },
        {
            "type": 10,
            "content": "-# **Ultimas acciones**:" + NL + fence + "ansi" + NL + (info.ultimasAcciones || "- El duelo ha comenzado") + fence
        }
    ]
}

module.exports = {

    /**
     * Vista pública (canal espectador) mientras el duelo 1vs1 está en curso.
     * Mismo diseño que endEspectador1vs1 + ambiente, ronda, mana y efectos.
     * @param {Object} info - { ambiente, actorLabel, actorId, ultimasAcciones, efectos(c) }
     */
    espectadorEnCurso1vs1(sesion, c1, c2, info = {}) {
        const seccion = (c) => ({
            "type": 9,
            "accessory": {
                "type": 11,
                "media": { "url": c.avatarURL || AVATAR_DEFAULT },
                "description": null,
                "spoiler": false
            },
            "components": [{ "type": 10, "content": bloqueCombatiente(c, info) }]
        })

        return [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    ...cabeceraEnCurso(sesion, info),
                    seccion(c1),
                    { "type": 14, "divider": true, "spacing": 1 },
                    seccion(c2),
                    ...pieEnCurso(info)
                ]
            }
        ]
    },

    /**
     * Vista pública mientras un duelo por equipos (NvsN, o 1vsN) está en curso.
     * Una sección por equipo; cada integrante con HP, mana y efectos.
     */
    espectadorEnCursoNvsN(sesion, equipo1, equipo2, info = {}) {
        const seccionEquipo = (equipo, titulo) => {
            const imagen = equipo.length === 1
                ? (equipo[0].avatarURL || AVATAR_DEFAULT)
                : ((equipo.find(c => !c.defeated) || equipo[0])?.avatarURL || IMAGEN_EQUIPO_DEFAULT)
            const contenido = "### " + titulo + NL + equipo.map(c => bloqueCombatiente(c, info, "**❧**")).join(NL + NL)
            return {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": { "url": imagen },
                    "description": null,
                    "spoiler": false
                },
                "components": [{ "type": 10, "content": contenido.slice(0, 3900) }]
            }
        }

        return [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    ...cabeceraEnCurso(sesion, info),
                    seccionEquipo(equipo1, equipo1.length > 1 ? "Equipo 1" : "Retador"),
                    { "type": 14, "divider": true, "spacing": 1 },
                    seccionEquipo(equipo2, equipo2.length > 1 ? "Equipo 2" : "Rival"),
                    ...pieEnCurso(info)
                ]
            }
        ]
    },

    endEspectador1vs1(sesion, ganador, perdedor, context, message, rewardsMap) {
        const gObj = ganador || { Nombre: "Ganador", HP: 0, stats: { hpMax: 100 }, avatarURL: "https://i.pinimg.com/736x/1a/1f/1d/1a1f1d639f5e61ffa219819b1e2f5b44.jpg" };
        const pObj = perdedor || { Nombre: "Perdedor", HP: 0, stats: { hpMax: 100 }, avatarURL: "https://i.pinimg.com/736x/1a/1f/1d/1a1f1d639f5e61ffa219819b1e2f5b44.jpg" };

        const json = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": `# ${message?.title || "¡El duelo ha finalizado!"}`
                    },
                    {
                        "type": 10,
                        "content": `-# ${message?.descr || context?.messagesubTitle || `${gObj.Nombre} ha ganado contra ${pObj.Nombre}`}`
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
                                "url": gObj.avatarURL || "https://i.pinimg.com/736x/1a/1f/1d/1a1f1d639f5e61ffa219819b1e2f5b44.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `## ${gObj.Nombre} (${etiquetaPoder(gObj, "LV")}) - ${gObj.isNPC ? "[NPC]" : ""}  Ganador ✨ ` + "\n*`HP:`*" + `${barraCustom(gObj.HP, gObj.stats?.hpMax ?? gObj.HP, 1)}`
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
                                "url": pObj.avatarURL || "https://i.pinimg.com/736x/1a/1f/1d/1a1f1d639f5e61ffa219819b1e2f5b44.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `## ${pObj.Nombre} (${etiquetaPoder(pObj, "LV")})  ${pObj.isNPC ? "- [NPC]" : ""} ` + "\n*`HP:`*" + `${barraCustom(pObj.HP, pObj.stats?.hpMax ?? pObj.HP, 1)}`
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
                        "content": "# Ultimas acciones:"
                    },
                    {
                        "type": 10,
                        "content": `${context.logs ?? "*No se ha podido mostrar los ultimos logs*"}`
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
                                    "url": message?.gif || "https://images-ext-1.discordapp.net/external/W0kUJ62LujJJYsyGFkXskWpqRd6r7li8KolxmT8aBoE/https/c.tenor.com/L-9qPsfXVRsAAAAC/tenor.gif"
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# ⁍ Finalizado en la ronda **${sesion.ronda}**`
                    }
                ]
            }
        ]

        return json
    },

    endEspectadorNvsN(sesion, ganadores, perdedores, context, message, rewardsMap) {
        const statsLossers = `${perdedores.map(c => `-# **❧ ${barraCustom(c.HP, c.stats?.hpMax ?? c.HP, 1, 5)} (${parseFloat((100 * Math.max(0, c.HP) / (c.stats?.hpMax || 1)).toFixed(1))}%) | ${c.Nombre} (${etiquetaPoder(c, "LV")})`).join("\n\n")}`
        const statsWinners = `${ganadores.map(c => `-# **❧ ${barraCustom(c.HP, c.stats?.hpMax ?? c.HP, 1, 5)} (${parseFloat((100 * Math.max(0, c.HP) / (c.stats?.hpMax || 1)).toFixed(1))}%) | ${c.Nombre} (${etiquetaPoder(c, "LV")})`).join("\n\n")}`

        const json = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": `# ${message?.title || "¡El duelo ha finalizado!"}`
                    },
                    {
                        "type": 10,
                        "content": `-# ${message?.descr || context.messagesubTitle || "El combate terminó."}`
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
                                "url": `${ganadores[0].avatarURL ?? "https://i.pinimg.com/1200x/6c/50/e8/6c50e8fc7cc13cfc7bc4abb312282f15.jpg"}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `${statsWinners}`
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
                                "url": `${perdedores[0].avatarURL ?? "https://i.pinimg.com/736x/2c/28/1d/2c281dee4b5a459dd2054d9dfca41498.jpg"}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `${statsLossers}`
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
                        "content": "# Ultimas acciones:"
                    },
                    {
                        "type": 10,
                        "content": `${context.logs ?? "*No se ha podido mostrar los ultimos logs*"}`
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
                                    "url": message?.gif || "https://images-ext-1.discordapp.net/external/W0kUJ62LujJJYsyGFkXskWpqRd6r7li8KolxmT8aBoE/https/c.tenor.com/L-9qPsfXVRsAAAAC/tenor.gif"
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# ⁍ Finalizado en la ronda ${sesion.ronda}`
                    }
                ]
            }
        ]
        return json
    },

    endGameDuel(sesion, player, arrayWinners, arrayRivales, context, contextMessage, rewardsMap = null) {
        console.log("rewardsMap:", rewardsMap)
        const pObj = player || { Nombre: "Jugador", HP: 0, Mana: 0, stats: { hpMax: 100, manaMax: 100 }, avatarURL: "https://i.pinimg.com/736x/bc/30/6b/bc306bced5860828cf4f38273805a607.jpg" };
        const titleRivales = (arrayRivales && arrayRivales.length > 1) ? "Tus rivales" : "`Tu rival`"
        const messageDataRivales = (arrayRivales && arrayRivales.length > 1)
            ? arrayRivales.map(c => `**❧ ${c.Nombre} (${etiquetaPoder(c, "LV")})**:\n-# \`HP:\` ${barraCustom(c.HP, c.stats?.hpMax ?? c.HP, 1, 10)}`).join("\n\n")
            : ((arrayRivales && arrayRivales.length > 0)
                ? `**❧ ${arrayRivales[0].Nombre} (${etiquetaPoder(arrayRivales[0], "LV")})**:\n-# \`HP:\` ${barraCustom(arrayRivales[0].HP, arrayRivales[0].stats?.hpMax ?? arrayRivales[0].HP, 1, 10)}`
                : "Sin rivales");

        let recompensas = null;
        let esGanadorP = !!context?.isWinner;
        if (rewardsMap && rewardsMap.recompensas && rewardsMap.recompensas.size > 0) {
            let rData = null;
            for (const [key, val] of rewardsMap.recompensas.entries()) {
                if (String(key) === String(pObj.ID || pObj._id)) {
                    rData = val;
                    break;
                }
            }
            if (rData) {
                esGanadorP = !!rData.isWinner;
                const itemsList = [];
                if (rData.polvo) itemsList.push(`Polvo Estelar: +${rData.polvo}`);
                if (typeof rData.lumens !== 'undefined' && rData.lumens !== 0) {
                    if (esGanadorP) {
                        itemsList.push(`Lumens: +${Math.abs(rData.lumens)}`);
                    } else {
                        itemsList.push(`Lumens: -${Math.abs(rData.lumens)}`);
                    }
                }
                if (rData.objetos && rData.objetos.length > 0) {
                    rData.objetos.forEach(o => {
                        const cantAbs = Math.abs(o.cantidad);
                        const sign = esGanadorP ? "+" : "-";
                        itemsList.push(`${o.nombre} x ${sign}${cantAbs}`);
                    });
                }
                if (rData.avisoInventario) {
                    rData.avisoInventario.split(/\r?\n/).forEach(t => itemsList.push(`⟡ ${t}`));
                }
                if (rData.loot && rData.loot.length > 0) {
                    rData.loot.forEach(item => {
                        itemsList.push(`${item.itemId} (${item.calidad})`);
                    });
                }
                if (itemsList.length > 0) {
                    recompensas = itemsList;
                }
            }
        }

        const textoRecompensas = recompensas
            ? (Array.isArray(recompensas) ? recompensas.map(r => `- -# ${r}`).join('\n') : recompensas)
            : "";

        const tituloSeccion = esGanadorP ? "# Recompensas Ganadas ✨" : "# Recursos Perdidos 💔";

        const messageEnd = [
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
                                "url": pObj.avatarURL || "https://i.pinimg.com/736x/bc/30/6b/bc306bced5860828cf4f38273805a607.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${contextMessage?.title || "Duelo Finalizado"}`
                            },
                            {
                                "type": 10,
                                "content": `-# **${contextMessage?.descr || "El combate ha concluido."}**`
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
                        "content": `### **❧ ${pObj.Nombre} (${etiquetaPoder(pObj, "LV")}):**\n-# \`HP:\` ${barraCustom(pObj.HP, pObj.stats?.hpMax ?? pObj.HP, 1, 10)} \n-# \`Mana:\` ${barraCustom(pObj.Mana, pObj.stats?.manaMax ?? pObj.Mana, 2, 5)}\n-# \`Efectos activos:\` En construcción`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `### ${titleRivales}:\n${messageDataRivales}`
                    },
                    ...(recompensas ? [
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": tituloSeccion
                        },
                        {
                            "type": 10,
                            "content": textoRecompensas
                        }
                    ] : []),
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
                                    "url": `${contextMessage.gif}`
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# ⁍ Finalizado en la ronda ${sesion.ronda}`
                    }
                ]
            }
        ]

        return messageEnd
    },

    //Función de respaldo, no tiene utilidad de momento
    espectadorMensaje(sesion) {
        const json = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": "# ¡El duelo ha comenzado!"
                    },
                    {
                        "type": 10,
                        "content": "-# Turno Actual: <@!811049909099692073>"
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
                                "url": "https://i.pinimg.com/webp/736x/b3/7a/a2/b37aa2f2ca6a42ee9361dec10c5d423f.webp"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "### Equipo 1\n- -# [❤︎❤︎❤︎❤︎❤︎] (100/100) | Scaralette\n- -# [❤︎❤︎𖹭𖹭𖹭] (40/100) |  ShungeX\n- -# [❤︎❤︎❤︎❤︎❤︎] (100/100) | Anklager\n- -# [❤︎𖹭𖹭𖹭𖹭] (10/100) | Dyns"
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
                                "url": "https://i.pinimg.com/736x/f3/65/e9/f365e952d65a27d87827831a588bd0dc.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "### Equipo 2\n- -# [❤︎❤︎❤︎❤︎𖹭] (90/100) | Shuciika\n- -# [❤︎❤︎❤︎𖹭𖹭] (60/100) | Kaede\n- -# [❤︎❤︎❤︎❤︎❤︎] (100/100) | Myris\n- -# [----KO----] (10/100) | Navi"
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
                        "content": "# Ultimas acciones:"
                    },
                    {
                        "type": 10,
                        "content": "```ansi\n\u001b[2;34m- El duelo ha finalizado\n\u001b[2;31m- Dyns ha sucumbido... 💀\n\u001b[2;37m- \u001b[0m\u001b[2;31m\u001b[2;37m\u001b[2;30m\u001b[2;33mShungeX \u001b[0m\u001b[2;30m\u001b[0m\u001b[2;37m\u001b[0m\u001b[2;31m\u001b[2;30m\u001b[2;37mha recibido\u001b[0m\u001b[2;30m\u001b[0m\u001b[2;31m \u001b[2;33m\u001b[2;31m\u001b[2;31m\u001b[2;32m30 \u001b[0m\u001b[2;31m\u001b[0m\u001b[2;31m\u001b[2;37mde \u001b[2;32mdaño fisico\u001b[0m\u001b[2;37m\n- \u001b[2;33mShuciika \u001b[0m\u001b[2;37mha recibido \u001b[2;31m120\u001b[0m\u001b[2;37m de \u001b[2;31mdaño critico\n\u001b[2;32m\u001b[0m\u001b[2;31m\u001b[2;32m- ¡El duelo ha comenzado!\u001b[0m\u001b[2;31m\u001b[0m\u001b[2;37m\u001b[0m\u001b[2;31m\u001b[0m\u001b[2;33m\u001b[0m\u001b[2;31m\u001b[0m\u001b[2;34m\u001b[0m\u001b[2;34m\u001b[0m\n```"
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
                                    "url": "https://images-ext-1.discordapp.net/external/URzyk18Me5pff5ncaVmlsKRJ0F5N0S01IGcAiHsLIxQ/https/c.tenor.com/ZE1DnkL3qigAAAAd/tenor.gif"
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# ⁍ Finalizado en la ronda ${sesion.ronda}`
                    }
                ]
            }
        ]
    }
}