const clientdb = require("../../Server");
const {ChatInputCommandInteraction, InteractionWebhook, Client, ChannelType, EmbedBuilder, Message} = require("discord.js")
const db1 = clientdb.db("Rol_db")
const db2 = clientdb.db("Server_db")
const invites = db2.collection("Alianzas")
const users = db2.collection("usuarios_server")

    /**
     * @param {Client} client 
     * @param {Message} message
     */


module.exports = async(client, message) => {
    const messages = message.content
    if(message.channel.id !== "741735370986618952" || message.author.bot || client.user.id === "857050098831065088") return;

    const validLink = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9]+/
    
    if(!validLink.test(messages)) return console.log("Link no valido")
    const link = messages.match(validLink)

    try {
        const invite = await client.fetchInvite(link);


        const timeLimit = 24 * 60 * 60 * 1000;

        const invitacionesReg = await invites.findOne({ _id: invite.guild.id})

        console.log(invitacionesReg)

        if(!invitacionesReg) {
            await invites.insertOne({
                _id: invite.guild.id,
                guildId: invite.guild.id,
                ownerId: invite.guild.ownerId,
                invite: invite.code,
                timestamp: Date.now(),
                agregadoPor: message.author.id
            })
        }else {
            const tiempoTranscurrido = Date.now() - invitacionesReg.timestamp

            if(tiempoTranscurrido < timeLimit) return message.reply({content: "-# Esta alianza fue registrada hace poco 〒▽〒"}).then(m => {
                setTimeout(() => m.delete(), 5000)
            });

            await invites.updateOne({_id: invitacionesReg._id}, {
                $set: {
                    timestamp: Date.now(),
                    agregadoPor: message.author.id
                }
            })
        }

        await users.updateOne({_id: message.author.id}, {
            $push: {
                alianzas: [
                    {
                        guildId: invite.guild.id,
                        inviteCode: invite.code,
                        timestamp: Date.now().toString(),
                    }
                ]
            },
            $inc: {
                alianzasPoints: 1,
                cantidadAlianzas: 1
            }
        }, { upsert: true})

        const createAt = invite.guild.createdTimestamp < 0 && invite.guild.createdTimestamp === null ? `Fecha desconocida` : `<t:${Math.floor(invite.guild.createdTimestamp / 1000)}:F>`
        const memberCounts = invite.guild.memberCount ? `${invite.guild.memberCount}` : "Cantidad desconocida"


        const embed = new EmbedBuilder()
        .setAuthor({name: message.author.displayName, iconURL: message.author.displayAvatarURL()})
        .setTitle(invitacionesReg === null ? "Nueva alianza Registrada ( •̀ ω •́ )✧" : "Alianza actualizada ( •̀ ω •́ )✧")
        .setDescription("Nuestro servidor ha unido fuerzas con:" + `**${invite.guild.name}** `)
        .addFields(
            {name: "Información del servidor", value:
                `-# **Nombre:** ${invite.guild.name}\n-# **Creado:** ${createAt} \n-# **Miembros Aproximados:** ${memberCounts}\n-# **Envia al canal:** ${invite.channel.name}`, inline: true},
            {name: "Recompensa", value: "Has conseguido 1 punto de alianza que puedes reclamar por distintas recompensas"}
        )
        .setThumbnail(invite.guild.iconURL())
        .setTimestamp()
        .setColor("Random")

        message.reply({embeds: [embed], content: `${message.author}`})


    } catch (error) {
        const channelErr = client.channels.cache.get("1000474954376163399");

        const embed = new EmbedBuilder()
        .setTitle("No se ha podido registrar la Alianza")
        .setDescription("```" + error + "```")
        .addFields(
            {name: "Autor", value: `${message.author}`}
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp()

        await channelErr.send({embeds: [embed]})
    }
}