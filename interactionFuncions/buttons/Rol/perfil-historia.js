const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, TextInputStyle, ModalBuilder, TextInputBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")



module.exports = {
    customId: "perfil_options",
    buttonAuthor: true,

        /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, characterId, page) => {
        const personaje = await character.findOne({ID: characterId})
        const user = interaction.guild.members.resolve(personaje._id)
        const soul = await souls.findOne({_id: personaje._id})
        const pincel = personaje.Inventario.find(i => i.ID === 120 && i.Region === "TOB-01")

        if(page === "addHistory") {
            if(!pincel) return interaction.reply({content: "No se puede agregar un capitulo porque no tienes suficientes `Pincel Magico` ＞﹏＜", flags: "Ephemeral"})

               const modal = new ModalBuilder()
                .setTitle("Creacion de historia")
                .setCustomId("Creator_history")
            
                    const title = new TextInputBuilder()
                    .setCustomId("Title")
                    .setLabel("¿Cual sera el titulo de esta historia?")
                    .setPlaceholder('Recuerda seguir las normas del servidor')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(10)
                    .setMaxLength(60)
                    .setRequired(true)
                  
                    const historia = new TextInputBuilder()
                    .setCustomId("Historia")
                    .setLabel("¿Y que contendra esta historia?")
                    .setPlaceholder('Escribe el contenido de este "Capitulo" ')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(50)
                    .setMaxLength(2000)
                    .setRequired(true)
                  
                    const imagen = new TextInputBuilder()
                    .setCustomId("Imagen")
                    .setLabel("¿Tendra una imagen representativa?")
                    .setPlaceholder("Debes ingresar el link de la imagen [Opcional]")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(10)
                    .setMaxLength(200)
                    .setRequired(false)

                    const row = new ActionRowBuilder()
                    .addComponents(title)
                    const row2 = new ActionRowBuilder()
                    .addComponents(historia)
                    const row3 = new ActionRowBuilder()
                    .addComponents(imagen)
                    modal.addComponents(row,
                    row2, row3)
                    await interaction.showModal(modal)
        }

    }



}
  




