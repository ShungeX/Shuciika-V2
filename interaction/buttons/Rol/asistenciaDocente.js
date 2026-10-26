const { crearBoton } = require('../../../utils/constructores/crearComponente');
const { crearCustomId } = require('../../../utils/constructores/customId');
const { generarPayloadDocenteEnCurso } = require('../../../data/UI_ComponentsV2/notificacionDocente');
const { abrirSesionClase } = require('../../../functions/clases/evaluadorClases');
const clientdb = require('../../../Server');

module.exports = crearBoton({
    customId: "asistencia_docente",
    soloAutor: true,
    requirements: {
        character: { obtener: false, required: false },
        soul: { obtener: false, required: false },
        cachepj: { obtener: false, required: false }
    },
    ejecutar: async ({ client, interaction, componentData: { userId, characterId, extras } }) => {
        const claseId = extras && extras.length > 0 ? extras[0] : null;

        if (!claseId) {
            return interaction.reply({ content: "Error: No se identificó la clase a confirmar.", flags: ["Ephemeral"] });
        }

        const dbRol = clientdb.db("Rol_db");
        const clasesCol = dbRol.collection("Clases");
        const clase = await clasesCol.findOne({ _id: String(claseId) });

        if (!clase) {
            return interaction.reply({ content: "Esta clase no existe o ya ha sido removida.", flags: ["Ephemeral"] });
        }

        if (String(clase.profesorUserId) !== String(interaction.user.id)) {
            return interaction.reply({ content: "Solo el docente asignado a esta clase puede confirmar su asistencia.", flags: ["Ephemeral"] });
        }

        if (clase.estado === 'no_presentada') {
            return interaction.reply({ content: "El margen de 15 minutos ha expirado y la clase fue marcada como no presentada.", flags: ["Ephemeral"] });
        }

        if (clase.estado === 'cerrada' || clase.estado === 'cancelada') {
            return interaction.reply({ content: `Esta clase ya no está disponible (estado actual: ${clase.estado}).`, flags: ["Ephemeral"] });
        }

        if (clase.asistenciaConfirmada || clase.estado === 'en_curso') {
            return interaction.reply({ content: "Ya has confirmado tu asistencia. ¡La clase ya se encuentra en curso!", flags: ["Ephemeral"] });
        }

        const ahora = new Date();
        const resUpdate = await clasesCol.updateOne(
            { _id: clase._id, estado: 'programada', asistenciaConfirmada: { $ne: true } },
            {
                $set: {
                    estado: 'en_curso',
                    asistenciaConfirmada: true,
                    inicioReal: ahora.toISOString(),
                    docenteMensajeId: interaction.message?.id || clase.docenteMensajeId,
                    "evaluacion.inicioReal": ahora.getTime(),
                    "evaluacion.ultimaActividadProfesor": ahora.getTime(),
                    "evaluacion.usuarios": {},
                    "evaluacion.abiertaEn": ahora.toISOString()
                }
            }
        );

        if (resUpdate.modifiedCount === 0) {
            return interaction.reply({ content: "No se pudo actualizar el estado de la clase (quizá ya cambió de estado o expiró).", flags: ["Ephemeral"] });
        }

        // Abrir la sesión de evaluación en memoria para puntuación en tiempo real de messageCreate
        abrirSesionClase({
            ...clase,
            estado: 'en_curso',
            asistenciaConfirmada: true,
            inicioReal: ahora.toISOString()
        }, ahora);

        // Modificar el mensaje del MD para mostrar el de "mensajeDocenteEnCurso" (permite acabar la clase antes)
        let mensajeActualizado = false;
        try {
            const customIdTerminar = crearCustomId({
                action: "terminar_clase",
                userId: String(clase.profesorUserId),
                characterId: String(clase.profesorId || ""),
                extras: [String(clase._id)]
            });

            const salonChan = client.channels.cache.get(clase.salonId);
            const guildId = salonChan?.guildId || salonChan?.guild?.id || client.guilds.cache.first()?.id || "channels";
            const salonUrl = `https://discord.com/channels/${guildId}/${clase.salonId}`;

            const componentsEnCurso = generarPayloadDocenteEnCurso(
                { ...clase, inicioReal: ahora.toISOString() },
                customIdTerminar,
                salonUrl
            );

            if (componentsEnCurso) {
                await interaction.update({
                    components: componentsEnCurso,
                    flags: ["IsComponentsV2"]
                });
                mensajeActualizado = true;
            }
        } catch (errUpd) {
            console.warn("[asistenciaDocente] No se pudo actualizar el mensaje vía interaction.update:", errUpd.message);
            if (interaction.message) {
                try {
                    const customIdTerminar = crearCustomId({
                        action: "terminar_clase",
                        userId: String(clase.profesorUserId),
                        characterId: String(clase.profesorId || ""),
                        extras: [String(clase._id)]
                    });
                    const salonChan = client.channels.cache.get(clase.salonId);
                    const guildId = salonChan?.guildId || salonChan?.guild?.id || client.guilds.cache.first()?.id || "channels";
                    const salonUrl = `https://discord.com/channels/${guildId}/${clase.salonId}`;
                    const componentsEnCurso = generarPayloadDocenteEnCurso(
                        { ...clase, inicioReal: ahora.toISOString() },
                        customIdTerminar,
                        salonUrl
                    );
                    if (componentsEnCurso) {
                        await interaction.message.edit({
                            components: componentsEnCurso,
                            flags: ["IsComponentsV2"]
                        });
                        mensajeActualizado = true;
                    }
                } catch (e) {
                    console.warn("[asistenciaDocente] Falló fallback edit message:", e.message);
                }
            }
        }

        // Anunciar en el salón e intentar desarchivar
        if (clase.salonId && client.channels) {
            try {
                const thread = client.channels.cache.get(clase.salonId) || await client.channels.fetch(clase.salonId).catch(() => null);
                if (thread) {
                    if (thread.isThread && thread.isThread() && thread.archived) {
                        await thread.setArchived(false).catch(() => null);
                    }
                    await thread.send({
                        content: `🔔 **¡La clase ha comenzado!**\nEl docente <@${clase.profesorUserId}> ha llegado para impartir **${clase.titulo}**.\n¡Bienvenidos alumnos! ¡Tomen sus asientos!`
                    }).catch(() => null);
                }
            } catch (errSalon) {
                console.error("[asistenciaDocente] Error anunciando apertura en el salón:", errSalon.message);
            }
        }

        const respTexto = `✅ **¡Asistencia confirmada con éxito!**\nLa clase **${clase.titulo}** está en curso en <#${clase.salonId}>. ¡Éxito en tu sesión!`;
        if (mensajeActualizado) {
            await interaction.followUp({ content: respTexto, flags: ["Ephemeral"] }).catch(() => null);
        } else if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: respTexto, flags: ["Ephemeral"] }).catch(() => null);
        }
    }
});
