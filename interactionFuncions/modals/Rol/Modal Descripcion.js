const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const cloudinary = require("cloudinary").v2


module.exports = {
    customId: "descripcionmodal",

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const descripcion = interaction.fields.getTextInputValue("descripcionset")


        async function Badwords() {
          const badwords = await import("bad-words");
          const filter = new badwords.Filter()



          if(filter.isProfane(descripcion)){
              return true
          }else {
              return false
          }
        }

        if(await Badwords()) {
          return interaction.reply({content: "¡Hey! Tu escripcion contiene malas palabras （︶^︶）| [Verifica nuevamente la descripcion]", ephemeral: true})
        }



          await character.updateOne({_id: interaction.user.id}, 
            {$set: {Descripcion: descripcion}}
          )


        


        
          await dbconfig.updateOne({_id: interaction.user.id}, 
            {$set: {"time.pjDescripcion": Date.now()}}
          )


        const embed = new EmbedBuilder()
        .setTitle("Descripcion actualizada correctamente")
        .setDescription(descripcion)
        .setFooter({ text: "Debes esperar 1 minuto para poder actualizar la descripcion de tu personaje"})
        .setTimestamp()

        interaction.reply({embeds: [embed]})
    }

}