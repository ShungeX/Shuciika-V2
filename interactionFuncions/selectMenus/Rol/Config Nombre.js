const {ChatInputCommandInteraction, ModalBuilder,  ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");

module.exports = {
    customId: "nombreselect",
    selectAutor: true,
    

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

     ejecutar: async(client, interaction, character) => {
        const userf = await userdb.findOne({_id: interaction.user.id})

        if(userf?.PermissionsTime?.editname <= 0) {
            return interaction.reply({ content: "¡Oye!, no hay más autocorrector para cambiar tu nombre... quizás debas obtener más con un `permiso especial` (￣へ￣)", ephemeral: true})
        }

        if(!character) {
            return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", ephemeral: true})
        }
    

        const modal = new ModalBuilder()
        .setCustomId("nombremodal")
        .setTitle("Nombre del personaje")
        const nombre = new TextInputBuilder()
        .setCustomId("nombreset")
        .setLabel("Ingresa el nombre")
        .setPlaceholder("No uses nombres ofensivos")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10)
        .setMinLength(3)
        .setRequired(true)

        const row = new ActionRowBuilder()
        .setComponents(nombre)

        await modal.addComponents(row)
        await interaction.showModal(modal)
     }
}