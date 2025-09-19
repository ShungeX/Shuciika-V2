const { ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType, Client, WebhookClient} = require(`discord.js`)



module.exports = {
    customId: "Creator_Post",

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction) => {
        const intoptions = interaction.fields.fields.toJSON()
        const findoptions = await intoptions.find(e => e.customId === "mensaje_send")
        const imagen = interaction.fields.getTextInputValue("imagen")



        if(findoptions) {
            const mensaje = interaction.fields.getTextInputValue("mensaje_send")
            interaction.channel.send({content: mensaje})
            if(imagen) {
                interaction.channel.send({files: [imagen]})
            }

        }else {
        try {
            const mensaje2 = interaction.fields.getTextInputValue("mensaje")
            const titulo = interaction.fields.getTextInputValue("titulo")
            const id = interaction.fields.getTextInputValue("id")
            const channel = client.channels.cache.get(id)

            if(!channel || channel.type !== 15) return interaction.reply({content: "La id no es un canal de Foro", ephemeral: true})
            if(!mensaje2) {
                const post = await channel.threads.create({
                    name: titulo,
                    message: {
                        files: [imagen],
                    }
                });
            }else {
                const post = await channel.threads.create({
                    name: titulo,
                    message: {
                        content: mensaje2,
                    }
                });
                if(imagen) {
                    post.send({content: imagen})
                }
        

            }


                } catch (e) {
                    console.log(e)
                    return interaction.reply({content: "Ocurrio un error al intentar enviar el mensaje", ephemeral: true})
                }

                interaction.reply({content: `Se ha creado el post en el foro ${channel}`})
        }


    }
}