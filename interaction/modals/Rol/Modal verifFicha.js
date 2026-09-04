const { crearModal } = require("../../../utils/constructores/crearComponente");
const { construirDetalleFicha, MAPA_CAMPOS } = require("../../selectMenus/Rol/verificar_ficha");
const { construirListaPendientes } = require("../../../handlers/CMDHandler/Rol/Utilidad/Verificar ficha");
const clientdb = require("../../../Server");
const dbRol = clientdb.db("Rol_db");
const dbServer = clientdb.db("Server_db");
const Cachedb = dbRol.collection("CachePJ");
const userdb = dbServer.collection("usuarios_server");

module.exports = crearModal({
    customId: "verificar_ficha_modal",
    soloAutor: true,
    fieldNames: {
        motivo: "motivo"
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
                fecha: Date.now()
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

            const pj = await Cachedb.findOne({ _id: targetUserId });

            // Notificar y archivar en el hilo si existe
            if (pj?.hiloId) {
                const hilo = await client.channels.fetch(pj.hiloId).catch(() => null);
                if (hilo) {
                    await hilo.send({
                        content: `**La ficha de <@!${targetUserId}> ha sido rechazada y eliminada por la administración.**\n-# **Motivo:** ${motivo.trim()}`
                    }).catch(() => {});

                    await hilo.setArchived(true, `Ficha rechazada: ${motivo.trim()}`).catch(() => {});
                }
            }

            // Eliminar de CachePJ y limpiar fichaStatus
            await Cachedb.deleteOne({ _id: targetUserId });
            await userdb.updateOne(
                { _id: targetUserId },
                { $unset: { fichaStatus: "" } }
            ).catch(() => {});

            const componentesLista = await construirListaPendientes(interaction.user.id, 1);

            try {
                await interaction.update({ components: componentesLista });
                return await interaction.followUp({
                    content: `✅ La ficha de <@!${targetUserId}> ha sido eliminada.\n**Motivo:** ${motivo.trim()}`,
                    flags: ["Ephemeral"]
                }).catch(() => {});
            } catch (err) {
                return await interaction.reply({
                    content: `✅ La ficha de <@!${targetUserId}> ha sido eliminada.\n**Motivo:** ${motivo.trim()}`,
                    flags: ["Ephemeral"]
                });
            }
        }

        return await interaction.deferUpdate().catch(() => {});
    }
});
