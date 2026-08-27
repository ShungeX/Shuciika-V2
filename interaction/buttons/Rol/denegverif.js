const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")

module.exports = {
    customId: "denegverif",
    buttonAuthor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const msg = await userdb.findOne({_id: interaction.user.id})
        const channel = await interaction.channel.messages.fetch(msg.Temp.fichatemp)
        
        channel.delete()

        await interaction.reply({content: "Esta bien. cuando estés listo, vuelve a usar el comando (｡•́︿•̀｡)"}).then(m => setTimeout(() => m.delete(), 6000))
        

    }
}