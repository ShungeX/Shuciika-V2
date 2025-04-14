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

    ejecutar: async(client, interaction, id, actions, duelId) => {
        const duel = await duelSystem.getDuel(duelId)
       
        if(!duel)  {
            return interaction.reply({content: `No se ha podido realizar la acción porque el duelo ya no es valido`, ephemeral: true})
        }

        if(actions === "cancel") {
            await duelSystem.selectEmbed(duel, actions)
            return interaction.reply({content: `Has cancelado esta acción`, ephemeral: true})
        }


        const result = await duelSystem.processAction(duelId, id, actions)
        await interaction.reply({content: `${result.message}`, ephemeral: true})


        if(!result.gameOver) {
            if(!result.success) {
            }else {
                await duelSystem.selectEmbed(duel, actions)

                if(duel.isNPC && duel.turnoActual.ID === duel.personajes[1].ID) {
                    console.log("accion")
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


        async function endEmbed() {
            console.log("Duel Act", duel.ganador.Nombre)


            if(duel.isSurrender) {
                const endEmbed = new EmbedBuilder()
                .setTitle("¡El duelo ha finalizado por rendicion!")
                .setDescription(`¡¿Que acaba de pasar?!, ${duel.defeated.Nombre} se acaba de rendir `)
                .addFields(
                    {name: duel.ganador.Nombre, value: "`HP:`" + ` ${duelSystem.barradeVida(duel.ganador.HP, duel.ganador.stats.hpMax)}`, inline: true},
                    {name: duel.defeated.Nombre, value: "`HP:`" + ` ${duelSystem.barradeVida(duel.defeated.HP, duel.defeated.stats.hpMax)}`, inline: true}
                )
                .setThumbnail(duel.ganador.avatarURL)
                .setFooter({text: `Este duelo finalizo en el turno ${(duel.ronda - 1)}`})
                .setImage("https://c.tenor.com/5lvXZOwWSq0AAAAC/tenor.gif")
                if (duel.historialAcciones.length > 0) {
                    const ultimasAcciones = duel.historialAcciones.slice(-3).reverse();
                    const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                    endEmbed.addFields({ name: 'Últimas acciones', value: historialTexto, inline: false });
                    result.messageId.edit({embeds: [endEmbed]})
                }
            }else if(duel.isAFK) {
                const gifsAFK = [
                    "https://c.tenor.com/MUh5wIdD-E0AAAAd/tenor.gif",
                    "https://c.tenor.com/LRCE-IlHdv4AAAAd/tenor.gif",
                    "https://c.tenor.com/2TowZVLGj2oAAAAd/tenor.gif",
                    "https://c.tenor.com/NBQd0KD6n54AAAAd/tenor.gif",
                    "https://c.tenor.com/GI8ZFPuS9TwAAAAd/tenor.gif",
                    "https://c.tenor.com/5827O35fBsoAAAAd/tenor.gif",
                ]

                const gifSelect = gifsAFK[Math.floor(Math.random() * gifsAFK.length)]

                const endEmbed = new EmbedBuilder()
                .setTitle("¡El duelo ha finalizado por inactividad!")
                .setDescription(`¿Y asi acabó? Al parecer los usuarios nunca más regresaron... **[Nadie ha ganado]** `)
                .addFields(
                    {name: duel.ganador.Nombre, value: "`HP:`" + ` ${duelSystem.barradeVida(duel.ganador.HP, duel.ganador.stats.hpMax)}`, inline: true},
                    {name: duel.defeated.Nombre, value: "`HP:`" + ` ${duelSystem.barradeVida(duel.defeated.HP, duel.defeated.stats.hpMax)}`, inline: true}
                )
                .setThumbnail(duel.ganador.avatarURL)
                .setFooter({text: `Este duelo finalizo en el turno ${(duel.ronda - 1)}`})
                .setImage(gifSelect)
                if (duel.historialAcciones.length > 0) {
                    const ultimasAcciones = duel.historialAcciones.slice(-3).reverse();
                    const historialTexto = ultimasAcciones.map(accion => `• ${accion}`).join('\n');
                    endEmbed.addFields({ name: '¿A esto le llamas acciónes?', value: historialTexto, inline: false });
                    result.messageId.edit({embeds: [endEmbed]})
                }

            }else {
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


}