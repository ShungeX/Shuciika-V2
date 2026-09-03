const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const clientdb = require("../../Server");
const db2 = clientdb.db("Rol_db");
const characters = db2.collection("Personajes");
const npcs = db2.collection("NPCs");
const regiones = db2.collection("Regiones");
const transaccionCache = require("../../utils/cache");
const configServer = require("../../config");
const { barrasDeEnergia, editarOMandarMensaje } = require("../../utils/utilidadesTexto");
const { getEscapeP } = require("./escape");
const { duelSystem, duelEmitter } = require("../Duelo/duelManager");

const util = require("util");
const { crearCustomId } = require("../../utils/constructores/customId");
const sleep = util.promisify(setTimeout);

function formatRewardsText(rewardsData, charId) {
    if (!rewardsData) return "Sin recompensas adicionales en este combate.";

    let rewardObj = null;
    if (typeof rewardsData === "string") {
        return rewardsData;
    }

    if (rewardsData.recompensas instanceof Map) {
        rewardObj = rewardsData.recompensas.get(Number(charId))
            || rewardsData.recompensas.get(String(charId))
            || Array.from(rewardsData.recompensas.values())[0];
    } else if (rewardsData instanceof Map) {
        rewardObj = rewardsData.get(Number(charId))
            || rewardsData.get(String(charId))
            || Array.from(rewardsData.values())[0];
    } else if (typeof rewardsData === "object") {
        rewardObj = rewardsData[charId] || rewardsData.recompensas || rewardsData;
    }

    if (!rewardObj) return "Sin recompensas adicionales en este combate.";

    const lines = [];
    if (rewardObj.polvo) {
        lines.push(`<:XP:1350575069113352265> **XP (Polvo Estelar):** +${rewardObj.polvo}`);
    }
    if (rewardObj.lumens) {
        lines.push(`<a:Lumens:1335709991130103910> **Lumens:** +${rewardObj.lumens}`);
    }
    if (rewardObj.loot) {
        if (Array.isArray(rewardObj.loot)) {
            rewardObj.loot.forEach(item => {
                if (item) {
                    const cant = item.cantidad || 1;
                    const nombre = item.nombre || item.Nombre || item.id || "Objeto";
                    lines.push(`📦 **${cant}x ${nombre}**`);
                }
            });
        } else if (typeof rewardObj.loot === "object") {
            Object.values(rewardObj.loot).forEach(item => {
                if (item && typeof item === "object") {
                    const cant = item.cantidad || 1;
                    const nombre = item.nombre || item.Nombre || item.id || "Objeto";
                    lines.push(`📦 **${cant}x ${nombre}**`);
                }
            });
        }
    }

    return lines.length > 0 ? lines.join("\n") : "Sin recompensas adicionales en este combate.";
}

/**
 * Calcula el rescate aleatorio de objetos del talismán tras una derrota en exploración.
 * @param {Array} talismanArray 
 * @returns {Array} Objetos rescatados agrupados
 */
function calcularRescate(talismanArray) {
    const totalObjetos = (talismanArray || []).reduce((acc, item) => acc + Number(item.Cantidad || item.cantidad || 1), 0);
    if (totalObjetos <= 0) return [];

    const CAP = 30;          // ⚙ a partir de aquí la probabilidad ya no sigue subiendo
    const MAX_RESCATE = 10;  // ⚙ techo absoluto, sin importar cuánto lleves

    const n = Math.min(totalObjetos, CAP);

    // Probabilidad de rescatar AL MENOS 1 objeto.
    // Exponente > 1 hace que la curva arranque muy baja y se acelere después.
    const probRescate = Math.pow(n / CAP, 1.4) * 0.85; // ⚙ tope real ~85%, nunca 100%

    if (Math.random() > probRescate) {
        return []; // no se rescata nada
    }

    // Si hay rescate, la cantidad posible también escala con n
    const maxPosible = Math.max(1, Math.round((n / CAP) * MAX_RESCATE));
    const cantidad = Math.min(totalObjetos, 1 + Math.floor(Math.random() * maxPosible));

    // Desglosar talisman en unidades individuales para selección aleatoria
    const unidades = [];
    for (const item of talismanArray) {
        const cant = Number(item.Cantidad || item.cantidad || 1);
        for (let i = 0; i < cant; i++) {
            unidades.push({ ...item, Cantidad: 1 });
        }
    }

    // Barajar y tomar 'cantidad' unidades
    const seleccionadas = [];
    for (let i = 0; i < cantidad && unidades.length > 0; i++) {
        const idx = Math.floor(Math.random() * unidades.length);
        seleccionadas.push(unidades.splice(idx, 1)[0]);
    }

    // Agrupar por ID y Región
    const agrupados = [];
    for (const sel of seleccionadas) {
        const exist = agrupados.find(a => Number(a.ID) === Number(sel.ID) && a.Region === sel.Region);
        if (exist) {
            exist.Cantidad += 1;
        } else {
            agrupados.push({ ...sel, Cantidad: 1 });
        }
    }

    return agrupados;
}

async function resumeExploration(client, interaction, cache, soul, rewards, isWin = false, cacheId, levelUp = null) {
    if (isWin && cache) {
        cache.profundidad = (cache.profundidad || 0) + 1;
    }
    const { generateMessage } = require("./exploracionManager");
    const { recargarEnergia } = require("../dataCharacters");

    const charId = soul?._id ?? soul?.id ?? soul?.ID ?? cache?.characterId;
    let currentSoul = soul;
    if (!currentSoul) {
        currentSoul = await db2.collection("Soul").findOne({
            $or: [
                { _id: charId },
                { _id: Number(charId) }
            ]
        });
    }
    if (currentSoul) recargarEnergia(currentSoul);

    const gifsDefeatedUrl = [
        "https://static2.klipy.com/ii/84b4c0b02782dda9051003f9e36484ec/09/d8/4iSuoNVc.gif",
        "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f1/06/k3lvBgxeCYkY1emb4.gif",
        "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/66/d3/Pv5yK1je.gif",
        "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/e4/e4/gpNGcKGFMWOa7wRi7.gif",
        "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/18/78/9Df6eDHAfAZoeENwv.gif",
        "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/a5/d2/RyYx2cXbFC2uTmDZep.gif",
        "https://static2.klipy.com/ii/39f2394ae36df6e199be9eb7c9fa1012/16/e9/QuaKEgMx.gif",
        "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/0c/a1/nquyVGkNnCyuamM3dni.gif",
        "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/51/62/iTADjPP5feI8qA9FH.gif",
        "https://static2.klipy.com/ii/f87f46a2c5aeaeed4c68910815f73eaf/0e/77/TKD4rLxB.gif",
        "https://static2.klipy.com/ii/a15b48460c436e1e92c85ffc680932cc/6e/67/f1BXcbSr.gif",
        "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/f1/83/L5oYiMPRIVqN7JPdAI.gif"
    ];

    const gifsWinUrl = [
        "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/a0/c0/SwGj4mQ1.gif",
        "https://c.tenor.com/FDQMqVd1Eo0AAAAd/tenor.gif",
        "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/25/5e/HmdwWBVt.gif",
        "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/2d/bb/b4DlXbPD.gif"
    ];

    const gifDeatedSelect = gifsDefeatedUrl[Math.floor(Math.random() * gifsDefeatedUrl.length)];
    const gifWinSelect = gifsWinUrl[Math.floor(Math.random() * gifsWinUrl.length)];

    const enemyName = cache.enemy?.Nombre || cache.enemy?.nombre || "Enemigo";
    const subzonaKey = cache.subzona || cache.areaSelect || "sub_001";

    let payloadComponents = [];

    if (isWin) {
        const titleText = `# ¡Victoria en el Duelo!`;
        const descriptionText = `-# Has derrotado a **${enemyName}**\n\n**Recompensas del Combate:**\n${rewards || "Recompensas registradas."}\n\n-# ¿Deseas continuar explorando?`;

        payloadComponents = [
            { "type": 10, "content": titleText },
            { "type": 10, "content": descriptionText },
            { "type": 14, "divider": true, "spacing": 1 },
            {
                "type": 12,
                "items": [{ "media": { "url": gifWinSelect }, "description": null, "spoiler": false }]
            },
            { "type": 14, "divider": true, "spacing": 1 },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 3,
                        "label": "Seguir explorando",
                        "emoji": { "name": "CirnoFumoWalking1", "id": "1350682005691699220" },
                        "disabled": false,
                        "custom_id": crearCustomId({
                            action: "exOp",
                            userId: interaction.user.id,
                            characterId: soul._id,
                            extras: [`continue`, `${subzonaKey}`]
                        })
                    }
                ]
            }
        ];
    } else {
        // DERROTA: Procesar rescate de objetos del talismán, vaciar talismán y finalizar expedición
        const pj = await characters.findOne({
            $or: [
                { _id: charId },
                { _id: Number(charId) }
            ]
        });

        const rawTalisman = pj?.economia?.inventarioTalisman || [];
        const objetosRescatados = calcularRescate(rawTalisman);

        // Guardar objetos rescatados en el inventario permanente (descontaminados)
        const { sanitizarObjetoInventario } = require("../catalogoObjetos");
        const currentInventario = [...(pj?.economia?.Inventario || [])];
        for (const rItem of objetosRescatados) {
            const rId = Number(rItem.ID);
            const rCant = Number(rItem.Cantidad || 1);
            const rRegion = rItem.Region || "Global";

            const existing = currentInventario.find(i => Number(i.ID) === rId && (i.Region === rRegion || !i.Region || !rRegion));
            if (existing) {
                existing.Cantidad = Number(existing.Cantidad || existing.cantidad || 0) + rCant;
                if (typeof existing.contaminable !== "undefined") existing.contaminable = false;
                if (typeof existing.purificable !== "undefined") existing.purificable = false;
                if (existing.cantidad !== undefined) delete existing.cantidad;
            } else {
                const cleanItem = sanitizarObjetoInventario(rItem, rCant, { contaminable: false, purificable: false });
                currentInventario.push(cleanItem);
            }
        }

        // Procesar rotura de talismanes:
        // 1. Si tiene ID: 83 de TOB-01, eliminarlo y otorgarle ID: 84 de TOB-01 (Talismán de Umbral Original (Roto))
        const index83 = currentInventario.findIndex(i => Number(i.ID) === 83 && (i.Region === "TOB-01" || i.Region === "TOB_INS" || !i.Region));
        if (index83 !== -1) {
            const item83 = currentInventario[index83];
            const cant83 = Number(item83.Cantidad || item83.cantidad || 1);
            if (cant83 > 1) {
                item83.Cantidad = cant83 - 1;
                if (item83.cantidad !== undefined) delete item83.cantidad;
            } else {
                currentInventario.splice(index83, 1);
            }

            // Otorgar ID 84 de TOB-01 solo si no lo posee ya en su inventario (no duplicar)
            const existing84 = currentInventario.find(i => Number(i.ID) === 84 && (i.Region === "TOB-01" || i.Region === "TOB_INS" || !i.Region));
            if (existing84) {
                // Ya posee el talismán roto, se fija en 1 y no se duplica
                existing84.Cantidad = 1;
                if (typeof existing84.contaminable !== "undefined") existing84.contaminable = false;
                if (typeof existing84.purificable !== "undefined") existing84.purificable = false;
                if (existing84.cantidad !== undefined) delete existing84.cantidad;
            } else {
                const newObj84 = sanitizarObjetoInventario(
                    { ID: 84, Region: "TOB-01", Nombre: "Talismán de Umbral Original (Roto)" },
                    1,
                    { contaminable: false, purificable: false }
                );
                currentInventario.push(newObj84);
            }
        } else {
            // 2. Si ya no tiene el 83 y en cambio tiene el ID 85 de TOB-01, eliminarlo y aumentar en +1 Soul.registros.talismanesRotos
            const index85 = currentInventario.findIndex(i => Number(i.ID) === 85 && (i.Region === "TOB-01" || i.Region === "TOB_INS" || !i.Region));
            if (index85 !== -1) {
                const item85 = currentInventario[index85];
                const cant85 = Number(item85.Cantidad || item85.cantidad || 1);
                if (cant85 > 1) {
                    item85.Cantidad = cant85 - 1;
                    if (item85.cantidad !== undefined) item85.cantidad = item85.Cantidad;
                } else {
                    currentInventario.splice(index85, 1);
                }

                await db2.collection("Soul").updateOne(
                    {
                        $or: [
                            { _id: charId },
                            { _id: Number(charId) }
                        ]
                    },
                    {
                        $inc: {
                            "registros.talismanesRotos": 1
                        }
                    }
                );
            }
        }

        // Actualización atómica en DB: guardar inventario y vaciar el talismán roto
        if (pj) {
            await characters.updateOne(
                { _id: pj._id },
                {
                    $set: {
                        "economia.Inventario": currentInventario,
                        "economia.inventarioTalisman": []
                    }
                }
            );
        }

        let listaObjetosTexto = "";
        if (objetosRescatados.length > 0) {
            const itemsFormatted = objetosRescatados.map(i => {
                const cant = Number(i.Cantidad || 1);
                const nombre = i.Nombre || (`Objeto [${i.ID}]`);
                const formattedId = String(i.ID).padStart(3, ' ');
                return `- -# \`[${formattedId}]\` - **${nombre}** x ${cant}`;
            }).join("\n");
            listaObjetosTexto = `### Rescataste los siguientes objetos:\n${itemsFormatted}\n-# El resto se pierde junto con la caída.`;
        } else {
            listaObjetosTexto = `### Rescate de objetos:\n- -# *No lograste rescatar ningún objeto del talismán.*\n-# *Todo tu botín se ha perdido en la penumbra.*`;
        }

        const titleText = `# Derrota en el Duelo [Fin de la exploración]`;
        const descriptionText = `-# Has sucumbido ante **${enemyName}**...\n\n-# El \`Talismán de Umbral\` no resistió el impacto y se ha roto\n-# Sin nada que lo sostenga, te arrastra de vuelta al único punto que aún reconoce: **el Instituto**`;

        payloadComponents = [
            { "type": 10, "content": titleText },
            { "type": 10, "content": descriptionText },
            { "type": 14, "divider": true, "spacing": 1 },
            { "type": 10, "content": listaObjetosTexto },
            { "type": 14, "divider": true, "spacing": 1 },
            {
                "type": 12,
                "items": [{ "media": { "url": gifDeatedSelect }, "description": null, "spoiler": false }]
            }
        ];

        // Cortar y eliminar la sesión de exploración en memoria
        transaccionCache.delete(cacheId);
        if (cache?.id) transaccionCache.delete(cache.id);
        transaccionCache.deleteUser(interaction.user.id);
    }

    const subzonaObj = { nombre: cache.actualName || "Exploración" };
    const finalComponents = await generateMessage(cache, currentSoul, subzonaObj, payloadComponents, true);

    try {
        const dmText = isWin
            ? `El duelo ha finalizado. Puedes continuar explorando.\n-# [Haz click aquí para ir al mensaje de exploración](https://discord.com/channels/${cache.message.guildId}/${cache.message.channelId}/${cache.message.id})`
            : `Has sido derrotado. La expedición ha terminado y regresas al Instituto.\n-# [Haz click aquí para ver el resultado](https://discord.com/channels/${cache.message.guildId}/${cache.message.channelId}/${cache.message.id})`;

        await interaction.user.send({
            content: dmText
        }).catch(() => { });
    } catch (e) { }

    let messageObj = cache.message;
    if (cache.message?.id && interaction.channel) {
        try {
            messageObj = await interaction.channel.messages.fetch(cache.message.id);
        } catch (e) { }
    }

    return await editarOMandarMensaje(interaction, cache, messageObj, { components: finalComponents, flags: ["IsComponentsV2"] });
}

async function startBattle(client, interaction, character, soul, enemy, data, cacheId, isFailed = false) {
    const { generateMessage } = require("./exploracionManager");
    const { recargarEnergia } = require("../dataCharacters");
    const { Personaje, NPC } = require("../Duelo/combatientes");
    const combateUI = require("../Duelo/combateUI");
    const channelDuel = await client.channels.fetch("1345239393786527784");
    const exploracionCache = transaccionCache.get(cacheId);
    if (!exploracionCache) return;

    exploracionCache.enemy = enemy;
    exploracionCache.MdAuthor = data.MdAuthor;
    exploracionCache.interaction = interaction;

    let message;
    try {
        message = await interaction.channel.messages.fetch(`${exploracionCache.message.id}`);
    } catch (error) {
        if (!interaction.deferred && !interaction.replied) {
            return interaction.reply({ content: "Error al iniciar el duelo [Mensaje no encontrado]", flags: ["Ephemeral"] }).catch(() => { });
        }
        return;
    }

    try {
        const messagesText = isFailed ? `${data.messageFailed}\n\n-# El duelo ha comenzado, ${interaction.user} revisa tus mensajes privados` :
            `-# El duelo ha comenzado, ${interaction.user} revisa tus mensajes privados`;

        const playerInstance = new Personaje(character._id, {
            ownerId: interaction.user.id,
            perfil: character.perfil,
            nucleo: soul.nucleo,
            stats: soul.stats,
            dominio: soul.dominio,
            sendero: soul.sendero,
        });

        const npcInstance = new NPC(enemy._id ?? enemy.ID, {
            ...enemy,
            Nombre: enemy.Nombre || enemy.nombre || "NPC"
        });

        await sleep(2000);

        const sesion = duelSystem.crearSesion({
            sessionId: channelDuel.id,
            duelType: "exploration",
            teams: [[playerInstance], [npcInstance]],
            apuestas: null,
            tipoApuesta: null,
            modeTest: false
        });

        if (!sesion) {
            console.error(`[battleExploration] Error al crear la sesión de combate ${channelDuel.id}.`);
            if (!interaction.deferred && !interaction.replied) {
                return interaction.reply({ content: "Error al iniciar el duelo [Sesión ocupada o no disponible]", flags: ["Ephemeral"] }).catch(() => { });
            }
            return;
        }

        const jsonDuelEdited = [
            { "type": 10, "content": `# ${data?.messageTitle ? data.messageTitle : "Has aceptado el duelo"}` },
            { "type": 10, "content": `${messagesText}` },
            { "type": 14, "divider": true, "spacing": 1 },
            {
                "type": 12,
                "items": [{ "media": { "url": data.messageGif }, "description": null, "spoiler": false }]
            }
        ];

        const messageEdit = await generateMessage(exploracionCache, soul, exploracionCache, jsonDuelEdited, true);
        await editarOMandarMensaje(interaction, exploracionCache, message, { components: messageEdit });

        sesion.state = "ACTIVO";
        sesion.addLog("inicio", "El duelo de exploración ha comenzado");

        sesion.once("combateFinalizado", async (datos) => {
            const uuidCache = transaccionCache.getUser(interaction.user.id);
            const explorationCache = transaccionCache.get(uuidCache?.explorarID);

            const charId = character._id ?? character.ID ?? interaction.user.id;
            const isWinner = datos?.arrayWinner?.some(w => String(w.ID || w._id) === String(charId));

            // Si fue derrota contra NPC, esperar los 5s de animación + margen
            await sleep(isWinner ? 4500 : 5500);

            let updatedSoul = await db2.collection("Soul").findOne({
                $or: [
                    { _id: charId },
                    { _id: Number(charId) }
                ]
            });
            if (updatedSoul) recargarEnergia(updatedSoul);

            const rewardData = sesion.rewardsMap || datos.rewards || datos.recompensas;
            const rewardText = formatRewardsText(rewardData, charId);

            if (explorationCache) {
                await resumeExploration(client, interaction, explorationCache, updatedSoul || soul, rewardText, isWinner, uuidCache?.explorarID);
            }
        });

        await combateUI.update(sesion, client);

        const TurnProcessor = require("../Duelo/turnProcessor");
        const firstActor = sesion.getCurrentActor();
        if (firstActor && (firstActor.isNPC || firstActor.activeCast)) {
            await TurnProcessor.advanceCompas(sesion, client);
        }

    } catch (error) {
        if (error.code === 50007) {
            interaction.channel.send({ content: `Los duelos solo se pueden iniciar si tienes Mds Abiertos.` }).catch(() => { });
        } else {
            console.error("Error en startBattle:", error);
            if (!interaction.deferred && !interaction.replied) {
                interaction.reply({ content: "Ocurrió un error al intentar iniciar el duelo...", flags: ["Ephemeral"] }).catch(() => { });
            }
        }
        transaccionCache.delete(cacheId);
        transaccionCache.deleteUser(interaction.user.id);
    }
}

async function obtenerPersonajeYAlma(interaction, exploracionCache) {
    const userdbs = clientdb.db("Server_db").collection("usuarios_server");
    let charId = exploracionCache?.characterId;

    if (!charId) {
        const userServer = await userdbs.findOne({ _id: interaction.user.id });
        charId = userServer?.nix?.personajeActivo;
    }

    let character = null;
    if (charId) {
        character = await characters.findOne({
            $or: [
                { _id: charId },
                { _id: Number(charId) }
            ]
        });
    }

    const targetId = character?._id ?? charId;
    let soul = null;
    if (targetId) {
        soul = await db2.collection("Soul").findOne({
            $or: [
                { _id: targetId },
                { _id: Number(targetId) }
            ]
        });
    }

    return { character, soul };
}

async function battleSwitch(client, interaction, enemyId, soul, action, cache) {
    const { calcularAmenaza, generateMessage } = require("./exploracionManager");
    const exploracionCache = transaccionCache.get(cache?.explorarID);
    if (!exploracionCache) return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", flags: ["Ephemeral"] });

    if (exploracionCache.message?.id && interaction.message?.id && exploracionCache.message.id !== interaction.message.id) {
        return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", flags: ["Ephemeral"] });
    }

    const region = await regiones.findOne({ _id: exploracionCache.regionSelect });
    const subzonaSelect = region?.areas?.[exploracionCache.zona]?.subzonas?.[exploracionCache.subzona];

    const enemy = await npcs.findOne({ _id: `${enemyId}` });
    const MdAuthor = await interaction.user.createDM();
    let message;
    exploracionCache.actualName = subzonaSelect?.nombre || "Zona";

    try {
        message = await interaction.channel.messages.fetch(`${exploracionCache.message.id}`);
        if (!message) return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", flags: ["Ephemeral"] });

        await MdAuthor.send({ content: "-# Comprobando DM...\n-# Este mensaje se borra automáticamente", flags: ["SuppressNotifications"] })
            .then(m => setTimeout(() => m.delete(), 3000));
    } catch (error) {
        return interaction.reply({ content: "No puedes iniciar un duelo si tienes los **mensajes directos** desactivados.\n-# Intenta activar 'Mensajes directos de otros' o pide ayuda en el foro <#1064054917662265404>", flags: ["Ephemeral"] });
    }

    if (!enemy) {
        return interaction.reply({ content: "Hubo un error al cargar el duelo. [Enemigo no encontrado]\n-# Intenta cancelar el encuentro o contacta a soporte...", flags: ["Ephemeral"] });
    }

    if (action === "runAway") {
        const agilidad = soul?.stats?.agilidad
        const inteligencia = soul?.stats?.inteligencia
        const probObj = getEscapeP(enemy.restrictions?.probabilidadEscape || 100, agilidad, inteligencia);
        const roll = Math.random() * 100;
        const isSuccess = (roll < probObj.porcentaje);
        const dificultad = calcularAmenaza(soul, enemy);

        console.log(dificultad)

        const messages = {
            "debil": [{ title: "Intentas escapar...", description: "No todos los combates se ganan con fuerza. A veces, la mejor decisión es saber cuándo correr." }],
            "medio": [{ title: "¡No es cobardía… es estrategia!", description: "El miedo aprieta el pecho, pero tus piernas no dudan." }],
            "hard": [{ title: "¡Escape.exe iniciado!", description: "Realizas una retirada táctica con una velocidad increíble." }],
            "very hard": [{ title: "El juicio del cazador te alcanza", description: "Sabes que huir no asegura la vida… pero quedarte sí promete la muerte." }],
            "imposible": [{ title: "Te paralizas...", description: "Tus pies no se mueven." }]
        };

        const listaMensajes = messages[dificultad?.rangoEstandar] || messages["debil"];
        const indexAleatorio = listaMensajes[Math.floor(Math.random() * listaMensajes.length)];

        const gifRunArray = [
            "https://c.tenor.com/MMA6_WvqS60AAAAd/tenor.gif",
            "https://c.tenor.com/am4tzoTsnRoAAAAd/tenor.gif",
            "https://c.tenor.com/mUIXigPWPuYAAAAd/tenor.gif",
            "https://c.tenor.com/XbfdY2Lx-zwAAAAd/tenor.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/9d/18/u7m37zPFVgDtv2.gif",
            "https://static2.klipy.com/ii/c44064a00e4b7451969381d90dea1769/a7/00/pr0IxBag.gif",
            "https://static2.klipy.com/ii/9ed0121ed465c12e1f3dda331ed33f0e/d0/73/CXHvg6ZxbWBpD.gif",
            "https://static2.klipy.com/ii/a15b48460c436e1e92c85ffc680932cc/64/6d/AlNnnRWC.gif",
            "https://static2.klipy.com/ii/a15b48460c436e1e92c85ffc680932cc/52/c1/HWZSypa1.gif",
            "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/c3/4a/RTFMOrn1.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/06/59/0l9Atcq06l0IeO0fnCVk.gif",
            "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/ce/d1/tdKMLKum.gif",
            "https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/f2/15/51aiAGTF.gif",
            "https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/dd/f7/4lrwquD8.gif",
        ]

        const failedRunArray = [
            "https://c.tenor.com/tpSxlupzrQkAAAAd/tenor.gif",
            "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/3d/e8/fZTUju1R.gif",
            "https://static2.klipy.com/ii/39f2394ae36df6e199be9eb7c9fa1012/55/4f/L5mVyteU.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/de/e9/x4zrbfTe5uZKn.gif",
            "https://static2.klipy.com/ii/35ccce3d852f7995dd2da910f2abd795/17/7b/MwCAIXtG.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/0e/aa/9GSmNSlMzrDeW.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/22/9d/1ovdEhWIlVHokqGrYeHv.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/61/ba/GgP1tuxoyHO9s.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/fc/46/mfsNXblWpneKUni57C.gif",
        ]

        const trueRunArray = [
            "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/42/41/u9rJbYYJ.gif",
            "https://c.tenor.com/dCBeOkxsWdoAAAAd/tenor.gif",
            "https://static2.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/a1/af/X95pfVCG.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/b5/9c/y393un39FNoQP.gif",
        ]

        const gifrunSelect = gifRunArray[Math.floor(Math.random() * gifRunArray.length)];
        const failedRunSelect = failedRunArray[Math.floor(Math.random() * failedRunArray.length)]
        const trueRunSelect = trueRunArray[Math.floor(Math.random() * trueRunArray.length)]

        const jsonEscape = [
            { "type": 10, "content": `# ${indexAleatorio.title}` },
            { "type": 10, "content": `-# **${indexAleatorio.description}**` },
            { "type": 14, "divider": true, "spacing": 1 },
            { "type": 12, "items": [{ "media": { "url": gifrunSelect }, "description": null, "spoiler": false }] }
        ];

        const runComponent = await generateMessage(exploracionCache, soul, subzonaSelect[0], jsonEscape, true);
        await editarOMandarMensaje(interaction, exploracionCache, message, { components: runComponent, flags: ["IsComponentsV2"] });
        await sleep(4000);

        if (isSuccess) {
            exploracionCache.profundidad = (exploracionCache.profundidad || 0) + 1;
            const energyVal = soul?.nucleo?.energy ?? 0;
            const jsonSuccess = [
                { "type": 10, "content": `# Has escapado con éxito` },
                { "type": 10, "content": `-# **El enemigo no pudo alcanzarte...**\nAl parecer tienes una buena velocidad.\n-# ${barrasDeEnergia(energyVal, configServer.maxEnergy)}` },
                { "type": 14, "divider": true, "spacing": 1 },
                { "type": 12, "items": [{ "media": { "url": trueRunArray }, "description": null, "spoiler": false }] }
            ];

            const isSuccessComponents = await generateMessage(exploracionCache, soul, subzonaSelect[0], jsonSuccess, true);
            await editarOMandarMensaje(interaction, exploracionCache, message, { components: isSuccessComponents, flags: ["IsComponentsV2"] });

            await sleep(5000);
            const exploracionManager = require("./exploracionManager");
            await exploracionManager.ejecutarAccionExploracion({ client, interaction, character: null, soul, areaSelect: exploracionCache.subzona, interact: "continue" });
        } else {
            const { character, soul: resolvedSoul } = await obtenerPersonajeYAlma(interaction, exploracionCache);
            if (resolvedSoul) soul = resolvedSoul;
            const gifSelect = failedRunSelect;
            const JSONFailed = [
                { "type": 10, "content": `# No has podido escapar...` },
                { "type": 10, "content": `El enemigo interceptó tu huida antes de que pudieras tomar impulso.\n**Iniciando el duelo...**` },
                { "type": 14, "divider": true, "spacing": 1 },
                { "type": 12, "items": [{ "media": { "url": gifSelect }, "description": null, "spoiler": false }] }
            ];

            const messagesFailed = await generateMessage(exploracionCache, soul, subzonaSelect[0], JSONFailed, true);
            await editarOMandarMensaje(interaction, exploracionCache, message, { components: messagesFailed, flags: ["IsComponentsV2"] });

            const data = {
                messageTitle: "No has podido escapar...",
                messageFailed: "El enemigo interceptó tu huida antes de que pudieras tomar impulso.",
                messageGif: gifSelect,
                MdAuthor: MdAuthor
            };

            await sleep(3000);
            await startBattle(client, interaction, character, soul, enemy, data, cache?.explorarID, true);
        }
    }

    if (action === "acceptDuel") {
        const acceptDuelArray = [
            "https://c.tenor.com/4_zEp4wugDoAAAAC/tenor.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/b3/4d/yh8yUW3AQvXI.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/c6/41/dQpgoFfEYfkbiGZlX2.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/07/98/0872D9MoiLfhPullffOX.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/85/13/aL0LA0JmkmrvjRyE.gif",
            "https://static2.klipy.com/ii/f87f46a2c5aeaeed4c68910815f73eaf/ab/2a/V4cl0c0F.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/7b/85/RE41iouWeC2KUCi.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/43/4a/brZ12tN3O1Fp.gif",
            "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/6e/79/osNB1775.gif",
            "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/93/70/DqjYU7Mn.gif",
            "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/6f/74/vs0iw8JI.gif",
            "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/a1/30/gYTcyUJb.gif",
            "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/5a/bd/8mpBZr1bQ0fHyUIKLQT.gif",
            "https://static2.klipy.com/ii/ce286d05b8e1a47cd4f32b0e1b6dec0e/fe/65/d5a4qKsx.gif",
            "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/af/6a/ZlhjoJUvAFltiJRCHCN.gif",
            "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/fc/5e/rEsq6l51.gif",
            "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/a4/a2/YxGJKlQ2.gif",
        ]

        const acceptDuelSelect = acceptDuelArray[Math.floor(Math.random() * acceptDuelArray.length)]
        const jsonAccept = [
            { "type": 10, "content": `# Has aceptado el duelo` },
            { "type": 10, "content": `-# Preparando el duelo...` },
            { "type": 14, "divider": true, "spacing": 1 },
            { "type": 12, "items": [{ "media": { "url": acceptDuelSelect }, "description": null, "spoiler": false }] }
        ];

        const { character, soul: resolvedSoul } = await obtenerPersonajeYAlma(interaction, exploracionCache);
        if (resolvedSoul) soul = resolvedSoul;

        if (!character || !soul) {
            return interaction.reply({ content: "No se ha podido obtener tu personaje.", flags: ["Ephemeral"] });
        }

        const messageDuel = await generateMessage(exploracionCache, soul, subzonaSelect[0], jsonAccept, true);
        await editarOMandarMensaje(interaction, exploracionCache, message, { components: messageDuel, flags: ["IsComponentsV2"] });

        const data = {
            messageGif: acceptDuelSelect,
            MdAuthor: MdAuthor
        };

        await startBattle(client, interaction, character, soul, enemy, data, cache?.explorarID);
    }
}

module.exports = { battleSwitch, startBattle, resumeExploration, formatRewardsText };
