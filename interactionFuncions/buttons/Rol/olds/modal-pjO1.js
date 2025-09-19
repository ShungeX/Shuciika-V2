const { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle} = require(`discord.js`)
let buttonAuthor;

module.exports = {
    customId: "pjmodal1",
    buttonAuthor: true,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async (client, interaction, authorId) => {
    const modal = new ModalBuilder()
    .setTitle("Creacion de ficha")
    .setCustomId("Creator_Pj1")

        const MDs = new TextInputBuilder()
        .setCustomId("mds")
        .setLabel("¿Te envío tu ficha por mensaje directo?")
        .setPlaceholder('Responde solamente con "Si" y "No"')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true)
      
        const nombre = new TextInputBuilder()
        .setCustomId("nombrepj")
        .setLabel("Nombra a tu personaje")
        .setPlaceholder("Ej: Shuciika")
        .setStyle(TextInputStyle.Short)
        .setMinLength(4)
        .setMaxLength(18)
        .setRequired(true)
      
        const apodo = new TextInputBuilder()
        .setCustomId("apodopj")
        .setLabel("Apodo")
        .setPlaceholder("(Deja este campo vacio si no tiene apodo)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(18)
        .setRequired(false)
      
        const sexo = new TextInputBuilder()
        .setCustomId("sexopj")
        .setLabel("¿El sexo de tu personaje es...?")
        .setPlaceholder("Respuestas: Masculino, Femenino, No binario")
        .setStyle(TextInputStyle.Short)
        .setMinLength(8)
        .setMaxLength(10)
        .setRequired(true)
      
        const edad = new TextInputBuilder()
        .setCustomId("edadpj")
        .setLabel("¿Cuantos años tendra? (Edad)")
        .setPlaceholder("Responde con un numero (Edad Min: 13, Edad max: 18)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(2)
        .setRequired(true)


        const row = new ActionRowBuilder()
        .addComponents(MDs)
        const row2 = new ActionRowBuilder()
        .addComponents(nombre)
        const row3 = new ActionRowBuilder()
        .addComponents(apodo)
        const row4 = new ActionRowBuilder()
        .addComponents(sexo)
        const row5 = new ActionRowBuilder()
        .addComponents(edad)
        modal.addComponents(row,
        row2, row3, row4, row5)
        await interaction.showModal(modal)
    }
};