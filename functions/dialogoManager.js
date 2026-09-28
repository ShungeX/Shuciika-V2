const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { despertarAlma } = require('../interaction/selectMenus/Rol/Despertar options.js');
const { crearCustomId } = require('../utils/constructores/customId');

class DialogueSystem {

    constructor() {
        try {
            this.dialogues = {
                general: require('./../data/dialogos/generales.json'),
                missions: require('./../data/dialogos/misiones.json'),
                events: require('./../data/dialogos/eventos.json')
            };
        } catch (error) {
            console.error("Error al cargar archivos JSON estáticos de diálogos:", error.message);
            this.dialogues = { general: [], missions: [], events: [] };
        }

        // Caché en memoria de diálogos procedentes de MongoDB (Rol_db.Dialogos)
        this.dbDialogues = new Map();

        this.activeDialogues = new Map();
        this.client = null;

        // Tabla de despacho (objeto/mapa comando -> handler) para parámetros/comandos especiales de diálogos
        this.commandHandlers = new Map();

        // Registrar los handlers por defecto
        this.registerCommandHandler('show_inventory', this.handleShowInventory.bind(this));
        this.registerCommandHandler('close_inventory', this.handleCloseInventory.bind(this));
        this.registerCommandHandler('resume_exploracion', this.handleResumeExploracion.bind(this));
        this.registerCommandHandler('dar_item', this.handleDarItem.bind(this));
        this.registerCommandHandler('show_perfil', this.handleShowPerfil.bind(this));
        this.registerCommandHandler('show_guía_principiante', this.handleShowGuiaPrincipiante.bind(this));
        this.registerCommandHandler('show_guia_principiante', this.handleShowGuiaPrincipiante.bind(this));
        this.registerCommandHandler('boton', async () => '');
        this.registerCommandHandler('ephemeral', async () => '');
    }

    init(client) {
        this.client = client;
        console.log("💬 [DialogueSystem] Conectado al Client exitosamente.");
    }

    /**
     * Carga todos los diálogos almacenados en Rol_db.Dialogos desde MongoDB a la memoria local.
     */
    async cargarDialogosDesdeDB(dbClient) {
        if (!dbClient) return;
        try {
            const dbRol = dbClient.db("Rol_db");
            const col = dbRol.collection("Dialogos");
            const docs = await col.find({}).toArray();

            this.dbDialogues.clear();
            for (const doc of docs) {
                const idKey = String(doc._id || doc.id);
                this.dbDialogues.set(idKey, doc);
            }
            console.log(`💬 [DialogueSystem] ${this.dbDialogues.size} eventos de diálogo cargados localmente desde MongoDB (Rol_db.Dialogos).`);
        } catch (err) {
            console.error("⚠️ [DialogueSystem] Error cargando diálogos desde MongoDB:", err.message);
        }
    }

    /**
     * Refresca un diálogo en la memoria local en tiempo real cuando se guarda desde el Dashboard.
     */
    refrescarDialogoLocal(dialogoId, data) {
        if (!dialogoId) return;
        if (data) {
            const idKey = String(dialogoId);
            this.dbDialogues.set(idKey, data);
            console.log(`🔄 [DialogueSystem] Diálogo local '${idKey}' actualizado dinámicamente.`);
        }
    }

    /**
     * Elimina un diálogo de la memoria local cuando se elimina en el Dashboard.
     */
    eliminarDialogoLocal(dialogoId) {
        if (!dialogoId) return;
        const idKey = String(dialogoId);
        this.dbDialogues.delete(idKey);
        console.log(`🗑️ [DialogueSystem] Diálogo local '${idKey}' eliminado dinámicamente.`);
    }

    /**
     * Busca un diálogo por su ID (dando prioridad a la caché de MongoDB).
     */
    obtenerDialogoPorId(type, dialogueId) {
        const idStr = String(dialogueId);
        if (this.dbDialogues.has(idStr)) {
            return this.dbDialogues.get(idStr);
        }
        if (type && this.dialogues[type]) {
            return this.dialogues[type].find(d => String(d.id || d._id) === idStr);
        }
        for (const cat in this.dialogues) {
            const found = this.dialogues[cat]?.find(d => String(d.id || d._id) === idStr);
            if (found) return found;
        }
        return null;
    }

    registerCommandHandler(commandName, handlerFn) {
        this.commandHandlers.set(commandName, handlerFn);
    }

    // ==========================================
    // HANDLERS DE LA TABLA DE DESPACHO
    // ==========================================

    async handleDarItem(param, { interaction, user }) {
        if (!param) return '';
        try {
            const lastUnderscore = param.lastIndexOf('_');
            if (lastUnderscore === -1) return '';
            const region = param.substring(0, lastUnderscore);
            const itemId = Number(param.substring(lastUnderscore + 1));

            const clientdb = require('../Server');
            const dbRol = clientdb.db("Rol_db");
            const bdobjeto = dbRol.collection("Objetos_globales");
            const personajes = dbRol.collection("Personajes");

            const objetoDoc = await bdobjeto.findOne({ _id: region, "Objetos.ID": Number(itemId) });
            const objfind = objetoDoc?.Objetos?.find(o => Number(o.ID) === Number(itemId));

            const charDoc = await this.obtenerPersonajeActivo(user.id, userData?.charId);
            if (charDoc) {
                const updateInventario = require('./updateInventario');
                const clientObj = this.client || interaction?.client || require('../bot');
                await updateInventario(clientObj, interaction, charDoc._id, {
                    isItem: true,
                    ID: itemId,
                    Region: region,
                    Nombre: objfind?.Nombre || 'Objeto',
                    Tipo: objfind?.Tipo || [],
                    cantidad: 1
                });
                console.log(`[dialogoManager] {dar_item} Objeto ${region}_${itemId} otorgado a personaje activo ${charDoc._id}`);
            }
        } catch (err) {
            console.error('[dialogoManager] Error en handler dar_item:', err);
        }
        return '';
    }

    async handleShowInventory(param, { interaction, user, userData }) {
        try {
            const clientdb = require('../Server');
            const dbRol = clientdb.db("Rol_db");
            const personajes = dbRol.collection("Personajes");

            const charDoc = await this.obtenerPersonajeActivo(user.id, userData?.charId);
            const inventario = charDoc?.economia?.Inventario || charDoc?.Inventario || [];
            const itemsValidos = inventario.filter(i => Number(i.Cantidad ?? i.cantidad ?? 0) > 0);

            let descText = "";
            if (itemsValidos.length === 0) {
                descText = "🎒 **Inventario:** *(Vacío)*";
            } else {
                descText = "🎒 **Objetos en tu inventario:**\n\n" + itemsValidos.slice(0, 15).map(item => {
                    const qty = item.Cantidad ?? item.cantidad ?? 1;
                    return `• **${item.Nombre}** (x${qty}) — *[${item.Region || 'Global'} / ID: ${item.ID}]*`;
                }).join('\n');
                if (itemsValidos.length > 15) {
                    descText += `\n\n*...y ${itemsValidos.length - 15} objeto(s) más.*`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`📦 Inventario de ${charDoc?.Nombre || user.username}`)
                .setDescription(descText)
                .setColor('#8ee5f5')
                .setTimestamp();

            const md = await user.createDM();
            const invMsg = await md.send({ embeds: [embed] });

            if (invMsg?.id && userData) {
                userData.savedMessages['inventory_ref'] = invMsg.id;
                this.activeDialogues.set(user.id, userData);
            }
        } catch (err) {
            console.error('[dialogoManager] Error en handler show_inventory:', err);
        }
        return '';
    }

    async handleCloseInventory(param, { user, userData }) {
        try {
            const invMsgId = userData?.savedMessages?.['inventory_ref'];
            if (invMsgId) {
                const md = await user.createDM();
                try {
                    const invMsg = await md.messages.fetch(invMsgId);
                    if (invMsg) await invMsg.delete();
                } catch (e) {
                    console.error('[dialogoManager] No se pudo borrar el mensaje de inventario:', e.message);
                }
                delete userData.savedMessages['inventory_ref'];
                if (userData) {
                    this.activeDialogues.set(user.id, userData);
                }
            }
        } catch (err) {
            console.error('[dialogoManager] Error en handler close_inventory:', err);
        }
        return '';
    }

    async handleShowPerfil(param, { user, userData, messageOptions }) {
        try {
            const { construirPerfilV2 } = require('../handlers/CMDHandler/Rol/Personajes/Perfil');
            let charDoc = userData?.charDoc;
            if (!charDoc && user) {
                const targetCharId = userData?.context?.characterId || userData?.charId || userData?.soulId;
                charDoc = await this.obtenerPersonajeActivo(user.id, targetCharId);
                if (charDoc && userData) userData.charDoc = charDoc;
            }

            if (charDoc) {
                const perfilV2 = construirPerfilV2(charDoc, user.id);
                if (messageOptions) {
                    messageOptions.components = perfilV2;
                    messageOptions.flags = ["IsComponentsV2", "SuppressNotifications"];
                }
            } else {
                console.warn(`[dialogoManager] {show_perfil}: No se encontró personaje para usuario ${user?.id}`);
            }
        } catch (err) {
            console.error('[dialogoManager] Error en handler show_perfil:', err);
        }
        return '';
    }

    async handleShowGuiaPrincipiante(param, options = {}) {
        const { interaction, user, userData, messageOptions } = options;
        try {
            const { crearCustomId } = require('../utils/constructores/customId');

            let charDoc = userData?.charDoc;
            if (!charDoc && (user || interaction)) {
                const uId = user?.id || interaction?.user?.id;
                const targetCharId = userData?.context?.characterId || userData?.charId || userData?.soulId || (param && param.trim() ? param.trim() : null);
                charDoc = await this.obtenerPersonajeActivo(uId, targetCharId);
                if (charDoc && userData) userData.charDoc = charDoc;
            }

            const id = charDoc?._id || userData?.context?.characterId || userData?.charId || userData?.soulId || (param && param.trim() ? param.trim() : '');
            const targetUserId = user?.id || interaction?.user?.id || userData?.context?.userId || (charDoc?.ownerID ? String(charDoc.ownerID) : '');
            const perfil = charDoc?.perfil || {};
            if (!perfil.Nombre) {
                perfil.Nombre = charDoc?.Nombre || userData?.context?.nombre || user?.displayName || user?.username || 'Estudiante';
            }

            const guiaOficial = [
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
                                            "url": "https://i.pinimg.com/736x/9e/e7/d3/9ee7d3a8aba958ea3cee267f469bc9df.jpg"
                                        },
                                        "description": null,
                                        "spoiler": false
                                    },
                                    "components": [
                                        {
                                            "type": 10,
                                            "content": "# Ficha académica verificada"
                                        },
                                        {
                                            "type": 10,
                                            "content": `*Estimado/a ${perfil.Nombre}*\n\nTras una cuidadosa revisión de tu solicitud de admisión, nos complace informarte que tu registro ha sido **validado y aceptado** por el instituto.\n\nUn gran viaje de conocimiento y poder te espera entre nuestros muros. A partir de este momento, eres oficialmente aprendiz de las artes arcanas. Que tus estudios sean fructíferos y tu lealtad a los principios que nos rigen sea tan brillante como tu propia magia. \n\n**¡Bienvenido/a a tu nuevo hogar!**`
                                        }
                                    ]
                                },
                                {
                                    "type": 14,
                                    "divider": true,
                                    "spacing": 2
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Tus Herramientas Mágicas ** \n- -# Tu conexión con el instituto ha sido activada. Ahora puedes usar los comandos de rol `(/rol + comando)` para interactuar con el mundo. Comienza por consultar tu perfil con `/rol perfil` en el canal de comandos."
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Tu Identidad Institucional ** \n- -# Se te han asignado roles que reflejan tu información. Estas credenciales te otorgan acceso formal a las dependencias, aulas y zonas comunes del instituto."
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Siguientes Pasos ** \n- -# Para asegurar una transición fluida y honorable a tu nueva vida en el instituto, te instamos a familiarizarte con los siguientes recursos:"
                                },
                                {
                                    "type": 1,
                                    "components": [
                                        {
                                            "type": 2,
                                            "style": 5,
                                            "label": "Normas del rol",
                                            "emoji": null,
                                            "disabled": false,
                                            "url": "https://discord.com/channels/716342375303217285/716865470648680448"
                                        },
                                        {
                                            "type": 2,
                                            "style": 2,
                                            "label": "Canales principales",
                                            "emoji": null,
                                            "disabled": false,
                                            "custom_id": crearCustomId({
                                                action: "informacionRol",
                                                characterId: id,
                                                userId: targetUserId,
                                                extras: ["null", "chprincipales"]
                                            })
                                        },
                                        {
                                            "type": 2,
                                            "style": 2,
                                            "label": "Primeros pasos",
                                            "emoji": null,
                                            "disabled": false,
                                            "custom_id": crearCustomId({
                                                action: "informacionRol",
                                                characterId: id,
                                                userId: targetUserId,
                                                extras: ["null", "inicioRol"]
                                            })
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
                                    "content": `-# Ficha revisada y verificada por la Administración del Instituto | Instituto mágico Shuciika`
                                }
                            ]
                        }
                    ];

            if (messageOptions) {
                messageOptions.components = guiaOficial;
                messageOptions.flags = ["IsComponentsV2", "SuppressNotifications"];
            }
        } catch (err) {
            console.error('[dialogoManager] Error en handler show_guía_principiante:', err);
        }
        return '';
    }

    async crearMensajeExploracionSilencioso(interaction, user, areaExplorar = "TOB-001", soul = null) {
        try {
            const clientdb = require('../Server');
            const dbRol = clientdb.db("Rol_db");
            const regiones = dbRol.collection("Regiones");
            const transaccionCache = require('../utils/cache');
            const configServer = require('../config');
            const { recargarEnergia } = require('./dataCharacters.js');
            const { barrasDeEnergia } = require('../utils/utilidadesTexto.js');
            const { v4: uuidv4 } = require('uuid');

            const region = await regiones.findOne({ _id: areaExplorar }) || await regiones.findOne({});
            if (!region) return null;

            if (!soul && user) {
                const userDoc = await clientdb.db("Server_db").collection("usuarios_server").findOne({ _id: String(user.id) });
                const pId = userDoc?.usuario?.nix?.personajeActivo || userDoc?.nix?.personajeActivo;
                if (pId) {
                    soul = await dbRol.collection("Soul").findOne({ _id: Number(pId) }) || await dbRol.collection("Soul").findOne({ _id: String(pId) });
                }
            }

            const characterEnergy = soul ? await recargarEnergia(soul.nucleo?.energy ?? 0, soul) : configServer.maxEnergy;

            const components = [
                {
                    "type": 10,
                    "content": `# Sistema de exploración \n-# *Explorando la región de:  *\`${region.Nombre}\`\n-# Energia: ${barrasDeEnergia(characterEnergy, configServer.maxEnergy)}`
                },
                {
                    "type": 10,
                    "content": "-# *¿Qué zona vamos a explorar hoy?* ( •̀ ω •́ )y"
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 2
                }
            ];

            if (region.areas && typeof region.areas === 'object') {
                Object.keys(region.areas).forEach(key => {
                    const area = region.areas[key];
                    const isHabilitado = area.habilitado ? `(${area.energiaNecesaria} de energía)` : "[Deshabilitado]";
                    let subzonasText = "";

                    if (area.subzonas && Object.keys(area.subzonas).length > 0) {
                        const nombresZonas = Object.values(area.subzonas).map(s => s.nombre);
                        subzonasText = `-# - - *Sub-zonas: [${nombresZonas.join(", ")}]*`;
                    }

                    if (area.habilitado) {
                        components.push({
                            "type": 9,
                            "accessory": {
                                "type": 2,
                                "style": 3,
                                "label": "¡Explorar!",
                                "emoji": area.emoji ? { name: area.emoji, id: null } : null,
                                "disabled": false,
                                "custom_id": crearCustomId({
                                    action: "exOp",
                                    userId: user.id,
                                    extras: ["zona", `${key}`]
                                })
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": `-# - ***${area.Nombre}*** ${isHabilitado}\n-# ${area.descripcion ? `*${area.descripcion}*` : ""}\n${subzonasText}`
                                }
                            ]
                        });
                    } else {
                        components.push({
                            "type": 9,
                            "accessory": {
                                "type": 2,
                                "style": 2,
                                "label": "No disponible",
                                "emoji": null,
                                "disabled": true,
                                "custom_id": `explorar_${key}`
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": `-# - ***${area.Nombre}*** ${isHabilitado}\n${subzonasText}`
                                }
                            ]
                        });
                    }
                });
            }

            components.push(
                { "type": 14, "divider": true, "spacing": 1 },
                {
                    "type": 12,
                    "items": [{ "media": { "url": "https://c.tenor.com/OJ6jmNtTflcAAAAd/tenor.gif" }, "description": null, "spoiler": false }]
                },
                { "type": 10, "content": "-# Tu energía se actualiza antes de iniciar una exploración. (10 min > 1 punto de energía.)" }
            );

            const v2Exploracion = [{ "type": 17, "accent_color": null, "spoiler": false, "components": components }];
            const transaccionId = uuidv4().replace(/-/g, "");

            let targetChannel = interaction?.channel;
            if (!targetChannel && interaction?.channelId) {
                const clientObj = interaction?.client || require('../bot');
                try { targetChannel = await clientObj.channels.fetch(interaction.channelId); } catch (e) {}
            }

            if (!targetChannel) return null;

            const message = await targetChannel.send({ components: v2Exploracion, flags: ["IsComponentsV2", "SuppressNotifications"] });

            const charId = soul ? (soul._id ?? soul.id ?? soul.ID) : null;
            const obj = {
                regionSelect: areaExplorar,
                regionNombre: region.Nombre,
                message: message,
                messageID: message.id,
                characterId: charId
            };

            await transaccionCache.set(transaccionId, obj);
            await transaccionCache.setUser(user.id, { explorarID: transaccionId });

            return obj;
        } catch (err) {
            console.error('[dialogoManager] Error al crear mensaje de exploración silencioso:', err);
            return null;
        }
    }

    async handleResumeExploracion(param, { interaction, user, userData, context }) {
        try {
            const transaccionCache = require('../utils/cache');
            let userCache = transaccionCache.getUser(user.id);
            let messageData = userCache?.explorarID ? transaccionCache.get(userCache.explorarID) : null;

            if (!messageData && user) {
                const areaSelect = context?.areaExplorar || "TOB-001";
                const created = await this.crearMensajeExploracionSilencioso(interaction, user, areaSelect, context?.soul);
                if (created) {
                    messageData = created;
                }
            }

            if (messageData && messageData.message && messageData.message.id && messageData.message.channelId) {
                const guildId = messageData.message.guildId || interaction?.guildId || '@me';
                const channelId = messageData.message.channelId;
                const messageId = messageData.message.id;
                const link = `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
                return `Puedes continuar la exploración. [Haz click aquí para ir al mensaje de exploración](${link})`;
            }
        } catch (err) {
            console.error('[dialogoManager] Error en handler resume_exploracion:', err);
        }
        return "Usa /rol exploracion para iniciar una nueva exploración";
    }

    /**
     * Obtiene el personaje activo del usuario desde Server_db.usuarios_server (usuario.nix.personajeActivo).
     * Si no existe o no se encuentra, utiliza fallback por ownerID.
     */
    async obtenerPersonajeActivo(userId, explicitCharId = null) {
        try {
            const clientdb = require('../Server');
            const dbServer = clientdb.db("Server_db");
            const dbRol = clientdb.db("Rol_db");

            if (explicitCharId) {
                const numId = Number(explicitCharId);
                const query = isNaN(numId) ? { _id: String(explicitCharId) } : { $or: [{ _id: numId }, { _id: String(explicitCharId) }] };
                const charExplicit = await dbRol.collection("Personajes").findOne(query);
                if (charExplicit) return charExplicit;
            }

            const userDoc = await dbServer.collection("usuarios_server").findOne({ _id: String(userId) });

            const pId = userDoc?.usuario?.nix?.personajeActivo || userDoc?.nix?.personajeActivo;
            if (pId) {
                const numPId = Number(pId);
                const charActive = await dbRol.collection("Personajes").findOne({ _id: isNaN(numPId) ? String(pId) : numPId });
                if (charActive) return charActive;
            }

            const numUserId = Number(userId);
            const queryOwner = isNaN(numUserId) ? { ownerID: String(userId) } : { $or: [{ ownerID: String(userId) }, { ownerID: numUserId }] };
            const fallbackChar = await dbRol.collection("Personajes").findOne(queryOwner);
            return fallbackChar;
        } catch (err) {
            console.error('[dialogoManager] Error en obtenerPersonajeActivo:', err);
            return null;
        }
    }

    async checkFirstExploracion(interaction, soul, member, options = {}) {
        const user = interaction?.user || member;
        if (!soul || !user) return false;

        const clientdb = require('../Server');
        const dbRol = clientdb.db("Rol_db");
        const soulId = soul._id || soul.id || soul.ID;

        const numSoulId = Number(soulId);
        const soulQuery = isNaN(numSoulId) ? { _id: String(soulId) } : { $or: [{ _id: numSoulId }, { _id: String(soulId) }] };
        const soulDoc = await dbRol.collection("Soul").findOne(soulQuery);
        const isApplied = soulDoc?.registros?.firstExploracion?.aplicado ?? soul?.registros?.firstExploracion?.aplicado;

        if (isApplied === true) {
            return false;
        }

        // Iniciar el diálogo de primera exploración.
        // NOTA IMPORTANTE: 'aplicado: true' se establecerá SOLAMENTE al FINALIZAR el diálogo completamente.
        await this.startDialogue("general", "first_exploracion", interaction, member, {
            ...options,
            isFirstExploracion: true,
            soulId: soulId,
            charId: soulId
        });

        return true;
    }

    async recordDialogueCompletion(userId, dialogueId, progreso = 0, finalizado = true, explicitCharId = null) {
        try {
            const char = await this.obtenerPersonajeActivo(userId, explicitCharId);
            if (!char) return;

            const clientdb = require('../Server');
            const dbRol = clientdb.db("Rol_db");
            const personajes = dbRol.collection("Personajes");

            const fechaActual = new Date();
            const eventosArray = char.estado?.eventosDialogos || [];
            const existingEntry = eventosArray.find(e => e.ID === dialogueId);
            const existingIndex = eventosArray.findIndex(e => e.ID === dialogueId);

            const currentRepetido = Number(existingEntry?.repetido || 0);
            const newRepetido = finalizado ? currentRepetido + 1 : currentRepetido;

            if (existingIndex !== -1) {
                await personajes.updateOne(
                    { _id: char._id, "estado.eventosDialogos.ID": dialogueId },
                    {
                        $set: {
                            "estado.eventosDialogos.$.fecha": fechaActual,
                            "estado.eventosDialogos.$.finalizado": Boolean(finalizado),
                            "estado.eventosDialogos.$.progreso": Number(progreso || 0),
                            "estado.eventosDialogos.$.repetido": Number(newRepetido)
                        }
                    }
                );
            } else {
                const entry = {
                    ID: dialogueId,
                    fecha: fechaActual,
                    finalizado: Boolean(finalizado),
                    progreso: Number(progreso || 0),
                    repetido: finalizado ? 1 : 0
                };
                await personajes.updateOne(
                    { _id: char._id },
                    {
                        $push: {
                            "estado.eventosDialogos": entry
                        }
                    }
                );
            }
            console.log(`[dialogoManager] Diálogo '${dialogueId}' registrado en personaje ${char._id} (finalizado: ${finalizado}, repetido: ${newRepetido})`);
        } catch (err) {
            console.error('[dialogoManager] Error al registrar diálogo finalizado en Personajes:', err);
        }
    }

    // ==========================================
    // PROCESAMIENTO Y PARSEADO DE DIÁLOGOS
    // ==========================================

    async startDialogue(type, dialogueId, interaction, member, options = {}) {
        const user = interaction?.user || member;
        let dialogue = this.obtenerDialogoPorId(type, dialogueId);

        if (!dialogue) {
            try {
                const clientdb = require('../Server');
                const dbRol = clientdb.db("Rol_db");
                const doc = await dbRol.collection("Dialogos").findOne({
                    $or: [{ _id: dialogueId }, { id: dialogueId }, { _id: String(dialogueId) }]
                });
                if (doc) {
                    this.dbDialogues.set(String(doc._id || doc.id), doc);
                    dialogue = doc;
                }
            } catch (err) {
                console.error('[dialogoManager] Fallback consulta DB diálogo error:', err);
            }
        }

        if (!dialogue) {
            console.error(`Diálogo no encontrado: ${dialogueId} en ${type}`);
            return false;
        }

        // 1. Verificar límite de ejecuciones (limite) vs repetido en personaje activo
        const charDoc = await this.obtenerPersonajeActivo(user.id, options.charId || options.soulId);

        if (charDoc) {
            const eventosArray = charDoc.estado?.eventosDialogos || [];
            const existingEntry = eventosArray.find(e => e.ID === dialogueId);
            const repetido = existingEntry?.repetido || 0;
            const limite = dialogue.limite;

            if (limite !== null && limite !== undefined && Number(limite) > 0 && repetido >= Number(limite)) {
                if (interaction) {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: "Has alcanzado el límite de ejecuciones para este diálogo.", flags: ["Ephemeral"] });
                    } else {
                        await interaction.followUp({ content: "Has alcanzado el límite de ejecuciones para este diálogo.", flags: ["Ephemeral"] });
                    }
                }
                return { success: false, error: "Límite alcanzado" };
            }
        }

        if (this.activeDialogues.get(user.id)) {
            if (!interaction) {
                return { success: false, error: "Ya hay un dialogo activo" };
            }
            return interaction.reply({ content: "Ya hay un dialogo activo", flags: ["Ephemeral"] });
        }

        if (dialogue?.requisitos && !this.checkRequirements(dialogue?.requisitos, user.id, options)) {
            return false;
        }

        const targetObj = typeof dialogue.canal === 'object' ? (dialogue.canal?.Objetivo || "MD") : (dialogue.canal || "MD");
        const channelId = typeof dialogue.canal === 'object' ? (dialogue.canal?.ID || null) : null;

        this.activeDialogues.set(user.id, {
            type,
            dialogueId,
            currentStep: 0,
            messageIds: [],
            context: options.context || {},
            datems: options.context?.code,
            savedMessages: {},
            messageQueue: [],
            targetObj,
            channelId,
            limite: dialogue.limite ?? null,
            isFirstExploracion: Boolean(options.isFirstExploracion || dialogueId === 'first_exploracion'),
            soulId: options.soulId || null,
            charDoc: charDoc || null
        });

        // Si el objetivo es MD y viene de una interacción en un canal
        if (targetObj === "MD" && interaction) {
            const isAlreadyInDM = !interaction.guildId || Boolean(interaction.channel?.isDMBased?.());
            if (!isAlreadyInDM) {
                const customMsg = dialogue.mensajeMDPersonalizado;
                let replyContent = "";
                if (customMsg) {
                    const contextData = { interaction, user, userData: this.activeDialogues.get(user.id), context: options.context || {} };
                    replyContent = await this.parseTextAsync(customMsg, contextData);
                } else {
                    replyContent = "Revisa tus mensajes directos. Alguien tiene algo que decirte. Haz click aquí para ir al mensaje";
                }

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: replyContent, flags: ["Ephemeral"] });
                } else {
                    await interaction.followUp({ content: replyContent, flags: ["Ephemeral"] });
                }
            } else {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferUpdate().catch(() => {});
                }
            }

            const waitSeconds = Number(dialogue.cooldownEspera) > 0 ? Number(dialogue.cooldownEspera) : 5;
            const md = await user.createDM();
            const waitMsg = await md.send({ content: "-# Dale un instante a la magia para acomodarse." });

            if (waitMsg?.id) {
                const currentActive = this.activeDialogues.get(user.id);
                if (currentActive) {
                    currentActive.savedMessages['cooldownWaitMsg'] = waitMsg.id;
                    this.activeDialogues.set(user.id, currentActive);
                }
            }

            setTimeout(async () => {
                const activeData = this.activeDialogues.get(user.id);
                if (activeData?.savedMessages?.['cooldownWaitMsg']) {
                    try {
                        const cWaitMsg = await md.messages.fetch(activeData.savedMessages['cooldownWaitMsg']);
                        if (cWaitMsg) await cWaitMsg.delete();
                    } catch (e) {
                        console.error('[dialogoManager] Error borrando mensaje de espera cooldown:', e.message);
                    }
                    delete activeData.savedMessages['cooldownWaitMsg'];
                }
                await this.processNextStep(interaction, user);
            }, waitSeconds * 1000);

            return true;
        }

        await this.processNextStep(interaction, user);
        return true;
    }

    async processNextStep(interaction, member) {
        const user = interaction?.user || member;
        const userData = this.activeDialogues.get(user.id);

        if (!userData) return false;

        if (userData.skipTimeout) {
            clearTimeout(userData.skipTimeout);
            delete userData.skipTimeout;
        }

        const dialogue = this.obtenerDialogoPorId(userData.type, userData.dialogueId);
        const stepsList = dialogue?.dialogos || dialogue?.steps || [];
        const currentDialogue = stepsList[userData.currentStep];

        if (!currentDialogue) {
            console.log(`[dialogoManager] Finalizando diálogo '${userData.dialogueId}' para usuario ${user.id}`);
            
            // Si era la primera exploración, marcar en la base de datos Soul 'aplicado = true' AHORA que terminó el diálogo
            if (userData.isFirstExploracion || userData.dialogueId === "first_exploracion") {
                try {
                    const clientdb = require('../Server');
                    const dbRol = clientdb.db("Rol_db");
                    let sId = userData.soulId || userData.charId;
                    if (!sId) {
                        const activeChar = await this.obtenerPersonajeActivo(user.id);
                        sId = activeChar?._id;
                    }
                    if (sId) {
                        const numSId = Number(sId);
                        const sQuery = isNaN(numSId) ? { _id: String(sId) } : { $or: [{ _id: numSId }, { _id: String(sId) }] };
                        await dbRol.collection("Soul").updateOne(
                            sQuery,
                            {
                                $set: {
                                    "registros.firstExploracion.aplicado": true,
                                    "registros.firstExploracion.fecha": new Date()
                                }
                            }
                        );
                        console.log(`✨ [dialogoManager] Primera exploración completada exitosamente. Registrado 'firstExploracion.aplicado = true' en Soul ${sId}.`);
                    }
                } catch (e) {
                    console.error('[dialogoManager] Error actualizando primeraExploracion en Soul:', e);
                }
            }

            this.activeDialogues.delete(user.id);
            if (dialogue?.onComplete) {
                this.executeActions(dialogue.onComplete, interaction, userData.context, user);
            }
            await this.recordDialogueCompletion(user.id, userData.dialogueId, userData.currentStep, true, userData.charId || userData.soulId);
            return true;
        }

        // 1. Mostrar/Enviar/Editar inmediatamente el mensaje del paso ACTUAL (Step N)
        if (currentDialogue.multipleMessages) {
            await this.processMultipleMessages(currentDialogue.multipleMessages, interaction, userData, user);
        } else {
            await this.sendEditMessage(currentDialogue, interaction, userData, 0, user);
        }

        const hasComponents = (Array.isArray(currentDialogue.components) && currentDialogue.components.length > 0) || (Array.isArray(currentDialogue.buttons) && currentDialogue.buttons.length > 0);

        // Si el paso tiene componentes (botones)
        if (hasComponents) {
            const stepToken = Date.now() + "_" + Math.random().toString(36).substring(2, 8);
            userData.stepLockToken = stepToken;
            userData.stepResolved = false;

            // Si esperarRespuesta es true: ignora pause/delay y espera indefinidamente al usuario
            if (currentDialogue.esperarRespuesta === true) {
                this.activeDialogues.set(user.id, userData);
                return true;
            }

            // Si esperarRespuesta es false: toma el pause/delay de respuesta como timeout
            const timeoutMs = Number(currentDialogue.delay) || Number(currentDialogue.skip) || 10000;
            const timeoutId = setTimeout(async () => {
                const active = this.activeDialogues.get(user.id);
                if (!active || active.stepLockToken !== stepToken || active.stepResolved) {
                    return;
                }
                active.stepResolved = true;
                delete active.skipTimeout;
                this.activeDialogues.set(user.id, active);

                console.log(`[dialogoManager] Timeout expirado de forma atómica para paso ${active.currentStep} en '${active.dialogueId}'`);

                const tAction = currentDialogue.timeoutAction || 'next';
                if (tAction === 'jump' && currentDialogue.timeoutTarget !== undefined) {
                    await this.jumpToStep(user.id, Number(currentDialogue.timeoutTarget), interaction);
                } else if (tAction === 'next') {
                    if (currentDialogue.nextStep !== undefined && currentDialogue.nextStep !== null && currentDialogue.nextStep !== '') {
                        active.currentStep = Number(currentDialogue.nextStep);
                    } else {
                        active.currentStep++;
                    }
                    this.activeDialogues.set(user.id, active);
                    await this.processNextStep(interaction, user);
                } else {
                    // 'none': se queda sin avanzar
                }
            }, timeoutMs);

            userData.skipTimeout = timeoutId;
            this.activeDialogues.set(user.id, userData);
            return true;
        }

        // Si el paso NO tiene componentes: flujo normal con delay
        const currentDelay = Number(currentDialogue.delay) || 0;
        if (currentDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, currentDelay));
        }

        if (currentDialogue.nextStep !== undefined && currentDialogue.nextStep !== null && currentDialogue.nextStep !== '') {
            userData.currentStep = Number(currentDialogue.nextStep);
        } else {
            userData.currentStep++;
        }
        this.activeDialogues.set(user.id, userData);

        await this.processNextStep(interaction, user);

        return true;
    }

    async processMultipleMessages(messages, interaction, userData, member) {
        const user = interaction || member;
        const processPromises = messages.map((msg, index) => {
            return this.sendEditMessage(msg, interaction, userData, index, user);
        });
        await Promise.all(processPromises);
    }

    async sendEditMessage(dialogueData, interaction, userData, messageIndex = 0, member) {
        const user = interaction?.user || member;

        let targetChannel;
        if (userData?.targetObj === "Canal") {
            if (userData?.channelId) {
                const clientObj = this.client || interaction?.client || require('../bot');
                try {
                    targetChannel = await clientObj.channels.fetch(userData.channelId);
                } catch (e) {
                    console.error('[dialogoManager] No se pudo obtener canal especificado:', e);
                }
            }
            if (!targetChannel && interaction?.channel) {
                targetChannel = interaction.channel;
            }
            if (!targetChannel) {
                targetChannel = await user.createDM();
            }
        } else {
            targetChannel = await user.createDM();
        }

        const { savedMessages } = userData;
        const messageOptions = await this.buildMessageOptions(dialogueData, userData, interaction, user);

        const isEphemeral = Boolean(dialogueData.ephemeral) || 
            Boolean(dialogueData.action?.ephemeral) ||
            (dialogueData.content && dialogueData.content.includes('{ephemeral}')) ||
            (dialogueData.embeds && dialogueData.embeds.some(e => e.description?.includes('{ephemeral}') || e.title?.includes('{ephemeral}')));

        if (isEphemeral) {
            let message;
            if (interaction) {
                message = await interaction.followUp({ ...messageOptions, flags: ["Ephemeral"] });
            } else {
                message = await targetChannel.send(messageOptions);
            }
            return message;
        }

        const actionObj = dialogueData.action || (dialogueData.type ? { type: dialogueData.type } : null);
        if (!actionObj) return;

        const { type, guardar, target } = actionObj;

        let messageId = target ? savedMessages[target] : userData.messageIds[messageIndex];
        let message;

        try {
            switch (type) {
                case "edit":
                    try {
                        message = await targetChannel.messages.fetch(messageId);

                        // Si el paso de edición no tiene embeds, enviar array vacío [] para que Discord los elimine del mensaje
                        if (!messageOptions.embeds || messageOptions.embeds.length === 0) {
                            messageOptions.embeds = [];
                        }

                        // Si el paso de edición no tiene componentes (y no es IsComponentsV2), enviar array vacío [] para que Discord elimine los botones existentes
                        if (!messageOptions.flags?.includes("IsComponentsV2") && (!messageOptions.components || messageOptions.components.length === 0)) {
                            messageOptions.components = [];
                        }

                        // Verificar que no se intente editar un mensaje dejándolo completamente vacío (DiscordAPIError 50006)
                        const hasContent = typeof messageOptions.content === 'string' && messageOptions.content.trim().length > 0;
                        const hasEmbeds = Array.isArray(messageOptions.embeds) && messageOptions.embeds.length > 0;
                        const hasComponents = Array.isArray(messageOptions.components) && messageOptions.components.length > 0;
                        const hasFiles = Array.isArray(messageOptions.files) && messageOptions.files.length > 0;

                        if (!hasContent && !hasEmbeds && !hasComponents && !hasFiles) {
                            if (message.content && message.content.trim().length > 0) {
                                messageOptions.content = message.content;
                            } else {
                                messageOptions.content = "\u200B";
                            }
                        }

                        await message.edit(messageOptions);
                    } catch (error) {
                        console.error(`Error al editar mensaje: ${error}`);

                        if (!interaction) {
                            return { error: "La interacción ya no es válida 〒▽〒, el diálogo no puede continuar" };
                        }

                        message = await interaction.followUp({ ...messageOptions, fetchReply: true });
                        userData.messageIds[messageIndex] = message.id;
                        this.activeDialogues.set(user.id, userData);
                    }
                    break;
                case "send":
                    if (interaction && userData?.targetObj === "Canal") {
                        if (interaction.replied || interaction.deferred) {
                            message = await interaction.followUp({ ...messageOptions, fetchReply: true });
                        } else {
                            await interaction.deferReply({ flags: [dialogueData.ephemeral ? "Ephemeral" : ''] });
                            message = await interaction.editReply(messageOptions);
                        }
                    } else {
                        message = await targetChannel.send({ ...messageOptions });
                    }

                    if (guardar) {
                        userData.savedMessages[guardar] = message.id;
                    } else {
                        userData.messageIds[messageIndex] = message.id;
                    }

                    this.activeDialogues.set(user.id, userData);
                    break;
                case "delete":
                    try {
                        message = await targetChannel.messages.fetch(messageId);
                        await message.delete(messageOptions);
                        if (messageId) {
                            delete userData.savedMessages[target];
                        }
                    } catch (error) {
                        console.error(`Error al intentar borrar el mensaje: ${error}`);
                        if (interaction) {
                            await interaction.followUp({ content: "-# Se supone que se debería borrar el mensaje, pero no puedo.\n-# Shh, no le digas a nadie (>ᴗ•)", flags: ["Ephemeral"] });
                        }
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error(`Error en la acción de mensaje '${type}':`, error);
        }

        return message;
    }

    async buildMessageOptions(dialogueData, userData, interaction, user) {
        const messageOptions = {};
        const contextData = { interaction, user, userData, context: userData?.context || {}, messageOptions };

        if (dialogueData.content) {
            messageOptions.content = await this.parseTextAsync(dialogueData.content, contextData);
        }

        if (dialogueData.embeds && Array.isArray(dialogueData.embeds) && dialogueData.embeds.length > 0) {
            messageOptions.embeds = await Promise.all(dialogueData.embeds.map(async embed => {
                const embedBuilder = new EmbedBuilder();

                if (embed.title) {
                    const titleStr = await this.parseTextAsync(embed.title, contextData);
                    if (titleStr && titleStr.trim()) embedBuilder.setTitle(titleStr);
                }
                if (embed.description) {
                    const descStr = await this.parseTextAsync(embed.description, contextData);
                    if (descStr && descStr.trim()) embedBuilder.setDescription(descStr);
                }
                if (embed.color) {
                    try { embedBuilder.setColor(embed.color); } catch (e) {}
                }
                if (embed.footer) {
                    const fTextRaw = typeof embed.footer === 'string' ? embed.footer : (embed.footer.text || '');
                    const fTextParsed = await this.parseTextAsync(fTextRaw, contextData);
                    if (fTextParsed && fTextParsed.trim()) {
                        const fIconRaw = typeof embed.footer === 'object' ? (embed.footer.icon_url || embed.footer.iconURL) : undefined;
                        const fIconParsed = fIconRaw ? await this.parseTextAsync(fIconRaw, contextData) : undefined;
                        embedBuilder.setFooter({
                            text: fTextParsed,
                            iconURL: (fIconParsed && fIconParsed.trim()) ? fIconParsed : undefined
                        });
                    }
                }
                if (embed.thumbnail) {
                    const thumbUrlRaw = typeof embed.thumbnail === 'string' ? embed.thumbnail : (embed.thumbnail.url || '');
                    const thumbUrlParsed = thumbUrlRaw ? await this.parseTextAsync(thumbUrlRaw, contextData) : '';
                    if (thumbUrlParsed && thumbUrlParsed.trim() && (thumbUrlParsed.startsWith('http://') || thumbUrlParsed.startsWith('https://'))) {
                        embedBuilder.setThumbnail(thumbUrlParsed);
                    }
                }
                if (embed.image) {
                    const imgUrlRaw = typeof embed.image === 'string' ? embed.image : (embed.image.url || '');
                    const imgUrlParsed = imgUrlRaw ? await this.parseTextAsync(imgUrlRaw, contextData) : '';
                    if (imgUrlParsed && imgUrlParsed.trim() && (imgUrlParsed.startsWith('http://') || imgUrlParsed.startsWith('https://'))) {
                        embedBuilder.setImage(imgUrlParsed);
                    }
                }
                if (embed.author) {
                    const authNameRaw = typeof embed.author === 'string' ? embed.author : (embed.author.name || '');
                    const authNameParsed = await this.parseTextAsync(authNameRaw, contextData);
                    if (authNameParsed && authNameParsed.trim()) {
                        const authIconRaw = typeof embed.author === 'object' ? (embed.author.icon_url || embed.author.iconURL) : undefined;
                        const authIconParsed = authIconRaw ? await this.parseTextAsync(authIconRaw, contextData) : undefined;
                        const authUrlRaw = typeof embed.author === 'object' ? embed.author.url : undefined;
                        const authUrlParsed = authUrlRaw ? await this.parseTextAsync(authUrlRaw, contextData) : undefined;
                        embedBuilder.setAuthor({
                            name: authNameParsed,
                            iconURL: (authIconParsed && authIconParsed.trim()) ? authIconParsed : undefined,
                            url: (authUrlParsed && authUrlParsed.trim()) ? authUrlParsed : undefined
                        });
                    }
                }

                if (embed.fields && Array.isArray(embed.fields) && embed.fields.length > 0) {
                    const validFields = [];
                    for (const field of embed.fields) {
                        const fName = await this.parseTextAsync(field.name || '', contextData);
                        const fVal = await this.parseTextAsync(field.value || '', contextData);
                        if ((fName && fName.trim()) || (fVal && fVal.trim())) {
                            validFields.push({
                                name: (fName && fName.trim()) ? fName : '\u200B',
                                value: (fVal && fVal.trim()) ? fVal : '\u200B',
                                inline: Boolean(field.inline)
                            });
                        }
                    }
                    if (validFields.length > 0) {
                        embedBuilder.addFields(validFields);
                    }
                }

                return embedBuilder;
            }));
        } else if (dialogueData.action?.type === 'edit' || dialogueData.type === 'edit') {
            messageOptions.embeds = [];
        }

        const comps = (Array.isArray(dialogueData.components) && dialogueData.components.length > 0)
            ? dialogueData.components
            : ((Array.isArray(dialogueData.buttons) && dialogueData.buttons.length > 0) ? dialogueData.buttons : null);

        if (comps && comps.length > 0) {
            messageOptions.components = await this.buildComponentsAsync(comps, contextData);
        } else if (dialogueData.action?.type === 'edit' || dialogueData.type === 'edit') {
            if (!messageOptions.flags?.includes("IsComponentsV2") && !messageOptions.components) {
                messageOptions.components = [];
            }
        }

        if (dialogueData.files) {
            messageOptions.files = dialogueData.files;
        }

        if (messageOptions.content === "" && messageOptions.components?.length > 0) {
            delete messageOptions.content;
        }

        return messageOptions;
    }

    async buildComponentsAsync(components, contextData) {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        let currentComponents = 0;

        for (const component of components) {
            if (currentComponents >= 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                currentComponents = 0;
            }

            const isButton = component.type === 'BUTTON' || component.type === 'button' || !component.type || component.type === 2;
            if (isButton) {
                const rawCustomId = component.customId || component.custom_id || '';
                const rawLabel = component.label || component.text || 'Botón';

                const button = new ButtonBuilder()
                    .setCustomId(await this.parseTextAsync(rawCustomId, contextData))
                    .setLabel(await this.parseTextAsync(rawLabel, contextData));

                let btnStyle = ButtonStyle.Secondary;
                const rawStyle = component.style;
                if (rawStyle === 1 || rawStyle === '1' || rawStyle === 'primary' || rawStyle === 'Primary') {
                    btnStyle = ButtonStyle.Primary;
                } else if (rawStyle === 2 || rawStyle === '2' || rawStyle === 'secondary' || rawStyle === 'Secondary') {
                    btnStyle = ButtonStyle.Secondary;
                } else if (rawStyle === 3 || rawStyle === '3' || rawStyle === 'success' || rawStyle === 'Success') {
                    btnStyle = ButtonStyle.Success;
                } else if (rawStyle === 4 || rawStyle === '4' || rawStyle === 'danger' || rawStyle === 'Danger') {
                    btnStyle = ButtonStyle.Danger;
                } else if (rawStyle === 5 || rawStyle === '5' || rawStyle === 'link' || rawStyle === 'Link') {
                    btnStyle = ButtonStyle.Link;
                }
                button.setStyle(btnStyle);

                if (component.emoji) button.setEmoji(component.emoji);
                if (component.disabled) button.setDisabled(true);
                if (component.url) {
                    button.setURL(component.url);
                    button.setStyle(ButtonStyle.Link);
                }

                currentRow.addComponents(button);
                currentComponents++;
            } else if (component.type === 'SELECT_MENU' || component.type === 'selectMenu') {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(await this.parseTextAsync(component.customId, contextData))
                    .setPlaceholder(await this.parseTextAsync(component.placeholder, contextData))
                    .setMinValues(component.minValues || 1)
                    .setMaxValues(component.maxValues || 1)
                    .setDisabled(component.disabled || false);

                if (component.options) {
                    const options = await Promise.all(component.options.map(async option => ({
                        label: await this.parseTextAsync(option.label, contextData),
                        value: option.value,
                        description: option.description ? await this.parseTextAsync(option.description, contextData) : undefined,
                        emoji: option.emoji,
                        default: option.default || false
                    })));
                    selectMenu.addOptions(options);
                }

                currentRow.addComponents(selectMenu);
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                currentComponents = 0;
            }
        }

        if (currentComponents > 0) {
            rows.push(currentRow);
        }

        return rows;
    }

    async parseTextAsync(text, contextData) {
        if (!text) return '';
        const { interaction, user, userData } = contextData;
        const context = userData?.context || {};

        const regex = /\{([^}]+)\}/g;
        let matches = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push({ fullTag: match[0], tagContent: match[1] });
        }

        let resultText = text;

        for (const item of matches) {
            const parts = item.tagContent.split(':');
            const cmdName = parts[0].trim();
            const cmdParam = parts.slice(1).join(':').trim();

            if (this.commandHandlers.has(cmdName)) {
                const handler = this.commandHandlers.get(cmdName);
                const replacement = await handler(cmdParam, { interaction, user, userData, context, messageOptions: contextData.messageOptions });
                resultText = resultText.replace(item.fullTag, replacement !== undefined ? replacement : '');
            } else if (context[cmdName] !== undefined) {
                resultText = resultText.replace(item.fullTag, context[cmdName]);
            } else if (cmdName === 'user_name') {
                resultText = resultText.replace(item.fullTag, user?.displayName || user?.username || 'Viajero');
            } else if (cmdName === 'user') {
                resultText = resultText.replace(item.fullTag, `<@${user?.id}>`);
            } else if (cmdName === 'user_id') {
                resultText = resultText.replace(item.fullTag, user?.id || '');
            } else if (cmdName === 'character_id' || cmdName === 'char_id') {
                try {
                    let charDoc = userData?.charDoc;
                    if (!charDoc && user) {
                        const targetCharId = userData?.context?.characterId || userData?.charId || userData?.soulId;
                        charDoc = await this.obtenerPersonajeActivo(user.id, targetCharId);
                        if (userData && charDoc) userData.charDoc = charDoc;
                    }
                    resultText = resultText.replace(item.fullTag, charDoc ? String(charDoc._id) : (userData?.charId || userData?.soulId || ''));
                } catch (e) {
                    resultText = resultText.replace(item.fullTag, '');
                }
            } else if (cmdName === 'user_avatar') {
                const avatar = user?.displayAvatarURL?.() || '';
                resultText = resultText.replace(item.fullTag, avatar);
            } else if (cmdName === 'client_name') {
                const clientObj = this.client || interaction?.client;
                resultText = resultText.replace(item.fullTag, clientObj?.user?.username || 'Shuciika');
            } else if (cmdName === 'client') {
                const clientObj = this.client || interaction?.client;
                resultText = resultText.replace(item.fullTag, `<@${clientObj?.user?.id}>`);
            } else if (cmdName === 'client_id') {
                const clientObj = this.client || interaction?.client;
                resultText = resultText.replace(item.fullTag, clientObj?.user?.id || '');
            } else if (cmdName === 'client_avatar') {
                const clientObj = this.client || interaction?.client;
                const avatar = clientObj?.user?.displayAvatarURL?.() || '';
                resultText = resultText.replace(item.fullTag, avatar);
            } else if (cmdName.startsWith('ch_')) {
                const pathKey = cmdName.slice(3);
                try {
                    let charDoc = userData?.charDoc;
                    if (!charDoc && user) {
                        const targetCharId = userData?.context?.characterId || userData?.charId || userData?.soulId;
                        charDoc = await this.obtenerPersonajeActivo(user.id, targetCharId);
                        if (userData && charDoc) userData.charDoc = charDoc;
                    }
                    if (charDoc) {
                        let val = undefined;
                        const perfil = charDoc.perfil || {};

                        if (pathKey.toLowerCase() === 'avatar' || pathKey.toLowerCase() === 'foto') {
                            val = perfil.avatarURL || charDoc.avatarURL;
                        } else if (pathKey.toLowerCase() === 'nombre') {
                            val = perfil.Nombre || charDoc.Nombre;
                        } else if (perfil[pathKey] !== undefined) {
                            val = perfil[pathKey];
                        } else {
                            const matchedKey = Object.keys(perfil).find(k => k.toLowerCase() === pathKey.toLowerCase());
                            if (matchedKey) {
                                val = perfil[matchedKey];
                            } else if (pathKey.includes('.')) {
                                const pParts = pathKey.split('.');
                                val = pParts.reduce((o, i) => (o ? o[i] : undefined), charDoc);
                            } else {
                                val = charDoc[pathKey];
                            }
                        }

                        if (val !== undefined && val !== null) {
                            resultText = resultText.replace(item.fullTag, String(val));
                        } else {
                            resultText = resultText.replace(item.fullTag, '');
                        }
                    } else {
                        resultText = resultText.replace(item.fullTag, '');
                    }
                } catch (e) {
                    console.error('[dialogoManager] Error parseando tag de personaje:', e);
                    resultText = resultText.replace(item.fullTag, '');
                }
            }
        }

        return resultText;
    }

    async executeActions(actions, interaction, context) {
        if (!actions) return;
        const actionsList = Array.isArray(actions) ? actions : [actions];

        if (actions?.code === "despertar") {
            await despertarAlma(interaction, context);
        }
    }

    checkRequirements(requirements, userId, options = {}) {
        return true;
    }

    async jumpToStep(userId, step, interaction) {
        const userData = this.activeDialogues.get(userId);

        if (!userData) {
            console.error(`No hay diálogo activo para el usuario: ${userId}`);
            return false;
        }

        const dialogue = this.obtenerDialogoPorId(userData.type, userData.dialogueId);
        const stepsList = dialogue?.dialogos || dialogue?.steps || [];
        if (!dialogue || step >= stepsList.length || step < 0) {
            console.error(`Paso inválido: ${step} para diálogo: ${userData.dialogueId}`);
            return false;
        }

        userData.currentStep = step;
        this.activeDialogues.set(userId, userData);

        if (interaction) {
            await this.processNextStep(interaction);
        }

        return true;
    }

    parseText(text, context) {
        if (!text) return '';
        return text.replace(/\{(\w+)\}/g, (match, variable) => {
            return context[variable] !== undefined ? context[variable] : match;
        });
    }

    parseValue(value, context) {
        if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
            const variable = value.slice(1, -1);
            return context[variable] !== undefined ? context[variable] : value;
        }
        return value;
    }

    async endDialogue(userId) {
        const data = this.activeDialogues.get(userId);
        if (data) {
            await this.recordDialogueCompletion(userId, data.dialogueId, data.currentStep, false);
            data.savedMessages = {};
            data.messageQueue = [];
            this.activeDialogues.delete(userId);
        }
    }
}

module.exports = new DialogueSystem();