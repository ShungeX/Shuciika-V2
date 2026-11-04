const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")
const { responder } = require("../../../utils/utilidadesTexto")

module.exports = {
    customId: "UseItem",
    selectAutor: true,

    ejecutar: async ({ client, interaction, character, componentData, options: { option1: sesionID } }) => {
        // componentData format: "Type: {duelo_o_general}*<itemID>*<region>"
        const [Type, IDString, region] = String(componentData || "").split("*")
        if (Type !== "duelo") return

        const sesion = duelSystem.getSesion(sesionID)
        if (!sesion || sesion.state === "FINALIZADO") {
            return responder(interaction, { content: "No se ha podido usar el objeto porque el duelo ya no es válido", flags: ["Ephemeral"] })
        }

        const actor = sesion.getCurrentActor()
        // Un selector viejo no debe permitir usar objetos en el turno de otro combatiente
        if (!actor || String(actor.ownerId) !== String(interaction.user.id)) {
            return responder(interaction, { content: "No es tu turno ＞﹏＜", flags: ["Ephemeral"] })
        }

        if (!duelSystem.bloquearUsuario(interaction.user.id)) {
            return interaction.deferUpdate().catch(() => { })
        }

        try {
            const objData = { Region: region, ID: Number(IDString) }
            const UseItem = await duelSystem.useItem(sesion, actor, null, objData)

            if (!UseItem.success) {
                return responder(interaction, { content: UseItem.message, flags: ["Ephemeral"] })
            }

            // Responder ANTES de avanzar el compás: advanceCompas espera los turnos de los NPC
            // (2-3s cada uno) y la respuesta llegaba tarde → "La aplicación no ha respondido"
            await responder(interaction, { content: `${UseItem.message}`, flags: ["Ephemeral"] })
            await TurnProcessor.advanceCompas(sesion, actor)
        } catch (e) {
            console.error("[UseItem] Error al usar objeto en duelo:", e)
            return responder(interaction, { content: "Ocurrió un error al usar el objeto ＞﹏＜", flags: ["Ephemeral"] })
        } finally {
            duelSystem.desbloquearUsuario(interaction.user.id)
        }
    }
}
