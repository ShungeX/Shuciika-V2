const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const version = require("../../../config")

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


module.exports = async(client, interaction) => {
    const personaje = await character.findOne({_id: interaction.user.id})
    const soulfind = await soul.findOne({_id: interaction.user.id})
    const pjcache = await Cachedb.findOne({_id: interaction.user.id})


    if(pjcache) {
        return interaction.reply({content: "Tu ficha aún no ha sido enviada, por favor espera a que un moderador la revise (╥﹏╥)", ephemeral: true})
    }else if(!personaje) {
        return interaction.reply({content: "No tienes un personaje registrado (╥﹏╥)\n-# Para despertar tu poder interior debes crear primero uno... /rol crear_ficha", ephemeral: true})
    }

    if(soulfind) {
        return interaction.reply({content: "Una estrella guarda aquello que resuena en tu alma.", ephemeral: true})
    }


    if(!interaction.user.createDM()) {
        return interaction.reply({content: "Para usar este comando debes tener los mensajes directos (MD) activados", ephemeral: true})
    }

    interaction.user.send({content: "Caes en un sueño profundo..."})
    interaction.user.send({content: "Tu cuerpo se siente ligero, como si flotaras en un mar de estrelllas..."})


}