const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personajes")
const transaccionCache = require("../../../utils/cache")
const getXp = require("../../../functions/getXP")
const { duelSystem } = require("../../../functions/duelManager")

module.exports = {
    customId: "DuelAct",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, characterId, actions, duelId) => {
        console.log("Duel ID:", duelId, actions, characterId)
        const duel = await duelSystem.getDuel(duelId)
       
        if(!duel)  {
            return interaction.reply({content: `No se ha podido realizar la acción porque el duelo ya no es valido`, ephemeral: true})
        }

        if(actions === "cancel") {
            await duelSystem.selectEmbed(duel, actions)
            return interaction.deferUpdate()
        }

        

        const act = await duelSystem.processAction(characterId, actions, duel)
        interaction.reply({content: `${act.message}`, flags: ["Ephemeral"]})
        if(!act?.gameOver) {
            if(!act.success) {
            }else {

                await duelSystem.selectEmbed(duel, actions)

                if(duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
                    console.log("accion")
                    const results = await duelSystem.ejecutarAccionesNPC(duel)
                    if(!results.duel.finalizado) {
                        await duelSystem.selectEmbed(duel, results.action)
                    }else {
                       await endEmbed()
                    }
                }
            }

        }
        
    }


}
