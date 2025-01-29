const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)



    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const embed = new EmbedBuilder()
    .setTitle("◈ Miembros del Staff ◈")
    .setDescription("꒱ Personitas que se encargan de mantener el orden y ayudar en el servidor. (≧◡≦) ♡")
    .addFields( 
        {name: "ʚ Director / Owner", value: "[<:TSH_Rapquee:853368650185965598>] <@!665421882694041630>", inline: true},
        {name: "ʚ Subdirector/a", value: "Cargo sin asignar", inline: true},
        {name: "ʚ Administradores", value: "[<:TSH_ArcLadecandencia:1321027442600575026>] <@!630572719012052993>\n\n[<:Z_jsjsj:810198677209350184> ] <@!997564361482698902>\n\n[<:KSH_NNekocora:853434010285899807> ] <@!1131327272679391357>", inline: false},
        {name: "ʚ Vigilantes", value: "[<:TSH_zPout:1318419457399324743> ] <@!1111008189408891007>", inline: false},
        {name: "ʚ Ayudantes", value: "Cargo disponible", inline: false},
    )
    .setColor("Purple")
    .setImage("https://cdn.discordapp.com/attachments/665423320765693982/806521721154043944/staffSHCSS.png?ex=67890e62&is=6787bce2&hm=0606c718099e5834f53dd49003b4a52516740cc40fc1635c3b88cb27c7583ede&")
    .setFooter({ text: "Si tienes alguna duda o problema, no dudes en contactar a alguno de ellos. (≧◡≦)"})

    interaction.reply({embeds: [embed]})
}