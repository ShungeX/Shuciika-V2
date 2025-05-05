const {ChatInputCommandInteraction, ModalBuilder,  ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");

module.exports = {
    customId: "historiaselect",
    selectAutor: true,
    

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

     ejecutar: async(client, interaction, character) => {
        const userf = await userdb.findOne({_id: interaction.user.id})
        const time = 60000 - (Date.now() - userf?.time?.pjHistoria) 

        if((Date.now() - userf?.time?.pjHistoria) < 60000) {
            return interaction.reply({ content: "¡Oye!, Acabo de escribir mucho... estoy cansada (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer otra historia(⇀‸↼‶)", ephemeral: true})
        }

        if(!character) {
            return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", ephemeral: true})
        }
    

        const modal = new ModalBuilder()
        .setCustomId("historiamodal")
        .setTitle("Historia del personaje")
        const historia = new TextInputBuilder()
        .setCustomId("historiaset")
        .setLabel("Historia a establecer")
        .setPlaceholder("Todo tuyo... [Intenta ser coherente]")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setMinLength(50)
        .setRequired(true)

        const row = new ActionRowBuilder()
        .setComponents(historia)

        await modal.addComponents(row)
        await interaction.showModal(modal)
     }
}