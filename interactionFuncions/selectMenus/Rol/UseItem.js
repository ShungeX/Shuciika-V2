const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personaje")
const objetos = db2.collection("Objetos_globales")
const { duelSystem } = require("../../../functions/duelManager")

module.exports = {
    customId: "UseItem",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction, character, duelId, Page, nan, interactValues) => {
        const [Type, IDString, region] = interactValues.split("*")
        const ObjID = Number(IDString)

        const duel = duelSystem.getDuel(duelId)
        const objData = {
            Region: region,
            ID: ObjID
        }


        
        if(Type === "UseDuel") {
            try {
                const currentPlayer = duel.personajes.find(p => p.ID === duel.turnoActual.ID);
                const waitingPlayer = duel.personajes.find(p => p.ID !== duel.turnoActual.ID);
        
               const UseItem = await duelSystem.useItem(duel, currentPlayer, waitingPlayer, objData)

               await interaction.reply({content: `${UseItem.message}`, ephemeral: true})
               if(!UseItem.success) {
               }else {
                await duelSystem.nextTurn(duel)
                await duelSystem.selectEmbed(duel, "bag")

                if(duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
                    const results = await duelSystem.ejecutarAccionesNPC(duel)
                    if(!results.finalizado) {
                        await duelSystem.selectEmbed(duel, null)
                    }else {
                        endEmbed()
                    }
                }

               }
               
            } catch (e) {
                console.log(e)
            }
        }
    }
}