const clientdb = require("../../Server");
const db2 = clientdb.db("Rol_db");
const NPCs = db2.collection("NPCs");
const characterCol = db2.collection("Personajes");
const souls = db2.collection("Soul");
const regiones = db2.collection("Regiones");
const configServer = require("../../config");
const transaccionCache = require("../../utils/cache");
const util = require("util");
const updateInventario = require("../updateInventario");
const interfazCreate = require("../interfazCreate");
const { getEscapeP } = require("./escape");
const { barrasDeEnergia, editarOMandarMensaje } = require("../../utils/utilidadesTexto");
const { recargarEnergia } = require("../dataCharacters");
const getGifs = require("../getGifs");
const { crearCustomId } = require("../../utils/constructores/customId");
const sleep = util.promisify(setTimeout);

class ExploracionManager {
    constructor() {
        this.obtenerSubzona = this.obtenerSubzona.bind(this);
        this.ejecutarAccionExploracion = this.ejecutarAccionExploracion.bind(this);
        this.procesarExploracion = this.procesarExploracion.bind(this);
        this.procesarEventoSwitch = this.procesarEventoSwitch.bind(this);
        this.selectEvent = this.selectEvent.bind(this);
        this.getRewardsLoot = this.getRewardsLoot.bind(this);
        this.selectEnemy = this.selectEnemy.bind(this);
        this.getObjInfo = this.getObjInfo.bind(this);
        this.getRandomCantidad = this.getRandomCantidad.bind(this);
        this.calcularAmenaza = this.calcularAmenaza.bind(this);
        this.getRandomMessage = this.getRandomMessage.bind(this);
        this.generateMessage = this.generateMessage.bind(this);
        this.statusBarra = this.statusBarra.bind(this);
    }

    async obtenerSubzona(exploracionCache, areaSelect) {
        if (!areaSelect) return null;
        const region = await regiones.findOne({ _id: exploracionCache.regionSelect });
        if (!region || !region.areas) return null;

        const subzona = region.areas[exploracionCache.zona]?.subzonas?.[areaSelect];
        if (subzona) return subzona;

        for (const area of Object.values(region.areas)) {
            if (area.subzonas?.[areaSelect]) return area.subzonas[areaSelect];
        }

        return null;
    }

    async ejecutarAccionExploracion({ client, interaction, character, soul, areaSelect, interact }) {
        const userCache = transaccionCache.getUser(interaction.user.id);
        const exploracionCache = transaccionCache.get(userCache?.explorarID);
        if (!exploracionCache || !exploracionCache?.regionSelect || !exploracionCache?.zona) {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true });
            }
            return;
        }

        if (exploracionCache.message?.id && interaction.message?.id && exploracionCache.message.id !== interaction.message.id) {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", ephemeral: true });
            }
            return;
        }

        const targetArea = exploracionCache.subzona || areaSelect;
        const subzonaSelect = await this.obtenerSubzona(exploracionCache, targetArea);
        if (targetArea) {
            exploracionCache.subzona = targetArea;
        }

        let message = null;
        if (interaction.channel && exploracionCache.message?.id) {
            message = await interaction.channel.messages.fetch(exploracionCache.message.id).catch(() => null);
        }

        switch (interact) {
            case "surrend": {
                const messages = [
                    "La sabiduría no está solo en buscar, sino en saber cuándo descansar.",
                    "Usa `/rol explorar` cuando estés listo para otra aventura",
                    "El aire vibra con un susurro ancestral...\n Has decidido regresar"
                ];
                const messageSelect = messages[Math.floor(Math.random() * messages.length)];
                const gifSelect = await getGifs("sleep");

                const sleepMessage = [
                    {
                        "type": 10,
                        "content": "# Has decidido descansar..."
                    },
                    {
                        "type": 10,
                        "content": `${messageSelect}`
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
                                    "url": gifSelect.url
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": `-# Anime: ${gifSelect.anime_name}`
                    }
                ];

                const messageFinish = await this.generateMessage(exploracionCache, soul, subzonaSelect, sleepMessage, true);

                const cacheId = userCache?.explorarID || exploracionCache?.id;
                if (cacheId) transaccionCache.delete(cacheId);
                transaccionCache.deleteUser(interaction.user.id);

                return await editarOMandarMensaje(interaction, exploracionCache, message, { components: messageFinish, flags: ["IsComponentsV2"] });
            }

            case "cambiarZona": {
                return await interfazCreate.zonaMessage(client, interaction, exploracionCache.zona, soul);
            }

            case "subzona": {

                exploracionCache.subzona = targetArea
                const mochilaComp = await interfazCreate.mochilaExploración(client, interaction, exploracionCache.subzona, soul);
                try {
                    const subzonaSelect = await this.obtenerSubzona(exploracionCache, targetArea);
                    const faroEvent = subzonaSelect?.eventos?.find(x => x.tipo === "faro");
                    exploracionCache.faroProbabilidad = faroEvent?.probabilidad || 0;
                } catch (error) {
                    console.log(error);
                }

                try {
                    await interaction.deferUpdate().catch(() => { });
                } catch (e) { }
                return await editarOMandarMensaje(interaction, exploracionCache, message, { components: mochilaComp, flags: ["IsComponentsV2"] });
            }

            default: {
                return await this.procesarExploracion({
                    client,
                    interaction,
                    character,
                    soul,
                    areaSelect: targetArea,
                    interact,
                    userCache,
                    exploracionCache,
                    subzonaSelect,
                    message
                });
            }
        }
    }

    async procesarExploracion({ client, interaction, character, soul, areaSelect, interact, userCache, exploracionCache, subzonaSelect, message }) {
        try {
            if (!subzonaSelect) {
                subzonaSelect = await this.obtenerSubzona(exploracionCache, areaSelect);
            }

            console.log(areaSelect, interact)
            const currentEnergy = await recargarEnergia(soul.nucleo?.energy ?? 0, soul);
            if (currentEnergy < subzonaSelect.energiaNecesaria) {
                if(interaction.deferred) {
                 return interaction.followUp({ content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energía antes de explorar esta área", flags: ["Ephemeral"] })   
                }
                return interaction.reply({ content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energía antes de explorar esta área", flags: ["Ephemeral"] });
            }

            const faroBase = exploracionCache?.faroProbabilidad || 0

            let faroProb = null;

            if (exploracionCache.bloquearFaroSiguiente) {
                faroProb = 0;
                exploracionCache.bloquearFaroSiguiente = false;
            } else {
                const profundidadActual = exploracionCache.profundidad || 0;
                faroProb = Math.min(60, faroBase + profundidadActual);
            }

            const eventSelect = await this.selectEvent(subzonaSelect.eventos, faroProb);

            const gifsWalking = [
                "https://c.tenor.com/2CjD23b-uaoAAAAd/tenor.gif",
                "https://c.tenor.com/_T647uuuA-IAAAAd/tenor.gif",
                "https://c.tenor.com/-w46p_udURUAAAAd/tenor.gif",
                "https://c.tenor.com/5lskg5Utj1QAAAAd/tenor.gif",
                "https://c.tenor.com/kXniRU4h1AMAAAAd/tenor.gif",
                "https://c.tenor.com/mPCZyTJgrkAAAAAd/tenor.gif",
                "https://c.tenor.com/Bvm6RAQnf2wAAAAd/tenor.gif"
            ];

            const gifSelect = gifsWalking[Math.floor(Math.random() * gifsWalking.length)];
            const messageIntermedio = exploracionCache?.profundidad === 1 ?
                `Vuelves a tomar tus cosas y sigues explorando en **${subzonaSelect.nombre}...**` :
                `Tomas tus cosas y te preparas para explorar **${subzonaSelect.nombre}**\n ¿Que cosas encontraras hoy?`;

            const messIntermedio = [
                {
                    "type": 10,
                    "content": messageIntermedio
                },
                {
                    "type": 12,
                    "items": [
                        {
                            "media": {
                                "url": gifSelect
                            },
                            "description": null,
                            "spoiler": false
                        }
                    ]
                }
            ];

            const nuevaEnergia = Math.max(0, currentEnergy - subzonaSelect.energiaNecesaria);
            if (soul.nucleo) soul.nucleo.energy = nuevaEnergia;

            let eventMessageIntermedio = await this.generateMessage(exploracionCache,soul, subzonaSelect, messIntermedio, true);

            try {
                await interaction.deferUpdate().catch(() => { });
            } catch (e) { }

            await editarOMandarMensaje(interaction, exploracionCache, message, { components: eventMessageIntermedio, flags: ["IsComponentsV2"] });

            const eventMessage = await this.procesarEventoSwitch({
                eventSelect,
                subzonaSelect,
                soul,
                areaSelect,
                client,
                interaction,
                exploracionCache
            });

            console.log("Evento seleccionado:", eventSelect.tipo);

            await sleep(6000);
            await editarOMandarMensaje(interaction, exploracionCache, message, { components: eventMessage, flags: ["IsComponentsV2"] });

            const now = Date.now();
            const lastUp = soul.nucleo?.lastEnergyUpdate ?? now;
            const newLastUp = (lastUp === 0) ? now : lastUp;

            const soulId = soul?._id
            await souls.updateOne({ _id: soulId }, {
                $set: {
                    "nucleo.energy": nuevaEnergia,
                    "nucleo.lastEnergyUpdate": newLastUp,
                }
            });

        } catch (error) {
            console.log(error);
        }
    }

    async procesarEventoSwitch({ eventSelect, subzonaSelect, soul, areaSelect, client, interaction, exploracionCache }) {
        let eventMessage;
        let levelMessage;
        const components = [];

        switch (eventSelect.tipo) {
            case "battle": {
                const enemy = await this.selectEnemy(subzonaSelect.enemigos);
                const itemfilter = enemy.loot.filter(item => item.typeLoot === "item");
                const itemscoins = enemy.loot.find(item => item.typeLoot === "lumens");
                const itemsxp = enemy.loot.find(item => item.typeLoot === "xp");
                const items = await this.getObjInfo(itemfilter);
                const messageRewards = [];
                const enemyDefeat = soul?.npcDefeated?.[enemy._id];
                const mostrarHp = enemyDefeat ? `*${enemy.stats.hpMax}*` : "*Desconocido*";

                const amenazaLevel = this.calcularAmenaza(soul, enemy);

                if (itemscoins) {
                    messageRewards.push(`-# <a:Lumens:1335709991130103910> **Lumens** *(${itemscoins.quantity})* - **${(itemscoins.dropRate * 100)}%**`);
                }

                if (itemsxp) {
                    messageRewards.push(`-# <:XP:1350575069113352265> **XP** *(${itemsxp.quantity})* - **${(itemsxp.dropRate * 100)}%**`);
                }

                items.forEach((item, index) => {
                    messageRewards.push("-# `" + `[${item.ID}]` + "`" + ` **${item.Nombre}** - **${(item.dropRate * 100)}%**`);
                });

                console.log(enemyDefeat);

                components.push(
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": enemy.avatarURL
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "**Los hilos del destino se tensan… ¡una batalla se aproxima!**\n\n" + "**Enemigo:** " + `${enemy.Nombre}` + `\n- **Salud:** ${mostrarHp}\n- **Aura de amenaza:** ${amenazaLevel.nombre} *(LV: ${enemy.nivelMagico})*\n-# *${enemy.Descripcion}*\n** ** `
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": "`[🎁]` ***Recompensas posibles:***" + `\n${messageRewards.join("\n")}`
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
                                "label": "Combatir",
                                "emoji": {
                                    "name": "KrisJojos",
                                    "id": "1350664814414004395"
                                },
                                "disabled": false,
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: interaction.user.id,
                                    characterId: soul._id,
                                    extras: [`battle`, `[${enemy._id}]`, `acceptDuel`]
                                })
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": `Huir (${getEscapeP(enemy.restrictions?.probabilidadEscape || 100, soul.stats?.agilidad ?? soul.agilidad ?? 10, soul.stats?.inteligencia ?? soul.inteligencia ?? 10).porcentaje} %)`,
                                "emoji": {
                                    "name": "EeveeRun",
                                    "id": "1350663840349687941"
                                },
                                "disabled": (!enemy.restrictions.Run || false),
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: interaction.user.id,
                                    characterId: soul._id,
                                    extras: [`battle`, `[${enemy._id}]`, `runAway`]
                                })
                            }
                        ]
                    }
                );

                console.log(exploracionCache)
                eventMessage = await this.generateMessage(exploracionCache, soul, subzonaSelect, components, true);
                break;
            }

            case "loot": {
                console.log(subzonaSelect)
                exploracionCache.profundidad = (exploracionCache.profundidad || 0) + 1;
                const charId = soul?._id ?? soul?.id ?? soul?.ID;
                const { recompensas, levelMessage: levMsg } = await this.getRewardsLoot(subzonaSelect.loot, charId, client, interaction);
                levelMessage = levMsg;
                const gifs = await getGifs("happy");
                const TitleMessages = [
                    "Botín descubierto...",
                    "Tesoros hallados en la penumbra...",
                    "Resultados de tu búsqueda...",
                    "Un hallazgo inesperado...",
                    "Recompensas del destino..."
                ];
                const descripciones = [
                    "Bajo el eco del silencio, algo reluce entre las sombras...",
                    "Entre telarañas y fragmentos olvidados, recoges lo que el mundo dejó atrás.",
                    "Tu búsqueda ha dado frutos... aunque algunos sean más brillantes que útiles.",
                    "El destino ha decidido recompensarte... o probar tu suerte."
                ];

                const lootJSON = [
                    {
                        "type": 10,
                        "content": `# ${this.getRandomMessage(TitleMessages).message} \n\n-# ${this.getRandomMessage(descripciones).message}\n${levelMessage?.message ? levelMessage.message : ""}`
                    },
                    {
                        "type": 10,
                        "content": "`[📦]` **Has conseguido: **\n" + `\n- -# ${recompensas}`
                    },
                    {
                        "type": 12,
                        "items": [
                            {
                                "media": {
                                    "url": gifs.url
                                },
                                "description": null,
                                "spoiler": false
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 2
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `selectExplorar-${interaction.user.id}`,
                                "options": [
                                    {
                                        "label": `Seguir explorando [ ⚡${subzonaSelect.energiaNecesaria} ]`,
                                        "value": `continue*${areaSelect}`,
                                        "description": `Continuaras explorando en ${subzonaSelect.Nombre}`,
                                        "emoji": {
                                            name: "CirnoFumoWalking1",
                                            id: "1350682005691699220"
                                        },
                                        "default": false
                                    },
                                    {
                                        "label": `Dejar de explorar`,
                                        "value": `surrend*${areaSelect}`,
                                        "description": `Siempre es bueno saber hasta donde soltar las cosas`,
                                        "emoji": {
                                            name: "TuxedoSamTired",
                                            id: "1350682023370555454"
                                        }
                                    }
                                ],
                                "placeholder": "",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    }
                ];

                eventMessage = await this.generateMessage(exploracionCache, soul, subzonaSelect, lootJSON, true);
                break;
            }

            case "minigame": {
                exploracionCache.profundidad = (exploracionCache.profundidad || 0) + 1;
                eventMessage = "Evento de minijuego";
                break;
            }

            case "faro": {
                exploracionCache.profundidad = 0;
                exploracionCache.bloquearFaroSiguiente = true;
                eventMessage = await interfazCreate.faroExploración(client, interaction, areaSelect, soul);
                break;
            }

            case "nothing": {
                exploracionCache.profundidad = (exploracionCache.profundidad || 0) + 1;
                const gifsNothing = [
                    "https://c.tenor.com/urs-gwqkOV8AAAAd/tenor.gif",
                    "https://c.tenor.com/6HLLZUWbBlEAAAAd/tenor.gif",
                    "https://c.tenor.com/hp-sK7KtgSUAAAAd/tenor.gif",
                    "https://c.tenor.com/os0XDwxqPqMAAAAd/tenor.gif",
                    "https://c.tenor.com/tyQ9H4slRDkAAAAd/tenor.gif",
                    "https://c.tenor.com/TtO7jwYA6VAAAAAd/tenor.gif",
                    "https://c.tenor.com/KmMC1WRWlhkAAAAd/tenor.gif",
                    "https://c.tenor.com/hLL_m_1_J3YAAAAd/tenor.gif",
                    "https://c.tenor.com/ccmEtEXYCH0AAAAd/tenor.gif"
                ];

                const titleNothing = [
                    "Las sombras ocultaron todo...",
                    "Silencio absoluto",
                    "Te estafaron~",
                    "Nada por aquí~",
                    "La trampa del eterno retorno",
                ];

                const desNothing = [
                    "Tus pasos resonaban sin respuesta en la oscuridad... y nada te esperaba al final del camino.",
                    "Buscaste entre ruinas y polvo... pero el destino fue cruel esta vez.",
                    "Exploraste durante horas... ¡y ni un misero lumen encontraste!",
                    "Tal vez el verdadero tesoro eran los puntos de energía que perdimos en el camino.",
                    "Exploraste una tierra muerta. Nada crece. Nada brilla. Nada queda.",
                    "Cada pasillo parecía igual al anterior. Cada rincón, una copia del anterior. Al final... nada."
                ];

                const extraNothing = [
                    "Ninguna. Solo confusión y fatiga.",
                    "Solo un poco menos de energía... y un poco más de desesperanza.",
                    "No todos los días se gana, ¡ánimo!",
                    "Solo cansancio y decepción.",
                    "La suerte decidió ignorarte.",
                    "Solo el eco de tus esperanzas."
                ];

                const nothingJSON = [
                    {
                        "type": 10,
                        "content": `# ${this.getRandomMessage(titleNothing).message} \n\n-# ${this.getRandomMessage(desNothing).message}`
                    },
                    {
                        "type": 10,
                        "content": "`[📦]` **Has conseguido: **\n\n" + `\n-# ${this.getRandomMessage(extraNothing).message}`
                    },
                    {
                        "type": 12,
                        "items": [
                            {
                                "media": {
                                    "url": this.getRandomMessage(gifsNothing).message
                                }
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 2
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `selectExplorar-${interaction.user.id}`,
                                "custom_id": crearCustomId({
                                    action: "selectExplorar",
                                    userId: `${interaction.user.id}`,
                                    characterId: soul?._id,
                                    extras: [`null`]
                                }),
                                "options": [
                                    {
                                        "label": `Seguir explorando [ ⚡${subzonaSelect.energiaNecesaria} ]`,
                                        "value": `${areaSelect}*continue`,
                                        "description": `Continuaras explorando en ${subzonaSelect.nombre || subzonaSelect.Nombre}`,
                                        "emoji": {
                                            name: "CirnoFumoWalking1",
                                            id: "1350682005691699220"
                                        },
                                        "default": false
                                    },
                                    {
                                        "label": `Dejar de explorar`,
                                        "value": `${areaSelect}*surrend`,
                                        "description": `Siempre es bueno saber hasta donde soltar las cosas`,
                                        "emoji": {
                                            name: "TuxedoSamTired",
                                            id: "1350682023370555454"
                                        }
                                    }
                                ],
                                "placeholder": "",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    }
                ];

                eventMessage = await this.generateMessage(exploracionCache, soul, subzonaSelect, nothingJSON, true);
                break;
            }
        }

        return eventMessage;
    }

    async selectEvent(eventos, faroProb) {
        const listaEventos = this.construirListaEventos(eventos, faroProb);

        console.log(listaEventos);

        const total = listaEventos.reduce((sum, evento) => sum + evento.probabilidad, 0);
        let random = Math.random() * total;

        for (const evento of listaEventos) {
            if (random < evento.probabilidad) {
                return evento;
            }
            random -= evento.probabilidad;
        }

        // fallback por si total termina en 0 (todos los eventos en probabilidad 0)
        return listaEventos[listaEventos.length - 1];
    }

    construirListaEventos(eventosBase, faroProb) {
        const sinFaro = eventosBase.filter(e => e.tipo !== "faro");

        const totalSinFaro = sinFaro.reduce((sum, e) => sum + e.probabilidad, 0);
        const espacioRestante = Math.max(0, 100 - faroProb);

        // Reescala cada evento no-faro para que, junto al faro, sumen exactamente 100
        const eventosEscalados = sinFaro.map(e => ({
            ...e,
            probabilidad: totalSinFaro > 0
                ? (e.probabilidad / totalSinFaro) * espacioRestante
                : 0,
        }));

        eventosEscalados.push({ tipo: "faro", probabilidad: faroProb });

        return eventosEscalados;
    }

    async getRewardsLoot(loot, characterId, client, interaction) {
        const catalogoObjetos = require("../catalogoObjetos");
        const { duelSystem } = require("../Duelo/duelManager");
        const recompensas = [];
        let levelMessage = null;

        for (const recompensa of loot) {
            const isItem = recompensa.tipo === "item";
            const happens = recompensa.probabilidad >= 1 || Math.random() < recompensa.probabilidad;

            if (happens) {
                const cantidad = this.getRandomCantidad(recompensa.cantidad);
                let obj = {
                    ...recompensa,
                    cantidad: cantidad
                };

                let objInfo = null;
                if (isItem) {
                    const region = Array.isArray(recompensa.ID) ? recompensa.ID[0] : (recompensa.Region || "Global");
                    const id = Array.isArray(recompensa.ID) ? recompensa.ID[1] : recompensa.ID;

                    objInfo = catalogoObjetos.getObjetoPorId(region, id);
                    if (!objInfo) {
                        objInfo = await duelSystem.getObjetInfo(region, id);
                    }

                    obj = {
                        ...recompensa,
                        Nombre: objInfo?.Nombre || recompensa.Nombre || `Objeto ${id}`,
                        ID: objInfo?.ID || id,
                        cantidad: cantidad,
                        contaminable: typeof objInfo?.contaminable !== "undefined" ? Boolean(objInfo.contaminable) : false,
                        purificable: typeof objInfo?.purificable !== "undefined" ? Boolean(objInfo.purificable) : false
                    };
                }

                let objData = {
                    ID: Array.isArray(recompensa?.ID) ? recompensa.ID[1] : (recompensa?.ID || obj?.ID),
                    Region: Array.isArray(recompensa?.ID) ? recompensa.ID[0] : (recompensa?.Region || "Global"),
                    cantidad: cantidad,
                    isItem: isItem,
                    typeLoot: recompensa.tipo,
                    isTalisman: true,
                    contaminable: typeof obj?.contaminable !== "undefined" ? Boolean(obj.contaminable) : false,
                    purificable: typeof obj?.purificable !== "undefined" ? Boolean(obj.purificable) : false
                };

                const isLevel = await updateInventario(client, interaction, characterId, objData);
                if (isLevel?.message) {
                    levelMessage = isLevel;
                }
                recompensas.push(obj);
            }
        }

        const textoRecompensas = recompensas.map(reward => {
            switch (reward.tipo) {
                case "item":
                    return `${reward.cantidad} **${reward.Nombre}**`;
                case "xp":
                    return `<:XP:1350575069113352265> **XP: ** ${reward.cantidad}`;
                case "lumens":
                    return `<a:Lumens:1335709991130103910> **Lumens:** ${reward.cantidad} `;
                default:
                    return `${reward.cantidad} **${reward.Nombre}**`;
            }
        }).join("\n- -# ");

        return { recompensas: textoRecompensas, levelMessage };
    }

    async selectEnemy(enemies) {
        if (!enemies || enemies.length === 0) return false;

        let selectedEntry = null;
        const hasProbabilities = enemies.every(e => typeof e === "object" && typeof e.probabilidad === "number");

        if (hasProbabilities) {
            const total = enemies.reduce((sum, e) => sum + (e.probabilidad || 0), 0);
            let random = Math.random() * (total > 0 ? total : 100);
            for (const e of enemies) {
                if (random <= (e.probabilidad || 0)) {
                    selectedEntry = e;
                    break;
                }
                random -= (e.probabilidad || 0);
            }
            if (!selectedEntry) selectedEntry = enemies[0];
        } else {
            selectedEntry = enemies[Math.floor(Math.random() * enemies.length)];
        }

        const enemyId = typeof selectedEntry === "string" ? selectedEntry : selectedEntry?.ID || selectedEntry?._id;
        if (!enemyId) return false;

        const npcfind = await NPCs.findOne({ _id: `${enemyId}` });
        if (!npcfind) return false;

        return npcfind;
    }

    async getObjInfo(items) {
        const catalogoObjetos = require("../catalogoObjetos");
        const { duelSystem } = require("../Duelo/duelManager");
        const itemsArray = [];

        for (const item of items) {
            const [region, id] = item.itemId;
            let itemfullinfo = catalogoObjetos.getObjetoPorId(region, id);
            if (!itemfullinfo) {
                itemfullinfo = await duelSystem.getObjetInfo(region, id);
            }

            if (itemfullinfo) {
                const objeto = {
                    ...itemfullinfo,
                    dropRate: item.dropRate
                };
                itemsArray.push(objeto);
            }
        }

        return itemsArray;
    }

    getRandomCantidad(cantidad) {
        const [min, max] = cantidad.split('-').map(Number);
        return Math.floor(Math.random() * ((max || 1) - min + 1)) + min;
    }

    calcularAmenaza(characterData, enemy) {
        const nombres = [
            "Brisa Nocturna",
            "Latido Tenso",
            "Presencia Devastadora",
            "Eclipse Inminente",
            "Quiebre Celestial"
        ];

        const rango = [
            "débil",
            "medio",
            "hard",
            "very hard",
            "imposible"
        ];

        const fragmentosGanados = Number(
            characterData?.fragmentos?.ganados
            ?? characterData?.sendero?.StelarFragmentsTotal
            ?? characterData?.fragmentos?.StelarFragmentsTotal
            ?? characterData?.sendero?.StelarFragments
            ?? characterData?.fragmentos?.StelarFragments
            ?? characterData?.StelarFragmentsTotal
            ?? characterData?.StelarFragments
            ?? 0
        );

        const npcLvl = Number(enemy.nivelMagico ?? enemy.stats?.nivelMagico ?? enemy.restrictions?.fe_min ?? 1);
        const diferenciaPorcentual = ((npcLvl - fragmentosGanados) / Math.max(1, fragmentosGanados)) * 100;

        const hpActual = Number(characterData.HP ?? characterData.nucleo?.HP ?? 0);
        const hpMax = Number(characterData.stats?.hpMax ?? characterData.hpMax ?? 100);
        const porcentajeHP = hpMax > 0 ? (hpActual * 100) / hpMax : 100;

        const rangoExtra = enemy.isBoss ? 3 : (String(enemy.Type || enemy.tipo || '').toLowerCase() === "elite" ? 2 : 0);
        const rangoHP = porcentajeHP >= 50 ? 0 : (porcentajeHP >= 25 ? 1 : (porcentajeHP >= 10 ? 2 : 4));

        const totalDiferencia = diferenciaPorcentual + rangoExtra + rangoHP;

        if (totalDiferencia <= -20) {
            return { nombre: nombres[0], rangoEstandar: rango[0] };
        } else if (totalDiferencia <= 10) {
            return { nombre: nombres[1], rangoEstandar: rango[1] };
        } else if (totalDiferencia <= 50) {
            return { nombre: nombres[2], rangoEstandar: rango[2] };
        } else if (totalDiferencia <= 100) {
            return { nombre: nombres[3], rangoEstandar: rango[3] };
        } else {
            return { nombre: nombres[4], rangoEstandar: rango[4] };
        }
    }

    getRandomMessage(array, isProbability = [false, 0]) {
        let message;
        if (isProbability[0] && Math.random() < isProbability[1]) {
            return { message: array[Math.floor(Math.random() * array.length)], isSecret: true };
        }
        message = array[Math.floor(Math.random() * array.length)];
        return { message: message, isSecret: false };
    }

    /**
     * @param {*} cache // Almacenamiento temporal del usuario.
     * @param {*} soul // Información del personaje de la colección soul (combate)
     * @param {*} zona // Zona actual de exploración
     * @param {*} dataObj JSON de los elementos a mostrar debajo del top 
     * @param {*} showInfo Muestra información detallada del evento
     * @param {*} onlyTop Muestra solo la caratula principal (Top): Zona, profundidad, y datos del aventurero. Este siempre va arriba 
     * @returns 
     */

    async generateMessage(cache, soul, zona, dataObj, showInfo, onlyTop = false) {
        const components = [];
        const charId = soul?._id
        const ch = charId ? await characterCol.findOne({
            _id: Number(charId)
        }) : null;
        console.log("profundidad", cache.profundidad)

        const nombreZona = zona?.nombre ?? zona?.actualName ?? "Error"

        if (!dataObj) return [];


        if (showInfo) components.push(
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": ch.perfil.avatarURL || "https://cdn.discordapp.com/attachments/738874841783992351/1369868063633051668/Aya_Osawa.jpg?ex=681d6c8d&is=681c1b0d&hm=e05440b310bfc171f4a670032f5a3fe93033fed96da9c4ece7790ee4afea53b8&"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": `-# **Ubicación Actual:** ${nombreZona}\n-# **Profundidad:** ${cache.profundidad ?? "Desconocida"}\n\n-# **Aventurero:** *${ch?.perfil?.Nombre || "Nombre no encontrado"}*\n-# **HP:** ${this.statusBarra(soul.nucleo?.HP ?? 0, soul.stats?.hpMax ?? 0, 5, "❤︎ ", "♡")}` +
                            `\n-# **Mana:** ${this.statusBarra(soul.nucleo?.Mana ?? 0, soul.stats?.manaMax ?? 0, 5, "🔷")}\n-# **Energía:** ${barrasDeEnergia(soul.nucleo?.energy ?? 0, configServer.maxEnergy)}`
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 2
            }
        );

        components.push(...dataObj);

        if (onlyTop) {
            return components;
        } else {
            const json = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": components
                }
            ];
            return json;
        }
    }

    almacenarObjetosTemp(loot) {

    }

    statusBarra(minValue, maxValue, lengthBar, emoji, emojiEmpty = ".") {
        const val = Math.max(0, Number(minValue || 0));
        const max = Number(maxValue || 1);
        const maxbar = lengthBar;

        let filledBars = Math.round(((val > max ? max : val) / max) * maxbar);
        const emptyBars = Math.max(0, maxbar - filledBars);

        let energyBars = `${emoji}`.repeat(filledBars);
        let energyEmpty = emojiEmpty.repeat(emptyBars);

        return "`" + ` ${energyBars}${energyEmpty}` + "`" + ` *(${val}/${max})*`;
    }
}

module.exports = new ExploracionManager();
