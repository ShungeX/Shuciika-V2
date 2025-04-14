const { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle} = require(`discord.js`)
let buttonAuthor;

module.exports = {
    customId: "pjmodal2",
    buttonAuthor: true,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async (client, interaction, authorId) => {
    const modal = new ModalBuilder()
    .setTitle("Creacion de ficha")
    .setCustomId("Creator_Pj2")

    const cumpleaños = new TextInputBuilder()
    .setCustomId("cumplepj")
    .setLabel("Cumpleaños de tu personaje")
    .setPlaceholder("**Respuesta con numeros. Recuerda respetar la diagonal para separar /** (04/12 => Día/Mes)")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(3)
    .setMaxLength(5)
    .setRequired(true)
  
    const ciudadorg = new TextInputBuilder()
    .setCustomId("ciudadpj")
    .setLabel("¿Tu personaje vivía en...? (Ciudad de origen)")
    .setPlaceholder("Puede ser una ciudad inventada o real")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(12)
    .setRequired(false)
  
    const personalidad = new TextInputBuilder()
    .setCustomId("personalpj")
    .setLabel("Personalidad")
    .setPlaceholder("Ocupa las personalidades del canal #✦『🎭』personalidades")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(4)
    .setRequired(true)
  
    const familia = new TextInputBuilder()
    .setCustomId("familiapj")
    .setLabel("¿Tu personaje tiene apellido (Familia)?")
    .setPlaceholder("Dejar en blanco si no tiene ningun apellido o linaje familiar")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(false)
  
    const especialidad = new TextInputBuilder()
    .setCustomId("especialidadpj")
    .setLabel("¿En que es bueno tu personaje?")
    .setPlaceholder("Respuesta libre [Maximo 2 cosas] - (Deportes, cocina, videojuegos o cosas mas especificas)")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(30)
    .setRequired(false)
    

        const row = new ActionRowBuilder()
        .addComponents(cumpleaños)
        const row2 = new ActionRowBuilder()
        .addComponents(ciudadorg)
        const row3 = new ActionRowBuilder()
        .addComponents(personalidad)
        const row4 = new ActionRowBuilder()
        .addComponents(familia)
        const row5 = new ActionRowBuilder()
        .addComponents(especialidad)
        modal.addComponents(row,
        row2, row3, row4, row5)
        await interaction.showModal(modal)
    }
};