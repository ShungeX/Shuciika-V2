const {Client, EmbedBuilder, GuildMember } = require('discord.js')
const clientdb = require("../../Server")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const cloudinary = require("cloudinary").v2
const rel = db2.collection("Relaciones_pj")
    /**
     * 
     * @param {Client} client 
     * @param {GuildMember} member 
     */

module.exports = async(client, member) => {

    

    let guild = client.guilds.cache.get("716342375303217285")
    let channel = client.channels.cache.get("716342375743488052")
    let chstaff = client.channels.cache.get("803723665107451904")
    let contador = guild.memberCount
    const user = member.id


    try {
        const logschannel = client.channels.cache.get("716518718947065868")
        const profile = await character.findOne({_id: user})
        const incache = await Cachedb.findOne({_id: user})

        if(profile) {
            const avatarURL = profile?.avatarURL

            if(avatarURL !== "https://res.cloudinary.com/dn1cubayf/image/upload/v1727127018/Resources/unknowncharacter.png") {
                const parts = avatarURL.split("/upload/")[1]?.split("/");
                parts?.shift()
                const publicId = parts.join("/")?.split(".")[0];

                console.log(parts)

                await cloudinary.uploader.destroy(publicId)
                console.log("Avatar eliminado", publicId)
            }

           const result = await rel.deleteMany({
                $or: [
                   { ID1: profile.ID},
                   { ID2: profile.ID}
                ]
            })

            console.log(console.log(`Eliminadas ${result.deletedCount} relaciones del usuario ${member}`))
    
            await soul.deleteOne({_id: user}).catch(e => {
                console.log("El personaje del usuario aun no despertaba", e)
            })

            await character.deleteOne({_id: user}).catch(e => {
                console.log("El usuario no tenia un personaje inscrito", e)
            })

            const embed = new EmbedBuilder()
            .setTitle(profile.Nombre + ` [${profile.Apodo}]`)
            .setDescription(`Se ha borrado un personaje debido a que el usuario se salio del servidor`)
            .addFields(
              {name: "Informacion 1/2", value: "`🎎` **Sexo: **" + profile.Sexo + "\n`🍭` **Edad: **" + profile.Edad + "\n`🎂` **Cumple: **" + profile.Cumpleaños + "\n`🛫` **C/Org: **" + profile.CiudadOrg, inline: true},
              {name: "Informacion 2/2", value: "`👑` **Linaje familiar: **" + profile.Familia +"\n`🎭` **Personalidad: **" + profile.Personalidad + "\n `🏈` **Especialidad: **" + profile.Especialidad, inline: true},
              {name: "Extra", value: "`🔮` **Rol: **" + profile.Rol + "\n`💳` **ID: **" + profile.ID + "\n `🎉` **Fecha de creacion: **" + profile.FechaS, inline: false}
            )
            .setColor(`Red`)

        logschannel.send({embeds: [embed]})
    
    }

        if(incache) {
            const avatarURL = profile?.avatarURL
            if(avatarURL !== "https://res.cloudinary.com/dn1cubayf/image/upload/v1727127018/Resources/unknowncharacter.png") {
                const parts = avatarURL?.split("/upload/")[1].split(".");
                const publicId = parts?.slice(0, parts.length - 1).join(".");

                await cloudinary.uploader.destroy(publicId)
                console.log("Avatar eliminado", publicId)
            }
            await Cachedb.deleteOne({_id: user}).catch(e => {
                console.log("El usuario no tenia un personaje en cache", e)
            })

            const embed = new EmbedBuilder()
            .setTitle("Se ha borrado una ficha")
            .setDescription(`Se ha borrado una ficha de un usuario que se salio.`)
            .setThumbnail()
            .setColor("Red")
    
            chstaff.send({embeds: [embed]})
        }
        await userdb.deleteOne({_id: user}).catch(e => {
            console.log("El usuario no contaba con una base de datos (usuarios_server)", e)
        })    



    } catch (e) {
        const logschannel = client.channels.cache.get("716518718947065868")
        const errorembed = new EmbedBuilder()
        .setTitle("Ha ocurrido un error / Revisa la consola")
        .setDescription("```" + e + "```")
        .setColor("Random")
        logschannel.send({embeds: [errorembed]})
        console.error(e)
        
    }

    const adios = new EmbedBuilder()
    .setTitle("Oh... Alguien se fue del servidor (｡•́︿•̀｡)")
    .setThumbnail(member.user.displayAvatarURL({dynamic: true}))
    .setDescription(`${member.user} ha tomado sus cosas...\n\n`+ "`🏰✨` Esperamos que tu tiempo aquí haya sido tan mágico como lo imaginabas.\n\nAunque ahora te alejas siempre serás bienvenido/a de vuelta para continuar tu aventura. (｡•́︿•̀｡)")
    .setColor("Random")
    .setImage("https://cdn.discordapp.com/attachments/665423320765693982/769074364372221962/xycOvuE.gif")
    .setFooter({ text: `Sin ti ahora somos: ${contador} Magos (╥_╥)`})
    .setTimestamp()
    channel.send({embeds: [adios]})


}