const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, } = require(`discord.js`)
let buttonAuthor;

module.exports = {
    customId: "ping_button",
    buttonAuthor: true,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async (client, interaction, authorId) => {

                
                const interactionPing = interaction.createdTimestamp
                
    
                const button = new ButtonBuilder()
                .setCustomId(`ping_button-${interaction.user.id}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Click")
        
                const row = new ActionRowBuilder().addComponents(button);
                const embed = new EmbedBuilder()
                .setTitle("Comando Ping")
                .setDescription(`[T. Respuesta] ${Date.now() - interactionPing}ms\n[Websocket] ${client.ws.ping}ms`)
                .setColor("Random")

                interaction.update({embeds: [embed], components: [row], ephemeral: true})
        
    }
};