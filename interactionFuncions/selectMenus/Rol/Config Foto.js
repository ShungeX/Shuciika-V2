const {ChatInputCommandInteraction, ModalBuilder,  ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");

module.exports = {
    customId: "fotoselect",
    selectAutor: true,
    

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

     ejecutar: async(client, interaction, character) => {
        const userf = await userdb.findOne({_id: interaction.user.id})
        const time =  300000 - (Date.now() - userf?.time?.pjFoto) 
        

        if((Date.now() - userf?.time?.pjFoto) < 300000) {
            return interaction.reply({ content: "¡Oye!, Acabo de pegar tu foto... Bueno, es lo de menos (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer otra foto nueva (⇀‸↼‶)", ephemeral: true})
        }

        const modal = new ModalBuilder()
        .setCustomId("fotomodal")
        .setTitle("Foto de personaje")
        const imgset = new TextInputBuilder()
        .setCustomId("imagenset")
        .setLabel("Link de la imagen.")
        .setPlaceholder("Antes de enviar el link de tu imagen recuerda revisar el foro.")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setMinLength(20)
        .setRequired(true)

        const row = new ActionRowBuilder()
        .setComponents(imgset)

        await modal.addComponents(row)
        await interaction.showModal(modal)
     }
}