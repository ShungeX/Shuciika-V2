const { crearBoton } = require("../../../../utils/constructores/crearComponente");
const { crearCustomId } = require("../../../../utils/constructores/customId");
const { construirListaPendientes } = require("../../../../handlers/CMDHandler/Rol/Utilidad/Verificar ficha");
const { construirDetalleFicha, construirMensajeCorreccionesHilo } = require("../../../selectMenus/Rol/verificar_ficha");
const clientdb = require("../../../../Server");
const db2 = clientdb.db("Rol_db");
const Cachedb = db2.collection("CachePJ");
const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = crearBoton({
    customId: "verificar_ficha",
    soloAutor: true,

    ejecutar: async ({ client, interaction, componentData: { userId, extras } }) => {
        const [accion, cacheId] = extras || [];

        if (extras && extras.length >= 1 && (extras[0] === "pagina" || extras[0] === "regresar_menu")) {
            const pagina = parseInt(extras[1], 10) || 1;
            const componentes = await construirListaPendientes(userId || interaction.user.id, pagina);
            return await interaction.update({ components: componentes });
        }

        if (accion === "corregir_info") {
            const targetId = cacheId || String(interaction.user.id);
            const modal = new ModalBuilder()
                .setCustomId(crearCustomId({
                    action: "verificar_ficha_modal",
                    userId: interaction.user.id,
                    characterId: targetId,
                    extras: ["corregir", String(targetId)]
                }))
                .setTitle('Selecciona la opción a corregir');

            const campoLabel = new LabelBuilder()
                .setLabel('Campo a corregir')
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId('campo_corregir')
                        .setPlaceholder('Selecciona un campo')
                        .addOptions(
                            { label: 'Nombre', value: '1' },
                            { label: 'Apodo', value: '2' },
                            { label: 'Ciudad de Origen', value: '3' },
                            { label: 'Especialidades', value: '4' },
                            { label: 'Estatura', value: '5' },
                            { label: 'Peso', value: '6' },
                            { label: 'Foto de perfil', value: '7' },
                            { label: 'Edad', value: '8' },
                            { label: 'Cumpleaños', value: '9' },
                            { label: 'Linaje Familiar', value: '10' },
                            { label: 'Personalidad', value: '11' },
                            { label: 'Historia', value: '12' }
                        )
                );

            const motivoLabel = new LabelBuilder()
                .setLabel('Motivo de la corrección')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('motivo')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(1)
                        .setMaxLength(500)
                        .setPlaceholder('Describe el motivo de la corrección')
                        .setRequired(true)
                );

            return await interaction.showModal(modal.addComponents(campoLabel, motivoLabel));
        }

        if (accion === "rechazar") {
            const targetId = cacheId;
            const pj = await Cachedb.findOne({ _id: targetId });
            if (!pj) {
                return await interaction.reply({
                    content: "No se encontró la ficha en la base de datos.",
                    flags: ["Ephemeral"]
                });
            }

            const correcciones = Array.isArray(pj.correcciones) ? pj.correcciones : [];

            // Si tiene correcciones pendientes, mandar mensaje al hilo
            if (correcciones.length > 0) {
                if (!pj.hiloId) {
                    return await interaction.reply({
                        content: "Esta ficha no tiene un hilo de revisión registrado en el foro.",
                        flags: ["Ephemeral"]
                    });
                }

                const hilo = await client.channels.fetch(pj.hiloId).catch(() => null);
                if (!hilo) {
                    return await interaction.reply({
                        content: `No se pudo acceder al hilo <#${pj.hiloId}>. Verifica los permisos del bot.`,
                        flags: ["Ephemeral"]
                    });
                }

                const componenteHilo = construirMensajeCorreccionesHilo(pj, correcciones);
                await hilo.send({
                    components: componenteHilo,
                    flags: ["IsComponentsV2"]
                });

                await Cachedb.updateOne({ _id: targetId }, {
                    $set: {
                        "status.estado": "solicita_cambio",
                        "status.fecha": Date.now(),
                        "status.motivo": `Se solicitaron ${correcciones.length} corrección(es)`
                    }
                });

                pj.status = {
                    estado: "solicita_cambio",
                    fecha: Date.now(),
                    motivo: `Se solicitaron ${correcciones.length} corrección(es)`
                };

                const detalleActualizado = construirDetalleFicha(pj, interaction.user.id);
                await interaction.update({ components: detalleActualizado });

                return await interaction.followUp({
                    content: `✅ Se enviaron las correcciones al hilo <#${pj.hiloId}> y el estado cambió a \`solicita_cambio\`.`,
                    flags: ["Ephemeral"]
                }).catch(() => {});
            }

            // Si NO tiene correcciones pendientes, abrir modal de confirmación de borrado
            const modalEliminar = new ModalBuilder()
                .setCustomId(crearCustomId({
                    action: "verificar_ficha_modal",
                    userId: interaction.user.id,
                    characterId: targetId,
                    extras: ["eliminar", String(targetId)]
                }))
                .setTitle("¿Estás seguro que quieres borrar esta ficha?");

            const motivoEliminarLabel = new LabelBuilder()
                .setLabel("Motivo de la eliminación")
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("motivo")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(1)
                        .setMaxLength(500)
                        .setPlaceholder("Describe el motivo por el cual se borra esta ficha")
                        .setRequired(true)
                );

            return await interaction.showModal(modalEliminar.addComponents(motivoEliminarLabel));
        }

        if (accion === "eliminar_correcciones") {
            const targetId = cacheId;
            await Cachedb.updateOne({ _id: targetId }, { $unset: { correcciones: "" } });
            const pj = await Cachedb.findOne({ _id: targetId });
            if (!pj) {
                return await interaction.reply({
                    content: "No se encontró la ficha en la base de datos.",
                    flags: ["Ephemeral"]
                });
            }
            const detalleActualizado = construirDetalleFicha(pj, interaction.user.id);
            return await interaction.update({ components: detalleActualizado });
        }

        // Botón verificar pendiente de lógica futura
        return interaction.deferUpdate().catch(() => { });
    }
});