const { crearBoton } = require('../../../utils/constructores/crearComponente');
const { finalizarClase } = require('../../../utils/clasesService');
const clientdb = require('../../../Server');

module.exports = crearBoton({
    customId: "terminar_clase",
    soloAutor: true,
    requirements: {
        character: { obtener: false, required: false },
        soul: { obtener: false, required: false },
        cachepj: { obtener: false, required: false }
    },
    ejecutar: async ({ client, interaction, componentData: { userId, characterId, extras } }) => {
        const claseId = extras && extras.length > 0 ? extras[0] : null;

        if (!claseId) {
            return interaction.reply({ content: "Error: No se identificó la clase a terminar.", flags: ["Ephemeral"] });
        }

        const dbRol = clientdb.db("Rol_db");
        const dbServer = clientdb.db("Server_db");
        const clasesCol = dbRol.collection("Clases");
        const clase = await clasesCol.findOne({ _id: String(claseId) });

        if (!clase) {
            return interaction.reply({ content: "Esta clase no existe o ya no está disponible.", flags: ["Ephemeral"] });
        }

        if (String(clase.profesorUserId) !== String(interaction.user.id)) {
            return interaction.reply({ content: "Solo el docente asignado a esta clase puede terminarla.", flags: ["Ephemeral"] });
        }

        if (clase.estado === 'cerrada' || clase.estado === 'invalida') {
            return interaction.reply({ content: `Esta clase ya ha concluido formalmente (estado: ${clase.estado}).`, flags: ["Ephemeral"] });
        }

        if (clase.estado === 'cancelada' || clase.estado === 'no_presentada') {
            return interaction.reply({ content: `Esta clase no está activa (estado: ${clase.estado}).`, flags: ["Ephemeral"] });
        }

        if (clase.estado !== 'en_curso') {
            return interaction.reply({ content: "La clase aún no ha sido abierta o confirmada.", flags: ["Ephemeral"] });
        }

        // Deferir para procesar la finalización y pagos
        await interaction.deferUpdate().catch(() => null);

        const resFin = await finalizarClase({
            client,
            dbRol,
            dbServer,
            claseId: clase._id,
            finalizadoPorProfesor: true,
            interaction
        });

        if (resFin.error) {
            return interaction.followUp({ content: `Error al terminar la clase: ${resFin.error}`, flags: ["Ephemeral"] }).catch(() => null);
        }

        if (resFin.yaFinalizada) {
            return interaction.followUp({ content: "La clase ya había sido finalizada previamente.", flags: ["Ephemeral"] }).catch(() => null);
        }

        const msgTexto = resFin.invalida
            ? `⚠️ **Clase finalizada:** Registrada como inválida (${resFin.razonInvalida || 'no cumplió los requisitos mínimos'}). Sin pago para el docente.`
            : `✅ **¡Clase concluida anticipadamente!**\nDuración: **${resFin.duracionRealMin} minutos**.\nAlumnos con participación válida: **${resFin.totalAlumnosValidos}**.\nPago acreditado: **${resFin.pagoTotal} Lumens**.`;

        await interaction.followUp({ content: msgTexto, flags: ["Ephemeral"] }).catch(() => null);
    }
});
