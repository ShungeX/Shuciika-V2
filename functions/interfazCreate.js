const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client } = require(`discord.js`)
const clientdb = require("../Server")
const db = clientdb.db("Server_db")
const userData = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const npcs = db2.collection("NPCs")
const habilidades = db2.collection("Hechizos_globales")
const cacheGlobal = require("../utils/cache")
const transaccionCache = cacheGlobal
const getXp = require("../functions/getXP")
const tokenManager = require('./Tokens/Ticket');
const PayloadBuilder = require('./Tokens/payloads');
const { crearCustomId } = require("../utils/constructores/customId")

class InterfazCreate {

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
            const serverLink = salaData.messageServer
                ? `https://discord.com/channels/${salaData.messageServer.guild}/${salaData.messageServer.channel}/${salaData.messageServer.message}`
                : (salaData.messageAutor
                    ? `https://discord.com/channels/@me/${salaData.messageAutor.channel}/${salaData.messageAutor.message}`
                    : null);

            const linkContent = serverLink ? `\n-# [Haz click aqui para ir al mensaje de la sala](${serverLink})` : '';

            mensajeGlobal[0].components.push({
                "type": 10,
                "content": "Tu personaje se encuentra dentro de una sala. Para poder realizar esta acción debes salirte." + linkContent
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
                        "content": `**${pj.Nombre} (${pj.isNPC ? `LV: ${pj.nivelMagico || 1}` : `FE: ${pj.StelarFragmentsTotal ?? pj.sendero?.StelarFragmentsTotal ?? 0} [${pj.resplandor ?? pj.sendero?.resplandor ?? 'I'}]`})**`
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

    async createComponentsTarget(duel, autor, accion, habilidad) {

        console.log(accion)

        if (habilidad) {
            habilidad = await habilidades.findOne({ _id: habilidad === "attack" ? autor.ataquePredeterminado : habilidad })

            if (!habilidad) {
                console.log("Habilidad no encontrada, retornando...")
                return null
            }
        }




        const esSingle = habilidad.Mecanicas.alcance.includes('Single') || habilidad.Mecanicas.alcance.includes('primer_objetivo');
        const esAoE = habilidad.Mecanicas.alcance.includes('AoE') || habilidad.Mecanicas.alcance.includes('All');
        const esRandom = habilidad.Mecanicas.alcance.includes('Random');

        const cuerpoMensaje = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 10,
                        "content": esSingle ? "# ¿Estas seguro de realizar la siguiente acción?" : "# Selecciona a un enemigo"
                    }
                ]
            }
        ]


        let potentialTargets = [];
        console.log("[InterfazCreate.js]-Autor:", autor.ID)
        const esEquipo1 = duel.equipo1.some(miembro => miembro.ID === autor.ID);

        if (habilidad.Mecanicas.objetivo.includes("enemigo")) {
            potentialTargets = esEquipo1 ? duel.equipo2 : duel.equipo1;
        } else if (habilidad.Mecanicas.objetivo.includes("aliados")) {
            const aliadosTotal = esEquipo1 ? duel.equipo1 : duel.equipo2;

            const aliadosSinMi = aliadosTotal.filter(p => p.ID !== autor.ID);
            potentialTargets.push(...aliadosSinMi);
        } else if (habilidad.Mecanicas.objetivo.includes("ambos")) {
            potentialTargets = duel.allCombatientes;
        }

        if (habilidad.Mecanicas.objetivo.includes('si_mismo') || habilidad.Mecanicas.objetivo.includes('self') || habilidad.Mecanicas.objetivo.includes('mismo')) {
            potentialTargets.push(autor);
        }

        const validTargets = potentialTargets.filter(target => {
            return !target.fueDerrotado() && !target.statusEffect.some(e => e.id === 'estasis');
        });

        if (esAoE || esRandom || esSingle || validTargets.length === 1) {
            let targetIdParam = 'all';

            if (esSingle && validTargets.length === 1) {
                targetIdParam = validTargets[0].ID; // O ownerId, lo que uses
            }

            const datosLanzarAccion = PayloadBuilder.duelToken(duel.id, autor.ID, accion, habilidad._id, targetIdParam)
            const idToken = tokenManager.create("DUEL", datosLanzarAccion)

            const confirmButton = {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": esAoE ? 4 : esSingle ? 1 : 3,
                        "label": esRandom ? "Lanzar aleatoriamente" : (esAoE ? "Lanzar a todos" : "Confirmar acción"),
                        "emoji": null,
                        "disabled": false,
                        "custom_id": `DuelAct-${autor.ownerId}-${idToken}-confirm`
                    },
                    {
                        "type": 2,
                        "style": 4,
                        "label": "Cancelar acción",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": `DuelAct-${autor.ownerId}-${idToken}-cancel`
                    }
                ]
            }

            cuerpoMensaje[0].components.push(confirmButton)

            return cuerpoMensaje
        }

        console.log(potentialTargets)
        console.log(validTargets)

        const selectOptions = {
            "type": 1,
            "components": [
                {
                    "type": 3,
                    "custom_id": "duelsAct",
                    "options": [],
                    "placeholder": "",
                    "min_values": 1,
                    "max_values": 1,
                    "disabled": false
                }
            ]
        }

        const textTarget = validTargets.map(target => {
            const labelNivel = target.isNPC ? `LV: ${target.nivelMagico || 1}` : `FE: ${target.StelarFragmentsTotal ?? target.sendero?.StelarFragmentsTotal ?? 0} [${target.resplandor ?? target.sendero?.resplandor ?? 'I'}]`;
            selectOptions.components[0].options.push({
                "label": `-# ${target.Nombre} (${labelNivel})`,
                "value": `${target.ID}`,
                "description": null,
                "emoji": null,
                "default": false
            })
            return `-# ${target.Nombre} (${labelNivel})`
        })
        cuerpoMensaje[0].components.push({
            "type": 10,
            "content": textTarget.join("\n")
        })

        cuerpoMensaje[0].components.push(selectOptions)

        console.log(cuerpoMensaje[0].components)

        return cuerpoMensaje
    }

    /**
     * Genera y edita el mensaje V2 de selección de subzonas dentro de una región de exploración.
     * @param {import('discord.js').Client} client 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {string} key - Clave de la zona
     * @param {Object} soul - Alma del personaje
     */
    async zonaMessage(client, interaction, key, soul) {
        const transaccionCache = require("../utils/cache");
        const clientdb = require("../Server");
        const db2 = clientdb.db("Rol_db");
        const regiones = db2.collection("Regiones");
        const configServer = require("../config");
        const { barrasDeEnergia, editarOMandarMensaje } = require("../utils/utilidadesTexto");

        const userCache = transaccionCache.getUser(interaction.user.id);
        const exploracionCache = transaccionCache.get(userCache?.explorarID);

        if (!exploracionCache) {
            return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", flags: ["Ephemeral"] });
        }

        if (exploracionCache.message?.id && interaction.message?.id && exploracionCache.message.id !== interaction.message.id) {
            return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", flags: ["Ephemeral"] });
        }

        const regionDoc = await regiones.findOne({ _id: exploracionCache.regionSelect });
        if (!regionDoc) {
            return interaction.reply({ content: "Al parecer ese lugar ya no aparece en el mapa...", flags: ["Ephemeral"] });
        }

        let zonaKey = key || exploracionCache.zona;
        let zonaSelect = regionDoc.areas?.[zonaKey];

        if (!zonaSelect && regionDoc.areas) {
            for (const [k, area] of Object.entries(regionDoc.areas)) {
                if (area.subzonas?.[zonaKey]) {
                    zonaSelect = area;
                    zonaKey = k;
                    break;
                }
            }
        }

        if (!zonaSelect) {
            return interaction.reply({ content: "Al parecer ese lugar ya no aparece en el mapa...", flags: ["Ephemeral"] });
        }

        exploracionCache.zona = zonaKey;
        const options = [];

        const components = [
            {
                "type": 10,
                "content": "# Sistema de exploración \n-# *Región Seleccionada:* `" + exploracionCache.regionNombre + "`" +
                    "\n-# *Zona Seleccionada:* `" + zonaSelect.Nombre + "`" +
                    `\n-# *Energía:*  ${barrasDeEnergia((soul?.nucleo?.energy ?? 0), configServer.maxEnergy)}` +
                    `\n-# *Nivel de profundidad:* ${exploracionCache.profundidad}`
            },
            {
                "type": 10,
                "content": "*¿Qué sub-zona vamos a explorar hoy?* ( •̀ ω •́ )y"
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 2
            }
        ];

        if (zonaSelect.subzonas && typeof zonaSelect.subzonas === 'object') {
            Object.keys(zonaSelect.subzonas).forEach(subKey => {
                const subzona = zonaSelect.subzonas[subKey];
                const isHabilitado = subzona.habilitado ? "`" + `(⚡${subzona.energiaNecesaria})` + "`" : "[Deshabilitado]";

                if (subzona.habilitado) {
                    options.push({
                        "label": `${subzona.nombre}`,
                        "value": `${subKey}`,
                        "description": `${subzona?.descripcion || ""}`,
                        "emoji": null,
                        "default": false
                    });

                    components.push({
                        "type": 10,
                        "content": `-# - **${subzona.nombre} ${isHabilitado}**`
                    });
                }
            });
        }

        components.push(
            {
                "type": 1,
                "components": [
                    {
                        "type": 3,
                        "custom_id": crearCustomId({
                            action: "selectExplorar",
                            userId: interaction.user.id,
                            characterId: null,
                            extras: ["subzona"]
                        }),
                        "options": options,
                        "placeholder": "Selecciona una opción...",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
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
                            "url": "https://i.pinimg.com/originals/b9/69/02/b96902ca778bdd612e49f137f71dfa28.gif"
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            },
            {
                "type": 10,
                "content": "-# Puedes actualizar tu energía con el botón de actualizar. (10 min > 1 punto de energía.)"
            }
        );

        const v2Exploracion = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": components
            }
        ];

        try {
            await interaction.deferUpdate().catch(() => { });
            let msg;
            try {
                msg = await interaction.channel.messages.fetch(exploracionCache.message.id);
            } catch (e) { }
            await editarOMandarMensaje(interaction, exploracionCache, msg, { components: v2Exploracion, flags: ["IsComponentsV2"] });
        } catch (error) {
            console.error("Error en zonaMessage [interfazCreate]:", error);
            return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", flags: ["Ephemeral"] }).catch(() => { });
        }
    }

    /**
     * 
     * @param {import('discord.js').Client} client  
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @param {string} key - Clave de la zona
     * @param {Object} soul - Alma del personaje
     */
    async faroExploración(client, interaction, key, soul, page = 1) {
        const dialogosFaroData = require("../data/dialogosExploracion/dialogosFaro.json");
        const randomDialogue = dialogosFaroData.dialogosFaro[Math.floor(Math.random() * dialogosFaroData.dialogosFaro.length)];

        const charId = soul?._id ?? soul?.id ?? soul?.ID;
        const pj = await characters.findOne({
            $or: [
                { _id: charId },
                { _id: Number(charId) }
            ]
        });

        const rawTalismanInv = pj?.economia?.inventarioTalisman || [];
        const talismanInv = [...rawTalismanInv].sort((a, b) => Number(a.ID) - Number(b.ID));

        const itemsPorPagina = 12;
        const totalItems = talismanInv.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
        const currentPagina = Math.max(1, Math.min(page, totalPages));

        const startIndex = (currentPagina - 1) * itemsPorPagina;
        const itemsPagina = talismanInv.slice(startIndex, startIndex + itemsPorPagina);

        const talismanText = itemsPagina.length > 0
            ? itemsPagina.map(i => {
                const cant = Number(i.Cantidad || i.cantidad || 1);
                const nombre = i.Nombre || (`Objeto [${i.ID}]`);
                const formattedId = String(i.ID).padStart(3, ' ');
                const contaminado = i.contaminable ? " *(Contaminado)*" : "";
                return `- -# \`[${formattedId}]\` - **${nombre}** x ${cant}${contaminado}`;
            }).join("\n")
            : "- -# *El talismán está vacío (sin objetos resguardados).*";

        const userCache = transaccionCache.getUser(interaction.user.id);
        const exploracionCache = userCache ? transaccionCache.get(userCache.explorarID) : null;

        const base = 1.6;
        const profundidad = Math.max(1, exploracionCache?.profundidad || 1);
        const { getObjetoPorId } = require("./catalogoObjetos");

        const getRarezaMult = (rarezaStr) => {
            const r = String(rarezaStr || "").toLowerCase().trim();
            // Rarezas iguales o superiores a Luminoso se topan al multiplicador de Luminoso (1.4)
            if (
                r.includes("luminoso") ||
                r.includes("arcano") ||
                r.includes("divino") ||
                r.includes("nix") ||
                r.includes("legendario") ||
                r.includes("mitico") ||
                r.includes("mítico") ||
                r.includes("etereo") ||
                r.includes("etéreo") ||
                r.includes("singular")
            ) {
                return 1.4;
            }
            if (r.includes("resonante") || r.includes("raro") || r.includes("inusual")) {
                return 1.2;
            }
            return 1.0;
        };

        let costoPurificacionTotal = 0;
        if (rawTalismanInv.length > 0) {
            for (const item of rawTalismanInv) {
                const cant = Number(item.Cantidad || item.cantidad || 1);
                let rareza = item.Rareza || item.rareza;
                if (!rareza) {
                    const objDef = getObjetoPorId(item.Region, item.ID);
                    rareza = objDef?.Rareza || objDef?.rareza;
                }
                const mult = getRarezaMult(rareza);
                const itemCosto = base * Math.pow(mult, profundidad) * cant;
                costoPurificacionTotal += itemCosto;
            }
        }

        const costoPurificacion = Math.round(costoPurificacionTotal);

        const mensajeFaro = [
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
                                "url": "https://i.pinimg.com/1200x/9e/eb/e7/9eebe7bb35bf35b2921ddda249dd1b8e.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "### Faro de sintonía"
                            },
                            {
                                "type": 10,
                                "content": `*${randomDialogue}*`
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
                        "content": `**Objetos en el Talismán: ** \n${talismanText} `
                    },
                    {
                        "type": 10,
                        "content": `-# Tienes un total de ${totalItems} objetos | Pagina ${currentPagina}/${totalPages}\n-# **Costo de purificación: ${costoPurificacion} :lumens:**`
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    }
                ]
            }
        ];

        if (totalPages > 1) {
            mensajeFaro[0].components.push({
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 2,
                        "label": "<",
                        "emoji": null,
                        "disabled": currentPagina <= 1,
                        "custom_id": crearCustomId({
                            action: "mochilaInventario",
                            userId: interaction.user.id,
                            characterId: pj?._id || charId,
                            extras: [key || "faro", "talisman", "prev", currentPagina]
                        })
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": ">",
                        "emoji": null,
                        "disabled": currentPagina >= totalPages,
                        "custom_id": crearCustomId({
                            action: "mochilaInventario",
                            userId: interaction.user.id,
                            characterId: pj?._id || charId,
                            extras: [key || "faro", "talisman", "next", currentPagina]
                        })
                    }
                ]
            });
        }

        mensajeFaro[0].components.push({
            "type": 1,
            "components": [
                {
                    "type": 3,
                    "custom_id": `selectExplorar-${interaction.user.id}`,
                    "options": [
                        {
                            "label": "Abrir mochila",
                            "value": `null*mochila*${key}`,
                            "description": "Revisa y organiza lo que llevas contigo",
                            "emoji": null,
                            "default": false
                        },
                        {
                            "label": "Purificar objetos",
                            "value": `null*purificar*${key}`,
                            "description": "Purifica y permite guardar los objetos de tu talismán",
                            "emoji": null,
                            "default": false
                        },
                        {
                            "label": "Seguir explorando",
                            "value": `null*continue*${key}`,
                            "description": "Avanza hacia la siguiente área o evento",
                            "emoji": { "name": "CirnoFumoWalking1", "id": "1350682005691699220" },
                            "default": false
                        },
                        {
                            "label": "Dejar de explorar",
                            "value": `null*surrend*${key}`,
                            "description": "Termina la expedición y regresa a salvo",
                            "emoji": { "name": "TuxedoSamTired", "id": "1350682023370555454" },
                            "default": false
                        }
                    ],
                    "placeholder": "Selecciona una opción",
                    "min_values": 1,
                    "max_values": 1,
                    "disabled": false
                }
            ]
        });

        return mensajeFaro;
    }

    async purificarConfirmacion(client, interaction, key, soul, page = 1) {
        const userCache = transaccionCache.getUser(interaction.user.id);
        const exploracionCache = userCache ? transaccionCache.get(userCache.explorarID) : null;

        const charId = soul?._id ?? soul?.id ?? soul?.ID;
        const pj = await characters.findOne({
            $or: [
                { _id: charId },
                { _id: Number(charId) }
            ]
        });

        const rawTalismanInv = pj?.economia?.inventarioTalisman || [];
        const talismanInv = [...rawTalismanInv].sort((a, b) => Number(a.ID) - Number(b.ID));

        const base = 1.6;
        const profundidad = Math.max(1, exploracionCache?.profundidad || 1);
        const { getObjetoPorId } = require("./catalogoObjetos");

        const getRarezaMult = (rarezaStr) => {
            const r = String(rarezaStr || "").toLowerCase().trim();
            if (
                r.includes("luminoso") ||
                r.includes("arcano") ||
                r.includes("divino") ||
                r.includes("nix") ||
                r.includes("legendario") ||
                r.includes("mitico") ||
                r.includes("mítico") ||
                r.includes("etereo") ||
                r.includes("etéreo") ||
                r.includes("singular")
            ) {
                return 1.4;
            }
            if (r.includes("resonante") || r.includes("raro") || r.includes("inusual")) {
                return 1.2;
            }
            return 1.0;
        };

        let costoPurificacionTotal = 0;
        if (rawTalismanInv.length > 0) {
            for (const item of rawTalismanInv) {
                const cant = Number(item.Cantidad || item.cantidad || 1);
                let rareza = item.Rareza || item.rareza;
                if (!rareza) {
                    const objDef = getObjetoPorId(item.Region, item.ID);
                    rareza = objDef?.Rareza || objDef?.rareza;
                }
                const mult = getRarezaMult(rareza);
                costoPurificacionTotal += base * Math.pow(mult, profundidad) * cant;
            }
        }

        const costo = Math.round(costoPurificacionTotal);
        const currentLumens = Number(pj?.economia?.Lumens ?? 0);
        const canAfford = currentLumens >= costo && rawTalismanInv.length > 0;
        const lumensFinales = currentLumens - costo;

        const talismanText = talismanInv.length > 0
            ? talismanInv.map(i => {
                const cant = Number(i.Cantidad || i.cantidad || 1);
                const nombre = i.Nombre || (`Objeto [${i.ID}]`);
                const formattedId = String(i.ID).padStart(3, ' ');
                const contaminado = i.contaminable ? " *(Contaminado)*" : "";
                return `- -# \`[${formattedId}]\` - **${nombre}** x ${cant}${contaminado}`;
            }).join("\n")
            : "- -# *El talismán está vacío (sin objetos para purificar).*";

        const cleanKey = String(key || exploracionCache?.subzona || "zone").replace(/\*faro$/, '');

        const jsonPurificar = [
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
                                "url": "https://i.pinimg.com/1200x/9e/eb/e7/9eebe7bb35bf35b2921ddda249dd1b8e.jpg",
                                "proxy_url": "https://i.pinimg.com/1200x/9e/eb/e7/9eebe7bb35bf35b2921ddda249dd1b8e.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Confirmar acción"
                            },
                            {
                                "type": 10,
                                "content": "*Estás a punto de purificar los siguientes objetos:*"
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
                        "content": talismanText
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": `### *Desglose final:* \n-# **Tus Lumens:** ${currentLumens} :lumens:\n-# **Costo total:** ${costo} :lumens:\n-# **Lumens finales:** ${canAfford ? lumensFinales : "Insuficientes"} :lumens:`
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 3,
                                "label": "Confirmar acción",
                                "emoji": null,
                                "disabled": !canAfford,
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: interaction.user.id,
                                    characterId: pj?._id || charId,
                                    extras: ["purificar", "confirmar", cleanKey]
                                })
                            },
                            {
                                "type": 2,
                                "style": 4,
                                "label": "Cancelar acción",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: interaction.user.id,
                                    characterId: pj?._id || charId,
                                    extras: ["purificar", "cancelar", cleanKey]
                                })
                            }
                        ]
                    }
                ]
            }
        ];

        return jsonPurificar;
    }

    async mochilaExploración(client, interaction, key, soul, page = 1, isFaroParam = false) {
        const userCache = transaccionCache.getUser(interaction.user.id);
        const exploracionCache = userCache ? transaccionCache.get(userCache.explorarID) : null;
        const isFaro = Boolean(isFaroParam || exploracionCache?.enFaro || String(key).includes("faro"));
        const cleanKey = String(key || exploracionCache?.subzona || "zone").replace(/\*faro$/, '');

        const charId = soul?._id ?? soul?.id ?? soul?.ID;
        const pj = await characters.findOne({
            $or: [
                { _id: charId },
                { _id: Number(charId) }
            ]
        });

        const equipoList = soul?.equipo || soul?.dominio?.equipo || pj?.equipo || pj?.dominio?.equipo || [];
        const mochilaEquipada = equipoList.find(i => String(i.Type || i.tipo || '').toLowerCase() === "mochila");
        let capacidadMax = 0;
        let mochilaName = null;

        if (mochilaEquipada) {
            const dbobjetos = db2.collection("Objetos_globales");
            const mochilaIdNum = Number(mochilaEquipada.ID);
            const objDoc = await dbobjetos.findOne({ "Objetos.ID": mochilaIdNum });
            const itemDef = objDoc?.Objetos?.find(o => Number(o.ID) === mochilaIdNum);
            capacidadMax = itemDef?.atributos?.capacidad ?? 20;
            mochilaName = itemDef?.Nombre || itemDef?.nombre || `Mochila [${mochilaEquipada.ID}]`;
        }

        const rawMochila = pj?.economia?.Mochila || [];
        rawMochila.sort((a, b) => Number(a.ID) - Number(b.ID));

        let pesoActual = 0;
        rawMochila.forEach(item => {
            const cant = Number(item.Cantidad || item.cantidad || 1);
            const pesoUnid = Number(item.atributos?.peso ?? 1);
            pesoActual += cant * pesoUnid;
        });

        const itemsPorPagina = 10;
        const totalItems = rawMochila.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
        const currentPagina = Math.max(1, Math.min(page, totalPages));

        const startIndex = (currentPagina - 1) * itemsPorPagina;
        const itemsPagina = rawMochila.slice(startIndex, startIndex + itemsPorPagina);

        const contenidoTexto = itemsPagina.length > 0
            ? itemsPagina.map(item => {
                const cant = Number(item.Cantidad || item.cantidad || 1);
                const pesoUnid = Number(item.atributos?.peso ?? 1);
                const formattedId = String(item.ID).padStart(3, ' ');
                return `- -# \`[${formattedId}]\` **${item.Nombre || ('Objeto ' + item.ID)}** x${cant} *(Peso: ${pesoUnid * cant})*`;
            }).join("\n")
            : "-# *Tu mochila no contiene ningún objeto por ahora.*";

        const infoMochilaTexto = mochilaEquipada
            ? `-# **Mochila equipada:** \`[${String(mochilaEquipada.ID).padStart(3, ' ')}]\` ${mochilaName}\n-# **Capacidad:** *${pesoActual}/${capacidadMax}*\n\n-# Puedes mejorar la capacidad de la mochila comprando una de mejor calidad dentro de la tienda o consiguiéndola en exploraciones y eventos (✿◡‿◡)`
            : `-# ⚠️ *No tienes una mochila equipada.*\n-# **Capacidad:** *0/0*\n\n-# Necesitas equipar un objeto de tipo "mochila" para poder transportar objetos durante tus exploraciones.`;

        const centralButton = isFaro ? {
            "type": 2,
            "style": 2,
            "label": "Cerrar mochila",
            "emoji": null,
            "disabled": false,
            "custom_id": crearCustomId({
                action: "exOp",
                userId: interaction.user.id,
                characterId: soul._id,
                extras: ["mochila", `cerrarFaro*${cleanKey}`]
            })
        } : {
            "type": 2,
            "style": 3,
            "label": "Comenzar exploración",
            "emoji": null,
            "disabled": false,
            "custom_id": crearCustomId({
                action: "exOp",
                userId: interaction.user.id,
                characterId: soul._id,
                extras: ["mochila", `confirmar*${cleanKey}`]
            })
        };

        const mensajeMochila = [
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
                                "url": "https://i.pinimg.com/1200x/9a/ad/4d/9aad4d0ed76d36438c5771b2f4865cc9.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Tu mochila"
                            },
                            {
                                "type": 10,
                                "content": infoMochilaTexto
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
                            "type": 2,
                            "style": 2,
                            "label": "Añadir objetos",
                            "emoji": null,
                            "disabled": !mochilaEquipada,
                            "custom_id": crearCustomId({
                                action: "exOp",
                                userId: interaction.user.id,
                                characterId: soul._id,
                                extras: ["mochila", isFaro ? `añadirObjetos*${cleanKey}*faro` : `añadirObjetos*${cleanKey}`]
                            })
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `**Contenido:** \n${contenidoTexto}`
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# Página: ${currentPagina}/${totalPages}`
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": crearCustomId({
                                    action: "mochilaRemoveSelect",
                                    userId: interaction.user.id,
                                    characterId: pj?._id || charId,
                                    extras: [cleanKey, isFaro ? "faro" : "start"]
                                }),
                                "options": itemsPagina.length > 0 ? itemsPagina.map(item => ({
                                    "label": `[${String(item.ID).padStart(3, ' ')}] ${item.Nombre || ('Objeto ' + item.ID)} (x${item.Cantidad || 1})`,
                                    "value": `${item.ID}*${item.Region || 'Global'}`,
                                    "description": `Peso unid: ${item.atributos?.peso || 1}`,
                                    "emoji": null,
                                    "default": false
                                })) : [
                                    {
                                        "label": "Mochila vacía",
                                        "value": "none*none",
                                        "description": null,
                                        "emoji": null,
                                        "default": false
                                    }
                                ],
                                "placeholder": "Eliminar objeto...",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": itemsPagina.length === 0
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
                                "disabled": currentPagina <= 1,
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: interaction.user.id,
                                    characterId: soul._id,
                                    extras: ["mochila", isFaro ? `prev*${currentPagina}*${cleanKey}*faro` : `prev*${currentPagina}*${cleanKey}`]
                                })
                            },
                            centralButton,
                            {
                                "type": 2,
                                "style": 2,
                                "label": ">",
                                "emoji": null,
                                "disabled": currentPagina >= totalPages,
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: interaction.user.id,
                                    characterId: soul._id,
                                    extras: ["mochila", isFaro ? `next*${currentPagina}*${cleanKey}*faro` : `next*${currentPagina}*${cleanKey}`]
                                })
                            }
                        ]
                    }
                ]
            }
        ];

        return mensajeMochila;
    }

    async mochilaInventarioMensaje(client, interaction, character, page = 1, key = "", filtros = ["fullbag"], isFaroParam = false) {
        const userCache = transaccionCache.getUser(interaction.user.id);
        const exploracionCache = userCache ? transaccionCache.get(userCache.explorarID) : null;
        const isFaro = Boolean(isFaroParam || exploracionCache?.enFaro || String(key).includes("faro"));
        const cleanKey = String(key || exploracionCache?.subzona || "zone").replace(/\*faro$/, '');

        const ctxOverrides = {
            action: "mochilaInventario",
            baseExtras: [cleanKey, isFaro ? "faro" : "normal"]
        };
        const baseComponents = this.inventarioMensaje(interaction, character, page, filtros, ctxOverrides);
        const mainContainer = baseComponents[0];
        const inventarioRaw = character?.economia?.Inventario || character?.Inventario || [];

        const rowBotonCerrar = {
            "type": 1,
            "components": [
                {
                    "type": 2,
                    "style": 4,
                    "label": "Cerrar inventario",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": crearCustomId({
                        action: "exOp",
                        userId: interaction.user.id,
                        characterId: character._id,
                        extras: ["mochila", isFaro ? `cerrarInventario*${cleanKey}*faro` : `cerrarInventario*${cleanKey}`]
                    })
                }
            ]
        };

        const sortedInv = [...inventarioRaw].sort((a, b) => Number(a.ID) - Number(b.ID));
        const optionsSelect = sortedInv.slice(0, 25).map(item => ({
            "label": `[${String(item.ID).padStart(3, ' ')}] ${item.Nombre || ('Objeto ' + item.ID)} (x${item.Cantidad || 1})`,
            "value": `${item.ID}*${item.Region || 'Global'}`,
            "description": `Peso unid: ${item.atributos?.peso || 1}`,
            "emoji": null,
            "default": false
        }));

        const selectCustomId = crearCustomId({
            action: "mochilaAddSelect",
            userId: interaction.user.id,
            characterId: character._id,
            extras: [cleanKey, isFaro ? "faro" : "normal"]
        });

        const rowSelect = {
            "type": 1,
            "components": [
                {
                    "type": 3,
                    "custom_id": selectCustomId,
                    "options": optionsSelect.length > 0 ? optionsSelect : [
                        {
                            "label": "Sin objetos en inventario",
                            "value": "none*none",
                            "description": null,
                            "emoji": null,
                            "default": false
                        }
                    ],
                    "placeholder": "Selecciona un objeto para meter a la mochila...",
                    "min_values": 1,
                    "max_values": 1,
                    "disabled": optionsSelect.length === 0
                }
            ]
        };

        mainContainer.components.push(rowSelect, rowBotonCerrar);
        return baseComponents;
    }

    filtrarInventario(rawInventario, filtros) {
        const normalize = (str) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const esFullbag = !filtros || !filtros.length || filtros.includes("fullbag");
        if (esFullbag) return rawInventario;

        const categoryMap = {
            consumibles: ['consumibles', 'consumible', 'bebible', 'comestible', 'alimento', 'unguento'],
            equipamiento: ['equipamiento', 'equipo', 'artefacto'],
            herramientas: ['herramientas', 'herramienta'],
            compañeros: ['compañeros', 'companeros', 'huevo', 'mascota'],
            materiales: ['materiales', 'polvo', 'miscelaneo', 'miscelanea', 'otro'],
            social: ['social', 'regalo', 'pergamino'],
            lore: ['lore'],
            coleccionables: ['coleccionables', 'coleccionable'],
            mision: ['mision', 'misión']
        };

        const activeFiltros = Array.isArray(filtros) ? filtros : [filtros];
        const allowedTypes = new Set();
        activeFiltros.forEach(f => {
            const normF = normalize(f);
            allowedTypes.add(normF);
            if (categoryMap[normF]) {
                categoryMap[normF].forEach(sub => allowedTypes.add(normalize(sub)));
            }
        });

        return rawInventario.filter(item => {
            if (!item.Tipo) return false;
            const itemTypes = Array.isArray(item.Tipo)
                ? item.Tipo.map(t => normalize(t))
                : [normalize(item.Tipo)];
            return itemTypes.some(t => allowedTypes.has(t));
        });
    }

    inventarioMensaje(interaction, character, pageOrTotal = 1, filtrosParam = ["fullbag"], ctxOverrides = null) {
        let pagina = 1;
        let filtros = ["fullbag"];

        if (typeof pageOrTotal === 'number') {
            pagina = pageOrTotal;
            if (Array.isArray(filtrosParam)) {
                filtros = filtrosParam;
            } else if (typeof filtrosParam === 'string') {
                filtros = [filtrosParam];
            }
        } else if (typeof arguments[3] === 'number') {
            pagina = arguments[3];
            filtros = Array.isArray(arguments[4]) ? arguments[4] : (typeof arguments[4] === 'string' ? [arguments[4]] : ["fullbag"]);
        }

        // ctxOverrides: { action, baseExtras } — permite que mochilaInventarioMensaje inyecte su acción propia
        const ctxAction = ctxOverrides?.action || "inventario";
        const ctxBase = ctxOverrides?.baseExtras || [];

        const rawInventario = character.economia?.Inventario || character.Inventario || [];

        const esFullbag = !filtros.length || filtros.includes("fullbag");
        const activeFiltros = esFullbag ? ["fullbag"] : filtros;

        const inventarioFiltrado = this.filtrarInventario(rawInventario, activeFiltros);
        inventarioFiltrado.sort((a, b) => Number(a.ID) - Number(b.ID));

        const itemsPorPagina = 10;
        const totalItems = inventarioFiltrado.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPorPagina));

        let currentPagina = Math.max(1, Math.min(pagina, totalPages));

        const startIndex = (currentPagina - 1) * itemsPorPagina;
        const itemsPagina = inventarioFiltrado.slice(startIndex, startIndex + itemsPorPagina);

        const itemsContent = itemsPagina.length > 0
            ? itemsPagina.map(item => {
                const formattedId = String(item.ID).padStart(3, ' ');
                return `- -# \`[${formattedId}]\` - **${item.Nombre}** x ${item.Cantidad}`;
            }).join("\n")
            : "- -# *No tienes objetos con este filtro.*";

        const filterMap = {
            fullbag: "Mochila completa",
            consumibles: "Consumibles",
            compañeros: "Compañeros",
            equipamiento: "Equipamiento",
            herramientas: "Herramientas",
            materiales: "Materiales",
            lore: "Lore",
            mision: "Misión",
            coleccionables: "Coleccionables"
        };

        const filtrosTexto = activeFiltros.map(f => filterMap[f] || f).join(", ");
        const filtrosJoined = activeFiltros.join("_");

        return [
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
                                "url": "https://i.pinimg.com/736x/65/20/7a/65207a6c33da94bae389d05dae46715f.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# Inventario de ${character.Nombre || 'Personaje'}`
                            },
                            {
                                "type": 10,
                                "content": "-# Consume un item con /usar\n-# Compra nuevos items con /tienda\n\n**Un espacio que no está aquí ni en ninguna otra parte.**"
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
                        "content": itemsContent
                    },
                    {
                        "type": 10,
                        "content": `-# Tienes un total de ${totalItems} objetos | Pagina ${currentPagina}/${totalPages}\n-# Filtros aplicados: ${filtrosTexto}`
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
                                "style": 2,
                                "label": "<",
                                "emoji": null,
                                "disabled": currentPagina <= 1,
                                "custom_id": crearCustomId({
                                    action: ctxAction,
                                    userId: interaction.user.id,
                                    characterId: character._id,
                                    extras: [...ctxBase, "prev", currentPagina, filtrosJoined]
                                })
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": "Saltar pag.",
                                "emoji": null,
                                "disabled": totalPages <= 1,
                                "custom_id": crearCustomId({
                                    action: ctxAction,
                                    userId: interaction.user.id,
                                    characterId: character._id,
                                    extras: [...ctxBase, "jump", currentPagina, filtrosJoined]
                                })
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": ">",
                                "emoji": null,
                                "disabled": currentPagina >= totalPages,
                                "custom_id": crearCustomId({
                                    action: ctxAction,
                                    userId: interaction.user.id,
                                    characterId: character._id,
                                    extras: [...ctxBase, "next", currentPagina, filtrosJoined]
                                })
                            }
                        ]
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": crearCustomId({
                                    "action": ctxAction,
                                    "userId": interaction.user.id,
                                    "characterId": character._id,
                                    "extras": [...ctxBase, "filter", currentPagina, filtrosJoined]
                                }),
                                "options": [
                                    {
                                        "label": "Mochila completa",
                                        "value": "fullbag",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("fullbag")
                                    },
                                    {
                                        "label": "Consumibles",
                                        "value": "consumibles",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("consumibles")
                                    },
                                    {
                                        "label": "Compañeros",
                                        "value": "compañeros",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("compañeros")
                                    },
                                    {
                                        "label": "Equipamiento",
                                        "value": "equipamiento",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("equipamiento")
                                    },
                                    {
                                        "label": "Herramientas",
                                        "value": "herramientas",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("herramientas")
                                    },
                                    {
                                        "label": "Materiales",
                                        "value": "materiales",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("materiales")
                                    },
                                    {
                                        "label": "Lore",
                                        "value": "lore",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("lore")
                                    },
                                    {
                                        "label": "Misión",
                                        "value": "mision",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("mision")
                                    },
                                    {
                                        "label": "Coleccionables",
                                        "value": "coleccionables",
                                        "description": null,
                                        "emoji": null,
                                        "default": activeFiltros.includes("coleccionables")
                                    }
                                ],
                                "placeholder": "Selecciona un filtro",
                                "min_values": 1,
                                "max_values": 4,
                                "disabled": false
                            }
                        ]
                    }
                ]
            }
        ]
    }
}

module.exports = new InterfazCreate()
