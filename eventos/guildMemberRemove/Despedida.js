const {Client, EmbedBuilder, GuildMember } = require('discord.js')
const clientdb = require("../../Server")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
    /**
     * 
     * @param {Client} client 
     * @param {GuildMember} member 
     */

module.exports = async(client, member) => {

    if(client.user.id === "857050098831065088") return;

    let guild = client.guilds.cache.get("716342375303217285")
    let channel = client.channels.cache.get("716342375743488052")
    let chstaff = client.channels.cache.get("803723665107451904")
    let contador = guild.memberCount
    const user = member.id


    const adios = new EmbedBuilder()
    .setTitle("Oh... Alguien se fue del servidor (｡•́︿•̀｡)")
    .setThumbnail(member.user.displayAvatarURL({dynamic: true}))
    .setDescription(`${member.user} ha tomado sus cosas...\n\n`+ "`🏰✨` Esperamos que tu tiempo aquí haya sido tan mágico como lo imaginabas.\n\nAunque ahora te alejas siempre serás bienvenido/a de vuelta para continuar tu aventura. (｡•́︿•̀｡)")
    .setColor("Random")
    .setImage("https://cdn.discordapp.com/attachments/665423320765693982/769074364372221962/xycOvuE.gif")
    .setFooter({ text: `Sin ti ahora somos: ${contador} Magos (╥_╥)`})
    .setTimestamp()
    channel.send({embeds: [adios]})

    try {

        await userdb.deleteOne({_id: user}).catch(e => {
            console.log("El usuario no contaba con una base de datos (usuarios_server)", e)
        })

        await Cachedb.deleteOne({_id: user}).catch(e => {
            console.log("El usuario no tenia un personaje en cache", e)
        })

        await character.deleteOne({_id: user}).catch(e => {
            console.log("El usuario no tenia un personaje inscrito", e)
        })

        await soul.deleteOne({_id: user}).catch(e => {
            console.log("El personaje del usuario aun no despertaba", e)
        })

        



    } catch (e) {
        const logschannel = client.channels.cache.get("716518718947065868")
        const errorembed = new EmbedBuilder()
        .setTitle("Ha ocurrido un error / Revisar la consola")
        .setDescription("```" + e + "```")
        .setColor("Random")
        logschannel.send({embeds: [errorembed]})
        console.error(e)
        
    }
}