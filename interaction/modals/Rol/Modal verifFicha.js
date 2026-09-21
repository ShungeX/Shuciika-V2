const { crearModal } = require("../../../utils/constructores/crearComponente");
const { construirDetalleFicha, MAPA_CAMPOS, construirMensajeRechazoMD, TAG_RECHAZO, TAG_VERIFICADO } = require("../../selectMenus/Rol/verificar_ficha");
const { construirListaPendientes } = require("../../../handlers/CMDHandler/Rol/Utilidad/Verificar ficha");
const { procesarFoto } = require("../../buttons/Rol/ActualizarFoto");
const { DateTime } = require("luxon");
const clientdb = require("../../../Server");
const { crearCustomId } = require("../../../utils/constructores/customId");
const dbRol = clientdb.db("Rol_db");
const dbServer = clientdb.db("Server_db");
const Cachedb = dbRol.collection("CachePJ");
const characterPj = dbRol.collection("Personajes");
const contadores = dbServer.collection("contadores");
const userdb = dbServer.collection("usuarios_server");

function deshabilitarBotones(components) {
    if (!components || !Array.isArray(components)) return components;
    return components.map(comp => {
        const raw = typeof comp.toJSON === "function" ? comp.toJSON() : JSON.parse(JSON.stringify(comp));
        if (raw.type === 2) {
            raw.disabled = true;
        }
        if (raw.accessory && raw.accessory.type === 2) {
            raw.accessory.disabled = true;
        }
        if (Array.isArray(raw.components)) {
            raw.components = deshabilitarBotones(raw.components);
        }
        return raw;
    });
}

function defaultIfEmpty(str, defaultVal) {
    return (typeof str === "string" && str.trim().length > 0)
        ? str
        : defaultVal;
}

module.exports = crearModal({
    customId: "verificar_ficha_modal",
    soloAutor: true,
    fieldNames: {
        motivo: "motivo",
    },

    ejecutar: async ({ client, interaction, componentData: { extras }, options }) => {
        const [tipoAccion, targetUserId] = extras || [];

        if (!targetUserId) {
            return await interaction.reply({
                content: "No se identificó el usuario de la ficha a procesar.",
                flags: ["Ephemeral"]
            });
        }

        // ==========================================
        // ACCIÓN: CORREGIR INFORMACIÓN
        // ==========================================
        if (tipoAccion === "corregir") {
            let campoKey = null;
            try {
                campoKey = interaction.fields.getStringSelectValues("campo_corregir")?.[0];
            } catch (e) {
                console.error("Error al obtener campo_corregir:", e);
            }

            let motivo = "";
            try {
                motivo = interaction.fields.getTextInputValue("motivo");
            } catch (e) {
                motivo = options?.motivo || "";
            }

            if (!campoKey || !motivo || !motivo.trim()) {
                return await interaction.reply({
                    content: "Debes seleccionar un campo y proporcionar un motivo para la corrección.",
                    flags: ["Ephemeral"]
                });
            }

            const pj = await Cachedb.findOne({ _id: targetUserId });
            if (!pj) {
                return await interaction.reply({
                    content: "No se encontró el personaje en la base de datos.",
                    flags: ["Ephemeral"]
                });
            }

            const infoCampo = MAPA_CAMPOS[campoKey] || { id: campoKey, label: campoKey };
            const correccion = {
                campo: infoCampo.id,
                etiqueta: infoCampo.label,
                motivo: motivo.trim(),
                fecha: Date.now(),
                permisos: 1,
                usado: false
            };

            let correcciones = Array.isArray(pj.correcciones) ? [...pj.correcciones] : [];
            const idx = correcciones.findIndex(c => String(c.campo).toLowerCase() === String(infoCampo.id).toLowerCase());

            if (idx !== -1) {
                correcciones[idx] = correccion;
            } else {
                correcciones.push(correccion);
            }

            await Cachedb.updateOne(
                { _id: targetUserId },
                { $set: { correcciones: correcciones } }
            );

            pj.correcciones = correcciones;

            const componentesActualizados = construirDetalleFicha(pj, interaction.user.id);

            try {
                return await interaction.update({ components: componentesActualizados });
            } catch (err) {
                return await interaction.reply({
                    content: `✅ Se agregó corrección para el campo **${infoCampo.label}**: "${motivo.trim()}".`,
                    flags: ["Ephemeral"]
                });
            }
        }

        // ==========================================
        // ACCIÓN: ELIMINAR / RECHAZAR FICHA
        // ==========================================
        if (tipoAccion === "eliminar") {
            let motivo = "";
            try {
                motivo = interaction.fields.getTextInputValue("motivo");
            } catch (e) {
                motivo = options?.motivo || "Sin motivo especificado";
            }
            motivo = motivo.trim();

            const pj = await Cachedb.findOne({ _id: targetUserId });

            const componenteRechazo = construirMensajeRechazoMD(targetUserId, motivo);

            // Intentar notificar al usuario por MD (mensaje directo)
            let notificadoPorMD = false;
            try {
                const usuario = await client.users.fetch(targetUserId).catch(() => null);
                if (usuario) {
                    await usuario.send({
                        components: componenteRechazo,
                        flags: ["IsComponentsV2"]
                    });
                    notificadoPorMD = true;
                }
            } catch (errMD) {
                console.log(`No se pudo enviar MD a ${targetUserId}, se enviará en el hilo:`, errMD.message);
                notificadoPorMD = false;
            }

            // Gestionar el hilo en el foro
            if (pj?.hiloId) {
                const hilo = await client.channels.fetch(pj.hiloId).catch(() => null);
                if (hilo) {
                    // Si no se pudo notificar por MD, enviarlo en el Hilo etiquetando al usuario original
                    if (!notificadoPorMD) {
                        await hilo.send({
                            content: `<@!${targetUserId}>`,
                            components: componenteRechazo,
                            flags: ["IsComponentsV2"]
                        }).catch((e) => {
                            console.error("Error al enviar mensaje de rechazo al hilo:", e);
                        });
                    }

                    // Cambiar etiquetas del hilo a rechazo: 1545228004425338920
                    await hilo.setAppliedTags([TAG_RECHAZO]).catch((e) => {
                        console.error("Error al aplicar etiqueta de rechazo al hilo:", e);
                    });

                    // Archivar el hilo
                    await hilo.setArchived(true, `Ficha rechazada: ${motivo}`).catch((e) => {
                        console.error("Error al archivar hilo:", e);
                    });
                }
            }

            // Eliminar de CachePJ y limpiar fichaStatus
            await Cachedb.deleteOne({ _id: targetUserId });
            await userdb.updateOne(
                { _id: targetUserId },
                { $unset: { fichaStatus: "" } }
            ).catch(() => { });

            const componentesLista = await construirListaPendientes(interaction.user.id, 1);

            const textoConfirmacion = notificadoPorMD
                ? `✅ La ficha de <@!${targetUserId}> ha sido eliminada y se le notificó por mensaje directo.\n**Motivo:** ${motivo}`
                : `✅ La ficha de <@!${targetUserId}> ha sido eliminada y se notificó en su hilo (MD bloqueado/cerrado).\n**Motivo:** ${motivo}`;

            try {
                await interaction.update({ components: componentesLista });
                return await interaction.followUp({
                    content: textoConfirmacion,
                    flags: ["Ephemeral"]
                }).catch(() => { });
            } catch (err) {
                return await interaction.reply({
                    content: textoConfirmacion,
                    flags: ["Ephemeral"]
                });
            }
        }

        // ==========================================
        // ACCIÓN: VERIFICAR FICHA
        // ==========================================
        if (tipoAccion === "verificar") {
            // 1. Bloquear los botones inmediatamente para prevenir operaciones duplicadas o dobles clics
            if (interaction.message) {
                try {
                    const compsBloqueados = deshabilitarBotones(interaction.message.components || []);
                    await interaction.update({ components: compsBloqueados, flags: ["IsComponentsV2"] });
                } catch (e) {
                    console.error("Error al bloquear botones en interaction.message:", e);
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => { });
                    }
                }
            } else if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => { });
            }

            // 2. Control de concurrencia: asegurar que ninguna otra acción procese esta ficha simultáneamente
            const resLock = await Cachedb.findOneAndUpdate(
                { _id: targetUserId, enProcesoVerificacion: { $ne: true } },
                { $set: { enProcesoVerificacion: true } },
                { returnDocument: 'after' }
            );

            const cachepj = resLock?.value || resLock;
            if (!cachepj) {
                return await interaction.followUp({
                    content: "⚠️ Esta ficha ya fue procesada o está en proceso de verificación por otro moderador.",
                    flags: ["Ephemeral"]
                }).catch(() => { });
            }

            // 3. Generar ID secuencial único para el personaje desde Server_db.contadores
            async function generateId() {
                const uniqueID = await contadores.findOneAndUpdate(
                    { _id: 'personajes_uid' },
                    { $inc: { seq: 1 } },
                    { returnDocument: 'after', upsert: true }
                );
                const doc = uniqueID?.value || uniqueID;
                let numSeq = Number(doc?.seq);
                if (isNaN(numSeq) || numSeq < 100001) {
                    await contadores.updateOne(
                        { _id: 'personajes_uid' },
                        { $set: { seq: 100001 } }
                    );
                    numSeq = 100001;
                }
                return numSeq;
            }

            const id = await generateId();
            if (isNaN(id)) {
                await Cachedb.updateOne({ _id: targetUserId }, { $unset: { enProcesoVerificacion: "" } });
                return await interaction.followUp({
                    content: `❌ Error al generar el identificador del personaje: \`${id}\``,
                    flags: ["Ephemeral"]
                }).catch(() => { });
            }

            const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS);
            const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT);

            // 4. Insertar el personaje siguiendo estrictamente la estructura establecida
            try {
                await characterPj.insertOne({
                    _id: id,
                    ownerID: targetUserId,
                    perfil: {
                        Nombre: cachepj.nombre,
                        Apodo: defaultIfEmpty(cachepj?.apodo, ""),
                        Sexo: cachepj.sexo,
                        Pronombres: cachepj.pronombres,
                        Edad: cachepj.edad,
                        Cumpleaños: cachepj.cumpleaños,
                        cumpleMes: cachepj?.cumpleMes,
                        cumpleDia: cachepj?.cumpleDia,
                        CiudadOrg: cachepj.ciudadOrg,
                        Personalidad: cachepj.personalidad,
                        Peso: cachepj.peso,
                        Estatura: cachepj.estatura,
                        Especialidad: defaultIfEmpty(cachepj?.especialidad, "Sin especialidades"),
                        Descripcion: null,
                        Historia: defaultIfEmpty(cachepj?.historia, "In rol"),
                        Familia: defaultIfEmpty(cachepj?.familia, "No especificado"),
                        avatarURL: cachepj?.avatarURL,
                        aspiracion: cachepj?.aspiracion
                    },
                    estado: {
                        Reputacion: 0,
                        Rol: cachepj?.rol || "Estudiante",
                        DesmpAcademico: {},
                        progresoAcumulativo: {
                            lumens: 0,
                            xp: 0,
                        }
                    },
                    economia: {
                        Lumens: 0,
                        Inventario: [],
                        MisionesDiarias: []
                    },
                    social: {
                        Compañero: "Sin compañero",
                        Team: "Sin team",
                        Mascotas: "Sin mascota",
                        Medallas: []
                    },
                    metadata: {
                        FechaF: timeMXF,
                        FechaS: timeMXS,
                        fechaCreacion: Math.floor(Date.now() / 1000),
                    }
                });

                // 5. Procesar foto (Cloudinary si viene de Discord CDN / Proxy; directo si es servicio externo)
                await procesarFoto(interaction, cachepj.avatarURL, true, id);

                const pjuser = await characterPj.findOne({ _id: id });
                const perfil = pjuser?.perfil || cachepj;

                // 6. Asignación y remoción de roles (sin edadAsignada)
                const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                if (member) {
                    await member.roles.add("722611675894906902").catch(e => console.log("error al añadir rol [722611675894906902]:", e));
                    await member.roles.remove("736796685069451305").catch(e => console.log("El usuario no tiene el rol [736796685069451305]:", e));
                }

                // 7. Actualización en usuarios_server
                const usuariodb = await userdb.findOne({ _id: targetUserId });
                let verificado;

                if (usuariodb?.nix?.personajeActivo) {
                    await userdb.updateOne({ _id: targetUserId }, {
                        $inc: {
                            "nix.slotsPersonajes.usados": 1,
                        },
                        $push: {
                            "nix.personajes": { "id": id, nombre: cachepj.nombre }
                        },
                        $unset: { fichaStatus: "" }
                    });

                    verificado = [
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
                                            "content": `**Saludos de nuevo, Conciencia Viajera.**\n\nTras una cuidadosa revisión de tu solicitud de admisión, nos complace informarte que tu registro ha sido **validado y aceptado** por el instituto.\n\nUna nueva chispa se enciende dentro del mundo **Nix**. Que esta nueva identidad te permita explorar otras facetas del conocimiento y la magia \n\n **¡Bienvenido/a a tu nuevo hogar ${perfil.Nombre}!**`
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
                                    "content": "**✧ Perfil nuevo, mismo legado**\n- -# Tu conexión con el instituto se ha expandido. Ahora puedes alternar entre tus perfiles para interactuar en el mundo. Usa `/rol configuracion` para más detalles"
                                },
                                {
                                    "type": 10,
                                    "content": "**✧ Un Recordatorio Amistoso**\n- -# Aunque explores nuevos caminos, las normas del instituto y la senda de la Resonancia se mantienen inalterables. Te instamos a mantener el honor y la disciplina que ya has demostrado."
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
                                            "custom_id": "informacionRol-null-chprincipales"
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
                } else {
                    await userdb.updateOne({ _id: targetUserId }, {
                        $set: {
                            nix: {
                                personajeActivo: id,
                                slotsPersonajes: {
                                    total: 1,
                                    usados: 1,
                                },
                                personajes: [
                                    { "id": id, nombre: cachepj.nombre }
                                ],
                                fechaRegistro: Math.floor(Date.now() / 1000),
                            }
                        },
                        $unset: { fichaStatus: "" }
                    }, { upsert: true });

                    verificado = [
                        {
                            "type": 10,
                            "content": "Pss, tengo algo que decirte...~"
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 2,
                                    "style": 2,
                                    "label": "¿Qué es?",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": crearCustomId({
                                        action: "evento",
                                        userId: targetUserId,
                                        characterId: id,
                                        extras: ["bienvenida_rol"]
                                    })
                                }
                            ]
                        }
                    ]
                }

                // 9. Notificar al usuario por MD o en el hilo si MD falla
                let comentario = "";
                try {
                    comentario = interaction.fields.getTextInputValue("motivo");
                } catch (e) {
                    comentario = options?.motivo || "";
                }
                comentario = (comentario || "").trim();

                let notificadoPorMD = false;
                try {
                    const usuario = await client.users.fetch(targetUserId).catch(() => null);
                    if (usuario) {
                        await usuario.send({ components: verificado, flags: ["IsComponentsV2"] });
                        if (comentario) {
                            await usuario.send({
                                content: `${interaction.user} ha dejado un comentario sobre tu ficha ヾ(•ω•)o\n\`${comentario}\``
                            });
                        }
                        notificadoPorMD = true;
                    }
                } catch (errMD) {
                    console.log(`No se pudo enviar MD a ${targetUserId}, se enviará en el hilo:`, errMD.message);
                    notificadoPorMD = false;
                }

                // Gestionar hilo en el foro si existe
                if (cachepj?.hiloId) {
                    const hilo = await client.channels.fetch(cachepj.hiloId).catch(() => null);
                    if (hilo) {
                        // Cambiar etiqueta del hilo a Verificado (1545227941422567505)
                        await hilo.setAppliedTags([TAG_VERIFICADO]).catch((e) => {
                            console.error("Error al aplicar etiqueta de verificado al hilo:", e);
                        });

                        if (!notificadoPorMD) {
                            await hilo.send({
                                components: verificado,
                                flags: ["IsComponentsV2"]
                            }).catch(e => console.error("Error al enviar mensaje de verificación al hilo:", e));

                            if (comentario) {
                                await hilo.send({
                                    content: `Parte de la administración ha dejado un comentario sobre tu ficha ヾ(•ω•)o\n\`${comentario}\``
                                }).catch(() => { });
                            }
                        }

                        await hilo.send({
                            content: `✨ **Ficha verificada:** <@!${targetUserId}> ha sido aceptado/a en el instituto con el personaje **${perfil.Nombre}** (ID: \`${id}\`).`
                        }).catch(() => { });

                        await hilo.setArchived(true, `Ficha aceptada y verificada por ${interaction.user.tag}`).catch(() => { });
                    }
                }

                // 10. Eliminar de CachePJ y borrar mensaje de verificación del staff
                await Cachedb.deleteOne({ _id: targetUserId });

                if (interaction.message) {
                    await interaction.message.delete().catch(err => console.log("Error al borrar mensaje de verificación:", err));
                }

                return await interaction.followUp({
                    content: `✅ La ficha de <@!${targetUserId}> (**${perfil.Nombre}**) ha sido verificada exitosamente con ID \`${id}\`.`,
                    flags: ["Ephemeral"]
                }).catch(() => { });

            } catch (errVerif) {
                console.error("Error durante el proceso de verificación de ficha:", errVerif);
                await Cachedb.updateOne({ _id: targetUserId }, { $unset: { enProcesoVerificacion: "" } });
                return await interaction.followUp({
                    content: `❌ Ocurrió un error al verificar la ficha: \`\`\`${errVerif.message}\`\`\``,
                    flags: ["Ephemeral"]
                }).catch(() => { });
            }
        }

        return await interaction.deferUpdate().catch(() => { });
    }
});
