const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const npcs = db2.collection("NPCs")
const transaccionCache = require("../../../utils/cache")
const getXp = require("../../../functions/getXP")
const { duelSystem } = require("../../../functions/duelManager")

module.exports = {
    customId: "preDuel",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, id, cache, response) => {

         const getCache = transaccionCache.get(cache) 

         if(!getCache) return interaction.reply({content: "Esta interacción ya expiro ＞﹏＜", ephemeral: true});

         const characterAuthor = getCache.characterAuthor
         const authorSoul = getCache.authorSoul
         const characterRival = getCache.characterRival
         const rivalSoul = getCache.rivalSoul
         const MdAuthor = getCache.MdAuthor
         const MdRival = getCache.MdRival

         const channelDuel = client.channels.cache.get("1345239393786527784")



         if(response === "accept") {

            const errores = []

            try {
                await MdAuthor.send({content: "-# Mensaje de comprobación para verificar que se pueden enviar mensajes directos\n-# **Se borra automaticamente despues de un rato**", flags: "SuppressNotifications"})
                .then(m => setTimeout(() => m.delete(), 3000))
            } catch (error) {
                console.error(error)
                const author = await client.users.fetch(authorSoul._id)
                errores.push("`"+ `${author.globalName} ` + "`" + ` Tiene deshabilitados los Mensajes Directos para este servidor.`)
            }
        
            try {
                await MdRival.send({content: "-# Mensaje de comprobación para verificar que se pueden enviar mensajes directos\n-# **Se borra automaticamente despues de un rato**", flags: "SuppressNotifications"})
                .then(m => setTimeout(() => m.delete(), 3000))
            } catch (error) {
                console.error(error)
                errores.push("`"+ `${interaction.user.globalName}` + "`" + `Tiene deshabilitados los Mensajes Directos para este servidor `)
            }
        
            if(errores.length > 0) {
                return interaction.reply("**No se puede iniciar el duelo porque los siguientes usuarios no cumplen un requisito:**" +
                    `\n${errores.join("\n")}`
                )
            }


            if(await charactersinDuel(characterRival.ID)) {
               getCache.Message.edit({components: []})
                  return interaction.reply({content: "No puedes aceptar este duelo porque ya estas en uno", ephemeral: true})
            }


            if(await charactersinDuel(characterAuthor.ID)) {
               getCache.Message.edit({components: []})
               return interaction.reply({content: "No puedes aceptar este duelo. Quien te reto ya esta en un duelo actualmente", ephemeral: true})
         }


            const gifsObjets = [
               "https://c.tenor.com/jT0dXkuoRLEAAAAd/tenor.gif",
               "https://c.tenor.com/wEnKyplBh8EAAAAd/tenor.gif",
               "https://c.tenor.com/OS8sRwN-nlYAAAAd/tenor.gif",
               "https://c.tenor.com/T3-_RasuG7gAAAAC/tenor.gif"
            ]

            const gifSelect = gifsObjets[Math.floor(Math.random() * gifsObjets.length)]

            const embed = new EmbedBuilder()
            .setTitle(`${getCache.characterRival.Nombre} a aceptado el duelo`)
            .setDescription("Preparando el duelo...")
            .setThumbnail(`${getCache.characterRival.avatarURL}`)
            .setImage(gifSelect)
    
            getCache.Message.edit({components: []})
               const messagesend = await interaction.reply({content: `<@!${getCache.characterAuthor._id}>`, embeds: [embed], fetchReply: true})

           transaccionCache.delete(cache)
 
            embed.setDescription("El duelo esta en curso...\n-# puedes ver el duelo en el canal: <#1345239393786527784>")
            let messageError;

            const duel = await duelSystem.createDuel(client, characterAuthor, authorSoul, characterRival, rivalSoul, channelDuel, MdAuthor, MdRival).catch((e) => {
               messageError = e.code
               console.log(e)
          })

          if(messageError === 50007) {
            return interaction.channel.send(`No se pudo iniciar el duelo porque alguno de los dos usuarios tiene los MD cerrados...`)
          }else if(messageError) {
           return interaction.channel.send(`Ocurrio un error al intentar iniciar el duelo.`)
          }

          messagesend.edit({embeds: [embed]})



         }else if(response === "decline") {
            const embed = new EmbedBuilder()
            .setTitle(`${getCache.characterRival.Nombre} a rechazado el duelo ＞﹏＜`)
            .setDescription("Quizás para la proxima")
            .setThumbnail(`${getCache.characterRival.avatarURL}`)
            .setImage("https://c.tenor.com/UDzn7Mcr_gwAAAAC/tenor.gif")

            getCache.Message.edit({components: []})
            transaccionCache.delete(cache)
            return interaction.reply({content: `<@!${getCache.characterAuthor._id}>`, embeds: [embed]})
            
         }



         async function charactersinDuel(characterId) {

            return Array.from(duelSystem.activeduels.values()).some(duel => {
                return duel.personajes.some(p => p.ID === characterId)
            })
        }

    }
}