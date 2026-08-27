const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, InteractionWebhook, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personajes")
const transaccionCache = require("../../../utils/cache")
const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")
const CombatUI = require("../../../functions/Duelo/combateUI")
const { crearBoton } = require("../../../utils/constructores/crearComponente")

module.exports = crearBoton({
    customId: "DuelAct",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    fieldNames: ["actions", "sessionId", "targetId"],

    ejecutar: async ({ client, interaction, character, componentData: { userId, extras } }) => {
        const [actions, sessionId, targetId] = extras;
        const sesion = duelSystem.getSesion(sessionId)

        if (!sesion) {
            return interaction.reply({ content: `No se ha podido realizar la acción porque el duelo ya no es valido`, flags: ["Ephemeral"] })
        }

        if (!duelSystem.bloquearUsuario(interaction.user.id)) {
            return interaction.deferUpdate()
        }

        try {
            const actor = sesion.getCurrentActor()

            if (actor?.ownerId !== interaction.user.id) {
                return interaction.reply({
                    content: "No es tu turno ＞﹏＜",
                    flags: ["Ephemeral"]
                })
            }

            const esEquipo1 = sesion.teams[0].some(c => c.ID === actor.ID)
            const rivales = esEquipo1 ? sesion.teams[1] : sesion.teams[0]
            const rivalesVivos = rivales.filter(c => !c.defeated)

            console.log("=== Acción recibida ===")
            console.log("Actor:", sesion.getCurrentActor()?.Nombre)
            console.log("Acción:", { tipo: actions, targetId: rivalesVivos[0]?.ID })

            if (actions === "cancel" || actions === "cancelar") {
                sesion._accionPendiente = null;
                const componente = CombatUI.buildActorMessages(sesion, null, true, actor, rivales)
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "confirm") {
                const accion = {
                    tipo: sesion._accionPendiente?.tipo ?? "attack",
                    spellId: sesion._accionPendiente?.spellId ?? null,
                    targetId: targetId !== "all" ? Number(targetId) : null
                }

                const resultado = await TurnProcessor.resolveAction(sesion, actor.ID, accion)

                if (!resultado.success) {
                    return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
                }

                await interaction.deferUpdate()

                // Avanzar compás
                const { rondaCerrada } = await TurnProcessor.advanceCompas(sesion, actor)
                // rondaCerrada handled in advanceCompas

                sesion._accionPendiente = null
                return
            }

            if (actions === "defend" || actions === "surrender") {
                const resultado = await TurnProcessor.resolveAction(sesion, actor.ID, { tipo: actions })

                if (!resultado.success) {
                    return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
                }

                await interaction.deferUpdate()

                const { rondaCerrada } = await TurnProcessor.advanceCompas(sesion, actor)
                if (rondaCerrada) {

                }
                return
            }

            if (actions === "attack") {
                sesion._accionPendiente = { tipo: "attack", spellId: null }

                // Un solo rival → ejecutar directo
                if (rivalesVivos.length === 1) {
                    const resultado = await TurnProcessor.resolveAction(sesion, actor.ID, {
                        tipo: "attack",
                        targetId: rivalesVivos[0].ID
                    })

                    if (!resultado.success) {
                        return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
                    }

                    await interaction.deferUpdate()

                    const { rondaCerrada, gameOver, winners, arrayWinner } = await TurnProcessor.advanceCompas(sesion, actor)

                    // rondaCerrada handled in advanceCompas
                    return
                }

                // Múltiples rivales → mostrar selector
                const componente = CombatUI.buildTarget(sesion, actor, rivalesVivos, "attack", null)
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "spells") {
                const componente = await CombatUI.buildSpellList(sesion, actor)
                if (typeof componente === "string") {
                    return interaction.reply({ content: componente, flags: ["Ephemeral"] })
                }
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "spells_atras" || actions === "spells_adelante") {
                const currentPage = Number(targetId) || 1;
                const newPage = actions === "spells_adelante" ? currentPage + 1 : currentPage - 1;
                const componente = await CombatUI.buildSpellList(sesion, actor, newPage)
                if (typeof componente === "string") {
                    return interaction.reply({ content: componente, flags: ["Ephemeral"] })
                }
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "spells_cerrar") {
                const componente = CombatUI.buildActorMessages(sesion, null, true, actor, rivales)
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "spells_suerte") {
                const resultado = await TurnProcessor.elegirHechizoAleatorio(sesion, actor);
                if (!resultado.success) {
                    return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] });
                }

                if (resultado.requiresInteraction) {
                    const targetsRow = CombatUI.buildTarget(sesion, actor, resultado.candidatos, resultado.hechizo.Nombre, resultado.hechizo._id);
                    return interaction.update({ components: targetsRow, flags: ["IsComponentsV2"] });
                }

                await interaction.deferUpdate();

                const { rondaCerrada } = await TurnProcessor.advanceCompas(sesion, actor);
                // rondaCerrada handled in advanceCompas
                return;
            }

            if (actions === "bag") {
                const componente = await CombatUI.buildBagMessage(sesion, actor, 1)
                if (typeof componente === "string") {
                    return interaction.reply({ content: componente, flags: ["Ephemeral"] })
                }
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "bag_atras" || actions === "bag_adelante") {
                const currentPage = Number(targetId) || 1;
                const newPage = actions === "bag_adelante" ? currentPage + 1 : currentPage - 1;
                const componente = await CombatUI.buildBagMessage(sesion, actor, newPage)
                if (typeof componente === "string") {
                    return interaction.reply({ content: componente, flags: ["Ephemeral"] })
                }
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }

            if (actions === "bag_cerrar") {
                console.log("Sesion:", sesion)
                console.warn("rivales", rivales)
                const componente = CombatUI.buildActorMessages(sesion, null, true, actor, rivales)
                return interaction.update({ components: componente, flags: ["IsComponentsV2"] })
            }
        } finally {
            duelSystem.desbloquearUsuario(interaction.user.id)
        }
        if (actions === "cancel") {

            const esDelEquipo1 = duel.equipo1.some(miembro => miembro.ID === duel.turnoActual.ID);

            const rivales = esDelEquipo1 ? duel.equipo2 : duel.equipo1;
            const mensajeCancel = await interfazCreate.duelBattleMessage(duel, duel.turnoActual, rivales, false)
            return interaction.update({ components: mensajeCancel, flags: ["IsComponentsV2"] })
        }

        if (actions === "confirm") {
            const data = {
                skillId: actions,
                targetsId: Number(params),
            }
            const result = await duel.processAction(character._id, action, data)
            console.log(result)
            return
        }


        const mensajeSelect = await interfazCreate.createComponentsTarget(duel, duel.turnoActual, actions, actions)
        if (mensajeSelect === null) return interaction.reply({ content: "Ocurrio un error al obtener los objetivos...", flags: ["Ephemeral"] })

        try {
            await interaction.update({ components: mensajeSelect, flags: ["IsComponentsV2"] })
        } catch (error) {
            console.log(error)

        }

        return





        const act = await duelSystem.processAction(character._id, actions, duel)
        interaction.reply({ content: `${act.message}`, flags: ["Ephemeral"] })
        if (!act?.gameOver) {
            if (!act.success) {
            } else {

                await duelSystem.selectEmbed(duel, actions)

                if (duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
                    console.log("accion")
                    const results = await duelSystem.ejecutarAccionesNPC(duel)
                    if (!results.duel.finalizado) {
                        await duelSystem.selectEmbed(duel, results.action)
                    } else {
                        await endEmbed()
                    }
                }
            }

        }

    }
})
