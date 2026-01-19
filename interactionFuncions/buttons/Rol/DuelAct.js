const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, InteractionWebhook, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personajes")
const transaccionCache = require("../../../utils/cache")
const getXp = require("../../../functions/getXP")
const { duelSystem } = require("../../../functions/duelManager")
const interfazCreate = require("../../../functions/interfazCreate")
const { Duelv2 } = require("../../../functions/duels")

module.exports = {
    customId: "DuelAct",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, characterId, actions, duelId, params, extraParams) => {

        console.log("Habilidad", characterId, actions, duelId, params, extraParams)
        const [select, action] = !extraParams || extraParams === undefined ? [] : extraParams?.split("_")
        /** @type {Duelv2} */ //
        const duel = await duelSystem.getDuel(duelId)

        if (!duel) {
            return interaction.reply({ content: `No se ha podido realizar la acción porque el duelo ya no es valido`, flags: ["Ephemeral"] })
        }

        if (actions === "cancel" || select === "cancel") {

            const esDelEquipo1 = duel.equipo1.some(miembro => miembro.ID === duel.turnoActual.ID);

            const rivales = esDelEquipo1 ? duel.equipo2 : duel.equipo1;
            const mensajeCancel = await interfazCreate.duelBattleMessage(duel, duel.turnoActual, rivales, false)
            return interaction.update({ components: mensajeCancel, flags: ["IsComponentsV2"] })
        }

        if (action === "attack") {
            const data = {
                skillId: actions,
                targetsId: Number(params),
            }
            const result = await duel.processAction(characterId, action, data)
            console.log(result)
            return
        }

        const mensajeSelect = await interfazCreate.createComponentsTarget(duel, duel.turnoActual, actions, action)
        if (mensajeSelect === null) return interaction.reply({ content: "Ocurrio un error al obtener los objetivos...", flags: ["Ephemeral"] })

        try {
            await interaction.update({ components: mensajeSelect, flags: ["IsComponentsV2"] })
        } catch (error) {
            console.log(error)

        }
        return



        const act = await duelSystem.processAction(characterId, actions, duel)
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


}
