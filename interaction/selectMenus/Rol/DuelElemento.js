const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")
const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente")

// Cambio de elemento activo de un Alma Desafinada durante su turno (consume el turno).
// customId: DuelElemento-{userId}-{characterId}-{sessionId} · value: nombre del elemento
// El select vive en el mensaje directo del jugador: nadie más ve qué elemento eligió.
module.exports = crearStringSelectMenu({
    customId: "DuelElemento",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    optionNames: ["elemento"],

    ejecutar: async ({ interaction, componentData: { extras }, options: { elemento } }) => {
        const sesion = duelSystem.getSesion(extras[0])
        if (!sesion || sesion.state === "FINALIZADO") {
            return interaction.reply({ content: "No se ha podido realizar la acción porque el duelo ya no es válido", flags: ["Ephemeral"] })
        }

        const actor = sesion.actorEnTurno()
        if (!actor || String(actor.ownerId) !== String(interaction.user.id)) {
            return interaction.reply({ content: "No es tu turno ＞﹏＜", flags: ["Ephemeral"] })
        }

        if (!duelSystem.bloquearUsuario(interaction.user.id)) return interaction.deferUpdate()
        try {
            const resultado = await TurnProcessor.resolveAction(sesion, actor.ID, { tipo: "element", elemento })
            if (!resultado.success) {
                return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
            }

            await interaction.deferUpdate()
            if (resultado.consumeTurno) await TurnProcessor.advanceCompas(sesion, actor)
            else sesion.emit("actualizarUI")
        } catch (e) {
            console.error("Error al cambiar de elemento:", e)
            return interaction.reply({ content: "Ocurrió un error al cambiar de elemento", flags: ["Ephemeral"] }).catch(() => { })
        } finally {
            duelSystem.desbloquearUsuario(interaction.user.id)
        }
    }
})
