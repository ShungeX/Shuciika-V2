module.exports = {
    customId: "DuelTarget",  // custom_id diferente al de DuelAct
    
    ejecutar: async (client, interaction, characterId, sessionId) => {
        const sesion = combatManager.getSesion(sessionId)
        if (!sesion) return interaction.reply({
            content: "Este combate ya no es válido ＞﹏＜",
            flags: ["Ephemeral"]
        })

        

        const rawTargetId = interaction.values[0]
        const resolvedTargetId = isNaN(rawTargetId) ? rawTargetId : Number(rawTargetId)

        if (sesion._accionPendiente) {
            sesion._accionPendiente.targetId = resolvedTargetId
        }

        // Ejecutar directo, ya tenemos todo
        const actor = sesion.getCurrentActor()
        const resultado = await TurnProcessor.resolveAction(sesion, actor.ID, {
            tipo: sesion._accionPendiente.tipo,
            spellId: sesion._accionPendiente.spellId ?? null,
            targetId: sesion._accionPendiente.targetId
        })

        if (!resultado.success) {
            return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
        }

        const { rondaCerrada } = await TurnProcessor.advanceCompas(sesion, actor)
        // rondaCerrada handled in advanceCompas

        sesion._accionPendiente = null

        await interaction.deferUpdate()
        await CombatUI.update(sesion, client)
    }
}