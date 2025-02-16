const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, } = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders")

module.exports = {
    data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Pong!"),
    // DevOnly: Boolean,
    // GuildOnly: Boolean,
    // options: Object[],
    // deleted: Boolean

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction) => {
        await interaction.deferReply();

        const reply = await interaction.fetchReply();

        const ping = reply.createdTimestamp - interaction.createdTimestamp

        const button = new ButtonBuilder()
        .setCustomId(`ping_button-${interaction.user.id}`)
        .setStyle(ButtonStyle.Primary)
        .setLabel("Click")

        const row = new ActionRowBuilder().addComponents(button);

        const embed = new EmbedBuilder()
        .setTitle("Comando Ping")
        .setDescription(`[Cliente] ${ping}ms\n[Websocket] ${client.ws.ping}ms`)
        .setColor("Random")
 


       interaction.editReply({embeds: [embed], components: [row]})
    },

    deleted: true,
}