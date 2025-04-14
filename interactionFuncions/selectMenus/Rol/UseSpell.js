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
 
                 await duelSystem.nextTurn(duel)
 
                 if(useSpell?.spellFailed) {
                     await duelSystem.selectEmbed(duel, "spellFailed")
                 }else {
                     await duelSystem.selectEmbed(duel, "spell")
                 }
 
                 if(duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
                     const results = await duelSystem.ejecutarAccionesNPC(duel)
                     if(!results.duel.finalizado) {
                         await duelSystem.selectEmbed(duel, results.action)
                     }else {
                         endEmbed()
                     }
                 }
 
 
 
                }
            }else {
                endEmbed()
            }

               
            } catch (e) {
                console.log(e)
            }
        }
        async function endEmbed() {
            console.log("Duel Act", duel.ganador.Nombre)
                const messagesContent = [
                    `¡El piso tiembla! ${duel.ganador.Nombre} dejó enterrado a ${duel.defeated.Nombre} en escombros`,
                    `¡DUELO LEGENDARIO! ${duel.ganador.Nombre} y ${duel.defeated.Nombre} chocaron como titanes, pero solo uno pudo alzarse a la victoria (${duel.ganador.Nombre})`,
                    `¡Historia en cada hechizo! Luego de ${(duel.ronda - 1)} turnos, ${duel.ganador.Nombre} se alza con el triunfo`,
                    `¿Eso fue un duelo o un tutorial? ${duel.ganador.Nombre} gano en ${duel.ronda} turnos. ¡Los espectadores bostezaron!`,
                ]
    
                const messageSelect = messagesContent[Math.floor(Math.random() * messagesContent.length)]
            
                const endEmbed = new EmbedBuilder()
                .setTitle("¡El duelo ha finalizado!")
                .setDescription(`${messageSelect}`)
                .addFields(
                    {name: duel.ganador.Nombre, value: "`HP:`" + ` ${duelSystem.barradeVida(duel.ganador.HP, duel.ganador.stats.hpMax)}`, inline: true},
                    {name: duel.defeated.Nombre, value: "`HP:`" + ` ${duelSystem.barradeVida(duel.defeated.HP, duel.defeated.stats.hpMax)}`, inline: true}
                )
                .setThumbnail(duel.ganador.avatarURL)
                .setFooter({text: `Este duelo finalizo en el turno ${(duel.ronda - 1)}`})
                if (duel.historialAcciones.length > 0) {
                    const ultimasAcciones = duel.historialAcciones.slice(-3).reverse();
                    const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                    endEmbed.addFields({ name: 'Últimas acciones', value: historialTexto, inline: false });
                }
    
                duel.channels.edit({embeds: [endEmbed]})
            
        }
    }
}