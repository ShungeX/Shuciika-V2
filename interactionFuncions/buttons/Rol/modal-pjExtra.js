const { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle} = require(`discord.js`)
let buttonAuthor;

module.exports = {
    customId: "pjmodalextra",
    buttonAuthor: true,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async (client, interaction, authorId) => {
    const modal = new ModalBuilder()
    .setTitle("Creacion de ficha")
    .setCustomId("Creator_Pjextra")

    const historia = new TextInputBuilder()
    .setCustomId("historiapj")
    .setLabel("Cuentame más de tu personaje... (Historia)")
    .setPlaceholder("[Opcional] Respuesta libre. ")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setMinLength(20)
    .setRequired(false)
  
    const opinion = new TextInputBuilder()
    .setCustomId("opinionpj")
    .setLabel("¿Te gustaria dejar tu opinion?")
    .setPlaceholder("[Opcional] Opinion sobre el metodo para crear personajes.")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(900)
    .setMinLength(20)
    .setRequired(false)
  
    const img = new TextInputBuilder()
    .setCustomId("imagenpj")
    .setLabel("¿Agregaras una foto de perfil?")
    .setPlaceholder("[Opcional] Puedes agregarla despues. Antes de enviar el link de tu imagen recuerda revisar la guia.")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(20)
    .setRequired(false)
    

        const row = new ActionRowBuilder()
        .addComponents(historia)
        const row2 = new ActionRowBuilder()
        .addComponents(opinion)
        const row3 = new ActionRowBuilder()
        .addComponents(img)
        modal.addComponents(row,
        row2, row3)
        await interaction.showModal(modal)
    }
};