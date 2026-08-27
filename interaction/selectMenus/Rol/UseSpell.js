const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, ModalBuilder,
    LabelBuilder,
    RadioGroupBuilder,
    CheckboxGroupBuilder,
    CheckboxBuilder } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personajes")
const { duelSystem } = require("../../../functions/Duelo/duelManager")
const TurnProcessor = require("../../../functions/Duelo/turnProcessor")
const CombatUI = require("../../../functions/Duelo/combateUI")
const { crearStringSelectMenu } = require("../../../utils/constructores/crearComponente")

module.exports = crearStringSelectMenu({
    customId: "UseSpell",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },
    optionNames: ["dataString"],

    ejecutar: async ({ client, interaction, character, componentData: { extras }, options: { dataString } }) => {

        const sesionID = extras[0];
        const [Type, idSpell, targetId] = dataString?.split("*")
        console.log("UseSpell.js", extras)
        console.log("useSpell.js", Type, idSpell, targetId);

        const sesion = duelSystem.getSesion(sesionID)

        if (!sesion) {
            return interaction.reply({ content: "No se ha podido realizar la acción porque el duelo ya no es válido", flags: ["Ephemeral"] })
        }

        if (Type === "duelo") {
            try {
                const actor = sesion.getCurrentActor()
                const resultado = await TurnProcessor.resolverHechizo(sesion, actor, idSpell, null)

                if (!resultado.success) {
                    return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
                }

                // Si requiere selección de objetivos
                if (resultado.requiresInteraction) {

                    const modal2 = CombatUI.createObjetivesModal(sesion, actor, resultado.candidatosDamage, resultado.candidatosHealing, resultado.hechizo)
                    return await interaction.showModal(modal2)
                }

                await interaction.deferUpdate()

                // Avanzar el compás (cede el turno al siguiente jugador)
                await TurnProcessor.advanceCompas(sesion, actor)
                return

            } catch (e) {
                console.error("Error al usar hechizo:", e)
                return interaction.reply({ content: "Ocurrió un error al procesar el lanzamiento del hechizo", flags: ["Ephemeral"] })
            }
        } else if (Type === "duel_target") {
            try {
                const actor = sesion.getCurrentActor()
                const targetIdRaw = targetId || idSpell
                // Preservar IDs de NPC como string; solo convertir si es un número válido
                const asNum = Number(targetIdRaw)
                const resolvedTargetId = isNaN(asNum) ? targetIdRaw : asNum
                const realSpellId = (idSpell && idSpell !== "null" && idSpell !== "undefined") ? idSpell : (sesion._accionPendiente?.spellId || null)

                if (sesion._accionPendiente?.tipo === "attack" || !realSpellId) {
                    const accion = {
                        tipo: "attack",
                        spellId: null,
                        targetId: resolvedTargetId
                    }
                    const resultado = await TurnProcessor.resolveAction(sesion, actor.ID, accion)

                    if (!resultado.success) {
                        return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
                    }

                    await interaction.deferUpdate()
                    sesion._accionPendiente = null
                    await TurnProcessor.advanceCompas(sesion, actor)
                    return
                }

                const resultado = await TurnProcessor.resolverHechizo(sesion, actor, realSpellId, [resolvedTargetId])

                if (!resultado.success) {
                    return interaction.reply({ content: resultado.message, flags: ["Ephemeral"] })
                }

                await interaction.deferUpdate()
                sesion._accionPendiente = null

                // Avanzar el compás (cede el turno al siguiente jugador)
                await TurnProcessor.advanceCompas(sesion, actor)
                return
            } catch (error) {
                console.error("Error al usar objetivo en duelo:", error)
                return interaction.reply({ content: "Ocurrió un error al procesar la acción", flags: ["Ephemeral"] })
            }
        }
    }
})

