const {Client, EmbedBuilder } = require('discord.js')
    /**
     * 
     * @param {Client} client 
     * 
     */

module.exports = async(client, member) => {
    let guild = client.guilds.cache.get("716342375303217285")
    let channel = client.channels.cache.get("716342375743488052")
    let chstaff = client.channels.cache.get("803723665107451904")
    let contador = guild.memberCount
    const user = member.id


    const adios = new EmbedBuilder()
    .setTitle("Oh... Alguien se fue del servidor (｡•́︿•̀｡)")
    .setThumbnail(member.user.displayAvatarURL({dynamic: true}))
    .setDescription(`${member.user} ha tomado sus cosas...\n\n`+ "`🏰✨` Esperamos que tu tiempo aquí haya sido tan mágico como lo imaginabas.\n\nAunque ahora te alejas siempre serás bienvenido/a de vuelta para continuar tu aventura. (｡•́︿•̀｡)")
    .setColor("Random")
    .setImage("https://cdn.discordapp.com/attachments/665423320765693982/769074364372221962/xycOvuE.gif")
    .setFooter({ text: `Sin ti ahora somos: ${contador} Magos (╥_╥)`})
    .setTimestamp()
    channel.send({embeds: [adios]})
}