const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")

module.exports = {
    customId: "pjFinish",
    buttonAuthor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

ejecutar: async(client, interaction) => {
        const userfind = await userdb.findOne({_id: interaction.user.id})
        const messageId = userfind.messageTemp
        const channel = await client.channels.fetch(userfind.channelTemp)
        const msg = await channel.messages.fetch(messageId)
        const avatar = characterCache.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/v1738637289/Rol/Assets/snhze7wiigf85hsq1ikc.jpg"

        const characterCache = await Cachedb.findOne({_id: interaction.user.id})
        const mdOpen = userfind.statusMd

        const embed = new EmbedBuilder()
        .setTitle("¡Se ha creado correctamente tu Ficha!")
        .setAuthor({ name: `${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true })})
        .setThumbnail(`${characterCache.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/v1727127018/Resources/unknowncharacter.png"}`)
        .setDescription(` **Nombre:** ${characterCache.name} \n **Apodo:** ${characterCache.apodo || "No establecido"}` +
         "\n\n`🎎 Sexo:`" + ` *${characterCache.sexo}*` +
         "\n\n`🍭 Edad:`" + ` *${characterCache.edad}*` + 
         "\n\n`🎂 Cumpleaños:`" + ` *${characterCache.cumpleaños}*` +
         "\n\n`🏙 Ciudad Origen:`" + ` *${characterCache.ciudadOrg}*` +
         "\n\n`🤸🏻‍♀️ Personalidad:`" + ` *${characterCache.personalidad}*` +
         "\n\n`👨‍👩‍👧‍👦 Familia:`" + ` *${characterCache.familia}*` + 
         "\n\n`⚽ Especialidad:`" + ` *${characterCache.especialidad}*`
        )
        .setColor("Random")
        .setFooter({ text: `Para enviar tu ficha y sea verificada por un staff usa el comando "/rol enviar_ficha"`})
        .setTimestamp()

        try {
            msg.delete()
        } catch (e) {
            console.log("No pude borrar el mensaje", e)
        }

        Cachedb.updateOne({_id: interaction.user.id}, {
            $set: {isFinish: true}
        })
        if(mdOpen) {
            interaction.reply({ content: "Envie tu ficha a tu MD ( •̀ ω •́ )✧"})
            interaction.user.send({ embeds: [embed]}).catch(e => {
                console.log("No pude enviar el mensaje al MD de este usuario", e)
                interaction.channel.send({content:" Al parecer tienes los Mensajes Directos cerrado. Enviare tu ficha aqui. \n \n **Te recomiendo cambiar la configuracion que estableciste en el bot a `MD cerrado` Para evitar mensajes como estos**", embeds: [embed]})
            })
        }else {
            interaction.channel.send({ embeds: [embed]})
        }

    }
}