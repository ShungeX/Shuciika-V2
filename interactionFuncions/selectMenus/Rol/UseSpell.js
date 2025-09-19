const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personaje")
const objetos = db2.collection("Objetos_globales")
const { duelSystem } = require("../../../functions/duelManager")

module.exports = {
    customId: "UseSpell",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction, character, duelId, Page, nan, interactValues) => {
        const [Type, idSpell] = interactValues.split("*")

        const duel = duelSystem.getDuel(duelId)


        
        if(Type === "cast") {
            try {
                const currentPlayer = duel.personajes.find(p => p.ID === duel.turnoActual.ID);
                const waitingPlayer = duel.personajes.find(p => p.ID !== duel.turnoActual.ID);
        
               const useSpell = await duelSystem.useSpell(duel, currentPlayer, waitingPlayer, idSpell)

               await interaction.reply({content: `${useSpell.message}`, ephemeral: true})

             if(!useSpell.gameOver) {
                if(!useSpell.success) {
                }else {
                console.log("Actualizando turno...")
                 await duelSystem.nextTurn(duel)

                 if(useSpell?.spellFailed) {
                    console.log("Hechizo mal lanzado")
                     await duelSystem.selectEmbed(duel, "spellFailed")
                 }else {
                    console.log("Hechizo lanzado correctamente")
                     await duelSystem.selectEmbed(duel, "spell")
                 }
 
                 if(duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
                     const results = await duelSystem.ejecutarAccionesNPC(duel)
                     if(!results.duel.finalizado) {
                         await duelSystem.selectEmbed(duel, results.action)
                     }
                 }
                }
            }
               
            } catch (e) {
                console.log(e)
            }
        }

    }
}