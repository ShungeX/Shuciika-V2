const {ChatInputCommandInteraction, ModalBuilder,  ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");

module.exports = {
    customId: "apodoselect",
    selectAutor: true,
    

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

     ejecutar: async(client, interaction, character) => {
        const userf = await userdb.findOne({_id: interaction.user.id})
        const time =  (3600000*24) - (Date.now() - userf?.time?.pjApodo) 
    
    if(!character) {
        return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", ephemeral: true})
    }

    if((Date.now() - userf?.time?.pjApodo) < (3600000 * 24) ) {
            return interaction.reply({ content: "¡Oye!, Acabo de decirle a mis amigos de tu nuevo apodo... (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["h", "m", "s"], round: true, conjunction: " y "})}` + "`** para establecer un nuevo apodo (⇀‸↼‶)", ephemeral: true})
        }

        const modal = new ModalBuilder()
        .setCustomId("apodomodal")
        .setTitle("Apodo del personaje")
        const apodoset = new TextInputBuilder()
        .setCustomId("apodoset")
        .setLabel("Ingresa el apodo")
        .setPlaceholder("No uses apodos ofensivos")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10)
        .setMinLength(2)
        .setRequired(true)

        const row = new ActionRowBuilder()
        .setComponents(apodoset)

        await modal.addComponents(row)
        await interaction.showModal(modal)
     }
}