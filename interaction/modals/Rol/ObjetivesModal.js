const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")

module.exports = {
    customId: "ObjetivesModal",

    ejecutar: async (client, interaction, ownerId, sessionId) => {
        const sesion = duelSystem.getSesion(sessionId)
        if (!sesion) {
            return interaction.reply({ content: "No se ha podido realizar la acción porque el duelo ya no es válido", flags: ["Ephemeral"] })
        }

        const actor = sesion.getCurrentActor()
        if (!actor || actor.ownerId !== interaction.user.id) {
            return interaction.reply({ content: "No es tu turno ＞﹏＜", flags: ["Ephemeral"] })
        }

        const spellId = sesion._accionPendiente?.spellId
        if (!spellId) {
            return interaction.reply({ content: "No se encontró ningún hechizo pendiente.", flags: ["Ephemeral"] })
        }

        // Responder la interacción de inmediato para evitar "no respondió a tiempo"
        await interaction.deferReply({ flags: ["Ephemeral"] })

        const targetIds = {
            damage: null,
            healing: null
        }

        try {
            const damageSel = interaction.fields.getCheckboxGroup('targets_damage')
            console.log("Damage selection:", damageSel)
            if (damageSel) {
                // Preservar el ID tal como viene (puede ser string NPC o número de jugador)
                const raw = String(damageSel).trim()
                const asNum = Number(raw)
                targetIds.damage = [isNaN(asNum) ? raw : asNum]
            }
        } catch (e) {
            console.log("Error objetivos Modal", e)
        }

        try {
            const healingSel = interaction.fields.getCheckboxGroup('targets_healing')
            console.log("Healing selection:", healingSel)
            if (healingSel) {
                const raw = String(healingSel).trim()
                const asNum = Number(raw)
                targetIds.healing = [isNaN(asNum) ? raw : asNum]
            }
        } catch (e) {
           console.log("Error objetivos Modal", e)
        }

        const resultado = await TurnProcessor.resolverHechizo(sesion, actor, spellId, targetIds)

        if (!resultado.success) {
            return interaction.editReply({ content: resultado.message })
        }

        // Limpiar la acción pendiente
        sesion._accionPendiente = null

        await TurnProcessor.advanceCompas(sesion, actor)

        await interaction.editReply({ content: resultado?.message || "Hechizo lanzado con éxito." })
    }
}
