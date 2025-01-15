const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const version = require("../../../config")



module.exports = {
    customId: "historia",
    buttonAuthor: true,

        /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, characterId) => {
        const pjuser = await character.findOne({ID: characterId})

        const user = interaction.guild.members.resolve(pjuser._id)
    
    
    
        const embed = new EmbedBuilder()
        .setTitle(pjuser.Nombre + ` [${pjuser.Apodo}]`)
        .setDescription("**`Historia:`**\n" + pjuser.Historia || "In Rol")
        .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
        .setThumbnail(pjuser.avatarURL)
        .setColor(`Random`)
        .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
        return interaction.update({embeds: [embed], components: []})
    }

}
  




