const { ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType, Client, WebhookClient} = require(`discord.js`)
const { v4: uuidv4} = require('uuid')
const transaccionCache = require("../../../utils/cache")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


module.exports = async(client, interaction) => {
    const guilduser = interaction.user.id
    const isMessage = interaction.options.getInteger("is_mensaje")
    console.log(isMessage)

    if(isMessage === 1) {
        const modal = new ModalBuilder()
        .setTitle("Creacion de mensaje")
        .setCustomId("Creator_Post")

        const message = new TextInputBuilder()
        .setCustomId("mensaje_send")
        .setLabel("Agrega el mensaje del post...")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1999)
        .setMinLength(1)
        .setRequired(true)

        const imag = new TextInputBuilder()
        .setCustomId("imagen")
        .setLabel("¿Agregaras una foto al post?")
        .setPlaceholder("[Opcional]")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)

        const row = new ActionRowBuilder()
        .setComponents(message)

        const row2 = new ActionRowBuilder()
        .setComponents(imag)
    
        modal.addComponents(row, row2)
    
        await interaction.showModal(modal)
    }else {
        const modal = new ModalBuilder()
        .setTitle("Creacion de post")
        .setCustomId("Creator_Post")
    
        const titulo = new TextInputBuilder()
        .setCustomId("titulo")
        .setLabel("Titulo del post")
        .setPlaceholder("Escribe el titulo del post...")
        .setStyle(TextInputStyle.Short)
        
        
        const message = new TextInputBuilder()
        .setCustomId("mensaje")
        .setLabel("Agrega el mensaje del post...")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1999)
        .setMinLength(1)
        .setRequired(false)
    
        const imag = new TextInputBuilder()
        .setCustomId("imagen")
        .setLabel("¿Agregaras una foto al post?")
        .setPlaceholder("[Opcional]")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    
        const id = new TextInputBuilder()
        .setCustomId("id")
        .setLabel("ID del post")
        .setStyle(TextInputStyle.Short)

        const rowtitulo = new ActionRowBuilder()
        .setComponents(titulo)
    
        const row = new ActionRowBuilder()
        .setComponents(message)
        const row2 = new ActionRowBuilder()
        .setComponents(imag)
        const row3 = new ActionRowBuilder()
        .setComponents(id)
    
        modal.addComponents(rowtitulo,row, row2, row3)
    
        await interaction.showModal(modal)
    }



}