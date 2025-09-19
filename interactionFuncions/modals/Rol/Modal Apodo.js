const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const Cachedb = db2.collection("CachePJ")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2


module.exports = {
    customId: "apodomodal",

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const apodo = interaction.fields.getTextInputValue("apodoset")
        const cachepj = await Cachedb.findOne({_id: interaction.user.id})


        async function Badwords() {
          const badwords = await import("bad-words");
          const filter = new badwords.Filter()



          if(filter.isProfane(apodo)){
              return true
          }else {
              return false
          }
        }

        if(await Badwords()) {
          return interaction.reply({content: "¡Hey! tu apodo contiene malas palabras （︶^︶）| [Verifica tu apodo]", ephemeral: true})
        }


        if(cachepj) {
        await Cachedb.updateOne({_id: interaction.user.id}, 
            {$set: {apodo: apodo}}
          )
        }else {
         await character.updateOne({_id: interaction.user.id}, 
            {$set: {Apodo: apodo}}
          )
        }






        


        
          await dbconfig.updateOne({_id: interaction.user.id}, 
            {$set: {"time.pjApodo": Date.now()}}
          )


        const embed = new EmbedBuilder()
        .setTitle("Apodo actualizado correctamente")
        .setDescription(apodo)
        .setFooter({ text: "Debes esperar al menos 1 día para actualizar el apodo de tu personaje"})
        .setTimestamp()

        interaction.reply({embeds: [embed]})
    }

}