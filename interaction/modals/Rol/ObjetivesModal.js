const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")
const { splitCustomId } = require("../../../utils/constructores/customId")
const { responder } = require("../../../utils/utilidadesTexto")

module.exports = {
    customId: "ObjetivesModal",
    soloAutor: true,
    // Los campos son grupos de casillas que se leen de interaction.fields (no hay mapeo fijo de textos)
    camposDinamicos: true,

    // manejarComponente llama con un objeto ({ client, interaction, ... }); antes la firma era
    // posicional (client, interaction, ownerId, sessionId) → "interaction" era undefined.
    ejecutar: async ({ interaction }) => {
        // customId: ObjetivesModal-<ownerId>-<sessionId>. El sessionId cae en la posición de
        // characterId, que manejarComponente convierte a número (los IDs alfanuméricos dan NaN),
        // así que se lee directamente del customId.
        const [, , sessionId] = splitCustomId(interaction.customId)

        const sesion = duelSystem.getSesion(sessionId)
        if (!sesion || sesion.state === "FINALIZADO") {
            return responder(interaction, { content: "No se ha podido realizar la acción porque el duelo ya no es válido", flags: ["Ephemeral"] })
        }

        const actor = sesion.getCurrentActor()
        if (!actor || String(actor.ownerId) !== String(interaction.user.id)) {
            return responder(interaction, { content: "No es tu turno ＞﹏＜", flags: ["Ephemeral"] })
        }

        const spellId = sesion._accionPendiente?.spellId
        if (!spellId) {
            return responder(interaction, { content: "No se encontró ningún hechizo pendiente.", flags: ["Ephemeral"] })
        }

        // Responder la interacción de inmediato para evitar "no respondió a tiempo"
        await interaction.deferReply({ flags: ["Ephemeral"] })

        // El grupo de casillas devuelve un ARREGLO cuando el hechizo permite varios objetivos.
        const leerSeleccion = (campo) => {
            try {
                const sel = interaction.fields.getCheckboxGroup(campo)
                const lista = (Array.isArray(sel) ? sel : (sel != null ? [sel] : []))
                    .map(v => String(v).trim()).filter(Boolean)
                    .map(v => isNaN(Number(v)) ? v : Number(v))
                return lista.length > 0 ? lista : null
            } catch (e) {
                return null // el modal no incluía este grupo
            }
        }

        const targetIds = {
            damage: leerSeleccion("targets_damage"),
            healing: leerSeleccion("targets_healing")
        }

        try {
            const resultado = await TurnProcessor.resolverHechizo(sesion, actor, spellId, targetIds)

            if (!resultado.success) {
                return interaction.editReply({ content: resultado.message })
            }

            // Limpiar la acción pendiente
            sesion._accionPendiente = null

            await interaction.editReply({ content: resultado?.message || "Hechizo lanzado con éxito." })
            await TurnProcessor.advanceCompas(sesion, actor)
        } catch (e) {
            console.error("[ObjetivesModal] Error al lanzar el hechizo:", e)
            return interaction.editReply({ content: "Ocurrió un error al lanzar el hechizo ＞﹏＜" }).catch(() => { })
        }
    }
}
