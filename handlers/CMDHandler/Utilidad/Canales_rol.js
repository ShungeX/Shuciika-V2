const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const cloudinary = require("cloudinary").v2
const Discord = require("discord.js")
const db = clientdb.db("rol_db")
const path = require('path');
const setChannels = require("../../../functions/setChannels")

     /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const category = interaction.options.getNumber("categoria")
    const accion = interaction.options.getBoolean("accion")

    const roles = ["810198633705766962","745503889297637478","716851609509953560","734142447256469584"]
    const verifRoles = roles.some(role => interaction.member.roles.cache.has(role))

    await interaction.deferReply()

    if(!verifRoles) {
        return interaction.reply({content: "No tienes permisos para usar este comando", ephemeral: true})
    }

    try {
        await setChannels(client, interaction, category, accion)

        const accions = accion === true ? "Desbloqueados" : "Bloqueados"
        const categoriatext = {
            1: "Escuela",
            2: "Ciudad",
            3: "Escuela y Ciudad"
        }
    
        const embed = new EmbedBuilder()
        .setTitle("Se han ajustado los canales correctamente")
        .addFields(
            {name: "Categoria", value: `${categoriatext[category] || "Desconocido"}`},
            {name: "Acción", value: accions},
            {name: "Ejecutado por", value: `${interaction.user}`}
        )
        .setColor("Random")
        .setTimestamp();
        
    
         interaction.editReply({embeds: [embed]})
    } catch (e) {
        console.log(e)
        return interaction.editReply({content: "No se pudieron actualizar los canales. Revisa el canal <#716518718947065868> ＞﹏＜"})
    }

   
}