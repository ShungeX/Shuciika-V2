const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const Cachedb = db2.collection("CachePJ")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2


module.exports = {
    customId: "nombremodal",

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const nombre = interaction.fields.getTextInputValue("nombreset")
        const cachepj = await Cachedb.findOne({_id: interaction.user.id})


        async function Badwords() {
          const badwords = await import("bad-words");
          const filter = new badwords.Filter()



          if(filter.isProfane(nombre)){
              return true
          }else {
              return false
          }
        }

          if(await Badwords()) {
          return interaction.reply({content: "¡Hey! tu apodo contiene malas palabras （︶^︶）| [Verifica tu apodo]", ephemeral: true})
        }


        if(cachepj) {
          Cachedb.updateOne({_id: interaction.user.id}, 
            {$set: {name: nombre}}
          )
        }else {
          character.updateOne({_id: interaction.user.id}, 
            {$set: {Nombre: nombre}}
          )
        }

        


        
          await dbconfig.updateOne({_id: interaction.user.id}, 
            {$inc: {"PermissionsTime.editname": -1}}
          )

          const intents = await dbconfig.findOne({_id: interaction.user.id})


        const embed = new EmbedBuilder()
        .setTitle("Nombre actualizado correctamente")
        .setDescription(nombre)
        .setFooter({ text: "Puedes seguir cambiando el nombre de tu personaje " + intents?.PermissionsTime?.editname + " veces"})
        .setTimestamp()

        interaction.reply({embeds: [embed]})
    }

}