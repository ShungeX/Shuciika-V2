const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, PermissionsBitField} = require("discord.js")

module.exports = {
    customId: "vfpj_false",
    buttonAuthor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        interaction.update({content: "Vuelve a usar el comando", embeds: [], components: []})
    }
}