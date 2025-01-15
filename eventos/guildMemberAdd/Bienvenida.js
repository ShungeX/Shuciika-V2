const {Client, EmbedBuilder} = require('discord.js')
    /**
     * 
     * @param {Client} client 
     * 
     */

module.exports = async(client, member) => {
    let guild = client.guilds.cache.get("716342375303217285")
    let channel = client.channels.cache.get("716342375743488052")
    let contador = guild.memberCount
    let chsp = guild.channels.cache.get("716518718947065868")

    const gif = ["https://cdn.discordapp.com/attachments/665423320765693982/909658294447132703/aikatsu-aikatsu-hello.gif", 
    `https://cdn.discordapp.com/attachments/665423320765693982/909658295587991642/anime-hi.gif`, 
    `https://cdn.discordapp.com/attachments/665423320765693982/909658298536583189/anime-kurumi-kumamakura.gif`, 
    `https://cdn.discordapp.com/attachments/665423320765693982/909658325900197980/evil-iruma-kun-iruma-kun.gif`, 
    `https://cdn.discordapp.com/attachments/665423320765693982/909658330811760670/nodoka-nodoka-manabe.gif`, 
    `https://cdn.discordapp.com/attachments/665423320765693982/909658331331854377/leticia-fate-fate-juana-de-arco.gif`, 
    `https://cdn.discordapp.com/attachments/665423320765693982/909658348876611634/school-live-cute.gif`, 
    `https://cdn.discordapp.com/attachments/768240532479541258/768659695157116988/tumblr_m1t614JSq21qkpz7co1_500.gif`]

    const gifrandom = gif[Math.floor(Math.random() * gif.length)]

    const Bienvenida = new EmbedBuilder()
    .setTitle(`Bienvenido/a al servidor ${guild.name}`)
    .setDescription(`¡${member.user} ahora eres parte de esta comunidad magica y nos alegra tenerte aqui!.ヽ(o＾▽＾o)ノ 
    \n Gracias por unirte a nosotros, estamos seguros de que tu estancia estará llena de aventuras y descubrimientos mágicos. 
    \n Además, te envié un mensaje encantado a tu bandeja de entrada ('• ω •') ♡ (Solo si puedes recibir mensajes directos). `)
    .setThumbnail(`${member.user.displayAvatarURL({dynamic: true})}`)
    .setColor("Random")
    .setImage(`${gifrandom}`)
    .setFooter({text: `Gracias a ti ahora somos: ${contador} magos ＼(＾▽＾)／`})
    .setTimestamp()
    channel.send({content: `${member.user} || <@&795804715476320256>`, embeds: [Bienvenida]})

    
    const bienvenida = new EmbedBuilder()
    .setTitle(`Bienvenido/a al ${guild.name}`)
    .setThumbnail(`${member.user.displayAvatarURL({dynamic: true})}`)
    .setDescription(` ¡Hola ${member.user}!. Soy Shuciika, tu compañera en este viaje. ✨ Estoy aquí como ayudante y estudiante experimentada de este instituto. Mi misión es guiarte y explicarte de qué trata el server además de algunas otras cositas interesantes. (｡•̀ᴗ-)✧`)
    .addFields(
      { name: "Tema del servidor. ✨", value: "Este servidor está centrado en el rol de fantasía mágica. Podrás crear un personaje único, embarcarte en aventuras y mejorarlo a lo largo del tiempo. Sin embargo, si lo prefieres, también puedes convivir con los demás usuarios sin necesidad de participar en el rol. ¡Lo importante es que disfrutes a tu manera y te diviertas con la comunidad! |･ω･)✿"},
      { name: "Verificacion / Canales 🛡️", value: "Para acceder a todo el servidor, Discord te hará unas preguntas de bienvenida para personalizar tu experiencia. No olvides leer las normas del servidor, ¡son clave para una convivencia sana y divertida! ♡(◡‿◡✿)"}, 
      { name: "Progreso del server", value: "El servidor sigue en desarollo y faltan muchas cosas por terminar. asi que ten paciencia. \n \n Owner: Gracias por ser tu la persona que decidio unirse a este servidor, juntos crearemos una comunidad grande y bonita .♡"}
    )
    .setFooter({ text: `Se libre de explorar y descubrir cada cosa del servidor.`})
    .setTimestamp()
    .setColor("Random")
    try {
      member.send({content: `${member.user}`, embeds: [bienvenida]}).catch(e => console.log(e))
      member.send({content: "`Tambien te dejo la invitacion permanente al servidor:`||✿ ･ ω ･) ~ https://discord.gg/yxNehRsmgJ (Si no sirve, envia un mensaje al desarollador <@!665421882694041630>)"}).catch(e => console.log(e))
    }catch(e) {
      chsp.send({content: "```" + `${e}` + "```"})
    }
}