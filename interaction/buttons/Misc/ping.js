const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, } = require(`discord.js`)
const { splitCustomId } = require("../../../utils/constructores/customId")

module.exports = {
    customId: "ping_button",
    soloAutor: true,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    // manejarComponente llama con un objeto ({ client, interaction, ... }). Los argumentos que antes
    // llegaban posicionales se leen del customId sin convertir (manejarComponente pasa la 3ª parte a número).
    ejecutar: async ({ client, interaction }) => {

                
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

                await interaction.update({ embeds: [embed], components: [row] })
        
    }
};