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

async function resumeExploration(client, interaction, cache, soul, rewards, isWin = false, cacheId, levelUp = null) {
    if (isWin && cache) {
        cache.profundidad = (cache.profundidad || 0) + 1;
    }
    const { generateMessage } = require("./exploracionManager");
    const { recargarEnergia } = require("../dataCharacters");

    let currentSoul = soul;
    if (!currentSoul) {
        currentSoul = await db2.collection("Soul").findOne({
            $or: [
                { _id: cache.characterId },
                { _id: Number(cache.characterId) }
            ]
        });
    }
    if (currentSoul) recargarEnergia(currentSoul);

    const enemyName = cache.enemy?.Nombre || cache.enemy?.nombre || "Enemigo";
    const subzonaKey = cache.subzona || cache.areaSelect || "sub_001";

    const titleText = isWin
        ? `# ¡Victoria en el Duelo!`
        : `# Derrota en el Duelo`;

    const descriptionText = isWin
        ? `-# Has derrotado a **${enemyName}**\n\n**Recompensas del Combate:**\n${rewards || "Recompensas registradas."}\n\n-# ¿Deseas continuar explorando?`
        : `-# Has sucumbido ante **${enemyName}**...\n\n-# ¿Deseas continuar explorando de todos modos?`;

    const gifUrl = isWin
        ? "https://c.tenor.com/FDQMqVd1Eo0AAAAd/tenor.gif"
        : "https://c.tenor.com/GpeoeGe1yiMAAAAd/tenor.gif";

    const jsonComponents = [
        { "type": 10, "content": titleText },
        { "type": 10, "content": descriptionText },
        { "type": 14, "divider": true, "spacing": 1 },
        {
            "type": 12,
            "items": [{ "media": { "url": gifUrl }, "description": null, "spoiler": false }]
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
                },
                {
                    "type": 2,
                    "style": 4,
                    "label": "Dejar de explorar",
                    "emoji": { "name": "TuxedoSamTired", "id": "1350682023370555454" },
                    "disabled": false,
                    "custom_id": crearCustomId({
                        action: "exOp",
                        userId: interaction.user.id,
                        characterId: soul._id,
                        extras: [`surrend`, `${subzonaKey}`]
                    })
                }
            ]
        }
    ];

    const subzonaObj = { nombre: cache.actualName || "Exploración" };
    const finalComponents = await generateMessage(cache, currentSoul, subzonaObj, jsonComponents, true);

    try {
        await interaction.user.send({
            content: `El duelo ha finalizado. Puedes continuar explorando.\n-# [Haz click aquí para ir al mensaje de exploración](https://discord.com/channels/${cache.message.guildId}/${cache.message.channelId}/${cache.message.id})`
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
            return interaction.reply({ content: "Error al iniciar el duelo [Mensaje no encontrado]", ephemeral: true }).catch(() => { });
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

        if (sesion) {
            sesion.state = "ACTIVO";
            sesion.addLog("inicio", "El duelo de exploración ha comenzado");

            sesion.once("combateFinalizado", async (datos) => {
                const uuidCache = transaccionCache.getUser(interaction.user.id);
                const explorationCache = transaccionCache.get(uuidCache?.explorarID);

                // Esperar 4.5s para permitir a duelManager y rewardCalculator procesar recompensas en DB
                await sleep(4500);

                const charId = character._id ?? character.ID ?? interaction.user.id;
                const isWinner = datos.arrayWinner?.some(w => String(w.ID || w._id) === String(charId));

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
    if (!exploracionCache) return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true });

    if (exploracionCache.message?.id && interaction.message?.id && exploracionCache.message.id !== interaction.message.id) {
        return interaction.reply({ content: "No puedes interactuar con esta opción porque ya ha caducado ＞﹏＜", ephemeral: true });
    }

    const region = await regiones.findOne({ _id: exploracionCache.regionSelect });
    const subzonaSelect = region?.areas?.[exploracionCache.zona]?.subzonas?.[exploracionCache.subzona];

    const enemy = await npcs.findOne({ _id: `${enemyId}` });
    const MdAuthor = await interaction.user.createDM();
    let message;
    exploracionCache.actualName = subzonaSelect?.nombre || "Zona";

    try {
        message = await interaction.channel.messages.fetch(`${exploracionCache.message.id}`);
        if (!message) return interaction.reply({ content: "Esta interacción ya no es válida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true });

        await MdAuthor.send({ content: "-# Comprobando DM...\n-# Este mensaje se borra automáticamente", flags: ["SuppressNotifications"] })
            .then(m => setTimeout(() => m.delete(), 3000));
    } catch (error) {
        return interaction.reply({ content: "No puedes iniciar un duelo si tienes los **mensajes directos** desactivados.\n-# Intenta activar 'Mensajes directos de otros' o pide ayuda en el foro <#1064054917662265404>", ephemeral: true });
    }

    if (!enemy) {
        return interaction.reply({ content: "Hubo un error al cargar el duelo. [Enemigo no encontrado]\n-# Intenta cancelar el encuentro o contacta a soporte...", ephemeral: true });
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
        const gifrunSelect = "https://c.tenor.com/MMA6_WvqS60AAAAd/tenor.gif";

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
                { "type": 12, "items": [{ "media": { "url": "https://c.tenor.com/dCBeOkxsWdoAAAAd/tenor.gif" }, "description": null, "spoiler": false }] }
            ];

            const isSuccessComponents = await generateMessage(exploracionCache, soul, subzonaSelect[0], jsonSuccess, true);
            await editarOMandarMensaje(interaction, exploracionCache, message, { components: isSuccessComponents, flags: ["IsComponentsV2"] });

            await sleep(5000);
            const exploracionManager = require("./exploracionManager");
            await exploracionManager.ejecutarAccionExploracion({ client, interaction, character: null, soul, areaSelect: exploracionCache.subzona, interact: "continue" });
        } else {
            const { character, soul: resolvedSoul } = await obtenerPersonajeYAlma(interaction, exploracionCache);
            if (resolvedSoul) soul = resolvedSoul;
            const gifSelect = "https://c.tenor.com/tpSxlupzrQkAAAAd/tenor.gif";
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
        const jsonAccept = [
            { "type": 10, "content": `# Has aceptado el duelo` },
            { "type": 10, "content": `-# Preparando el duelo...` },
            { "type": 14, "divider": true, "spacing": 1 },
            { "type": 12, "items": [{ "media": { "url": "https://c.tenor.com/4_zEp4wugDoAAAAC/tenor.gif" }, "description": null, "spoiler": false }] }
        ];

        const { character, soul: resolvedSoul } = await obtenerPersonajeYAlma(interaction, exploracionCache);
        if (resolvedSoul) soul = resolvedSoul;

        if (!character || !soul) {
            return interaction.reply({ content: "No se ha podido obtener tu personaje.", ephemeral: true });
        }

        const messageDuel = await generateMessage(exploracionCache, soul, subzonaSelect[0], jsonAccept, true);
        await editarOMandarMensaje(interaction, exploracionCache, message, { components: messageDuel, flags: ["IsComponentsV2"] });

        const data = {
            messageGif: "https://c.tenor.com/4_zEp4wugDoAAAAC/tenor.gif",
            MdAuthor: MdAuthor
        };

        await startBattle(client, interaction, character, soul, enemy, data, cache?.explorarID);
    }
}

module.exports = { battleSwitch, startBattle, resumeExploration, formatRewardsText };
