const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const dbpj = db2.collection("Personajes")
const transaccionCache = require("../../../utils/cache")
const getXp = require("../../../functions/getXP")
const getGifs = require("../../../functions/getGifs")
const newGetXP = require("../../../functions/newGetXP")

module.exports = {
    customId: "interaction_button",
    buttonAuthor: true,

    
    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, Id, cache, response) => {
        const respuesta = Number(response)
        const getCache = transaccionCache.get(cache)

        if(!getCache) {
            return interaction.reply({content: "Creo que has demorado mucho para poder responder... ＞﹏＜\n-# Esta interaccion ya no es valida."})
        }

        const randomtexte = getCache.text
        const randomgif = getCache.infogif
        const randomcarita = getCache.carita
        const interactionRolType = getCache.RolType
        const message = interaction.channel.messages.cache.get(getCache.Message)
        let nopegif = await getGifs("nope");

        if(!message) {
            return interaction.reply({content: "Creo que has demorado mucho para poder responder... ＞﹏＜\n-# Esta interaccion ya no es valida."})
        }
        
        if(getCache.SubCommand === "kiss") {
            
            if(getCache.ID) {
                const pjfind = await dbpj.findOne({_id: interaction.user.id})
                const pjuser = await dbpj.findOne({ID: getCache.ID})
                if(respuesta === 1) {


            const characterInEmbed = new EmbedBuilder()
            .setDescription("**" + pjuser.Nombre + "**" + `${randomtexte} ` + " ** " + pjfind.Nombre + "**" + `${randomcarita}`)
            .setImage(randomgif.url)
            .setColor("Random")
            .setFooter({text: `Anime: ${randomgif.anime_name}`})



            const result = await newGetXP(client, interaction, pjuser._id, pjuser.ID, pjfind.ID, interactionRolType)
    
            
            if(result.xp) {
                characterInEmbed.setDescription("**" + pjuser.Nombre + "**" + `${randomtexte}` + " **" + pjfind.Nombre + "**" + `${randomcarita}` + `\n-# Puntos de Amistad ganados: + ${result.xp}`)
               
            }
            if(result.levelUp) {
                characterInEmbed.setFooter({ text:`Han subido de nivel:  +${result.lv}`})
            }

            await message.edit({embeds: [characterInEmbed], components: []})
            interaction.reply({content: "Has aceptado ( •̀ ω •́ )✧", ephemeral: true})
            transaccionCache.delete(cache)
                }else {
                    const characterInEmbed = new EmbedBuilder()
                    .setDescription("**" + pjfind.Nombre + "**" + ` Ha rechazado el beso a` + " **" + pjuser.Nombre + "** ＞﹏＜")
                    .setImage(nopegif.url)
                    .setColor("Random")
                    .setFooter({text: `Anime: ${nopegif.anime_name}`})

                    await message.edit({embeds: [characterInEmbed], components: []})
        
                    interaction.reply({content: "Te has negado ＞﹏＜", ephemeral: true})
            transaccionCache.delete(cache)
                }
            

            }else {

            }
        }
    } 
}