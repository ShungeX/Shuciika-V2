const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2


module.exports = {
    customId: "historiamodal",

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const historiaset = interaction.fields.getTextInputValue("historiaset")
        const cachepj = await Cachedb.findOne({_id: interaction.user.id})


        if(cachepj) {
          await Cachedb.updateOne({_id: interaction.user.id}, {
            $set: {
                Historia: historiaset,
            }
          }, {upsert: true} )

        }else {
          character.updateOne({_id: interaction.user.id}, 
            {$set: {Historia: historiaset}}
          )

          
        }

        


        
          await dbconfig.updateOne({_id: interaction.user.id}, 
            {$set: {"time.pjHistoria": Date.now()}}
          )


        const embed = new EmbedBuilder()
        .setTitle("Historia actualizada correctamente")
        .setDescription(historiaset)
        .setFooter({ text: "Debes esperar 1 minuto para poder actualizar la historia de tu personaje nuevamente"})
        .setTimestamp()

        interaction.reply({embeds: [embed]})
    }

}