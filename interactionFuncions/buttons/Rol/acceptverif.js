const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")

module.exports = {
    customId: "acceptverif",
    buttonAuthor: true,

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const userfind = await userdb.findOne({_id: interaction.user.id})
        const characterCache = await Cachedb.findOne({_id: interaction.user.id})
        const channelfichas = await client.channels.fetch("803723665107451904")
        const msg = await userdb.findOne({_id: interaction.user.id})
        const channel = await interaction.channel.messages.fetch(msg.Temp.fichatemp)
        var messageFicha = ""

        if(!characterCache.isFinish) {
            return interaction.reply({content: "No puedo enviar tu ficha si aun no esta terminada! .·´¯`(>▂<)´¯`·. , verifica que hayas completado los dos primeros formularios."})
        }

         channel.delete()

        channelfichas.send({content: 
             "**✧ Nombre.** " + characterCache.name + "\n**✧ Edad.** " + characterCache.edad + "\n**✧ Fecha de cumpleaños.** " + characterCache.cumpleaños 
            + "\n**✧ Genero.** " + characterCache.sexo + "\n**✧ Personalidad.** " 
            + characterCache.personalidad + "\n**✧ Ciudad de origen.** " + characterCache.ciudadOrg + "\n**✧ Familia.** " + characterCache.familia + "\n**✧ Aptitud.** " 
            + characterCache.especialidad + `\n**✧ Historia:** ` + `${characterCache?.historia || "In rol"}` + "\n**`Ficha y personaje de:`** " + `${interaction.user}`, 
            files: [characterCache.avatarURL]
        })
        await Cachedb.updateOne({_id: interaction.user.id}, 
            {$set: {waiting: true}}
        )
        
        await interaction.reply({content: "Muchas gracias por querer formar parte de este instituto. ♡( ◡‿◡ )\n **Espera hasta que un miembro del staff verifique tu ficha**"})

    }
}