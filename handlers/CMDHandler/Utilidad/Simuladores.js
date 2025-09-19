const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)

const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const version = require("../../../config")

const bdobjeto = db2.collection("Objetos_globales")


/**
 * 
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 * 
 */

module.exports = async(client, interaction) => {
    const evento = interaction.options.getString("evento")

    const roles = ["810198633705766962","745503889297637478","716851609509953560","734142447256469584"]
    const verifRoles = roles.some(role => interaction.member.roles.cache.has(role))

    if(!verifRoles) {
        return interaction.reply({content: "No tienes permisos para usar este comando", ephemeral: true})
    }


    try {
        client.emit(evento, interaction.member)
        interaction.reply({content: "Evento ejecutado correctamente\n-# Nombre del evento: `" + `${evento}` + "`", flags: ["Ephemeral"]})
    } catch (error) {
        interaction.reply({content: "Ocurrio un error al ejecutar el evento, revisa la consola", flags: ["Ephemeral"]})
    }


    return 

    
        const embed2 = new EmbedBuilder()
        .setTitle("Sistema de Sanciones")
        .addFields(
          {name: "Sistema de avisos (Warns)", value:  
            `- A partir de **3 avisos** recibirás muteos progresivos que van desde los **30 minutos** hasta **tiempo indefinido**
            \n- Si acumulas **5 avisos**, se evaluará tu **permanencia en el servidor**`},
          {name: "Flood y Spam", value:  
              `- **Primera infracción:** Muteo de 1 hora
              \n- **Segunda infracción:** Muteo de 12 horas
              \n- **Infracciones graves o reiteradas:** Muteo de tiempo indefinido o baneo según la gravedad`},
          {name: "Raideos y similares", value:  
                `- Los usuarios que intenten realizar **raideos y actividades maliciosas** recibirán un *baneo inmediato* sin **posibilidad de apelación**
                \n- Se reportarán a **Discord** los casos más graves que violen los [ToS](https://discord.com/terms)`},
          {name: "Contenido Inapropiado", value:  
                  `- **Compartir contenido NSFW** en el servidor o MD de los usuarios: Muteo de 24 horas (O más de acuerdo a la gravedad)
                  \n- **Compartir contenido explícito**, ilegal o no consensuado: *Baneo permanente* y *reporte a las autoridades correspondientes*`},
          {name: "Acoso y Tóxicicidad", value:  
                    `- **Acoso reiterado hacia otros miembros:** Muteo de 24 horas a 7 días
                    \n- **Acoso grave o discriminación:** Baneo temporal o permanente según la gravedad`},
          {name: "Uso Indebido de Canales", value:  
                      `- **Publicar contenido en canales incorrectos:** Aviso + eliminación del contenido
                      \n- **Infracciones reiteradas:** Muteo temporal de los canales afectados` },
          {name: "Consideraciones Adicionales", value:  
                        `- *El equipo de moderación se reserva el derecho de aplicar sanciones según el contexto y la gravedad de las infracciones*
                        \n- *Si el staff considera que tus acciones comprometen la integridad de los usuarios y del servidor, podrías ser baneado de forma indefinida sin previo aviso*
                        \n- *Las apelaciones pueden realizarse mediante mensaje directo a los administradores*`},
                  
        )
        .setColor("Red")
        .setTimestamp()
        .setFooter({text: "Las sanciones pueden cambiar en el futuro"})
    
        return interaction.channel.send({embeds: [embed2]})


        



    const colaboradores = ["- <@!846776118313091072>\n-# **Video promocional** y **segunda plantilla** para el servidor <3",
        "\n- <@&1055322208924356658>\n-# Encargados de traer más gente al servidor (Alianzas)",
      ]
  
      const embed = new EmbedBuilder()
      .setTitle("✨ Colaboradores del Servidor ✨")
      .setDescription("Personas que han aportado su magia al servidor ᯓ★\n" + "*Cada contribución es un hilo tejido por nuestra comunidad* ( •̀ ω •́ )✧\n\n" + colaboradores.join("\n"))
      .addFields(
        {name: "Aviso sobre derechos de propiedad", value: "-# Si eres propietario de alguna imagen utilizada en este servidor y deseas que sea eliminada, por favor contacta al MD de <@!665421882694041630>. Respetamos los derechos de autor y removeremos inmediatamente cualquier contenido según lo solicitado."}
      )
      .setImage("https://i.pinimg.com/736x/e8/ec/df/e8ecdfc8eb5c17a94acf0faad5d9fbaa.jpg")
      .setFooter({text: "<3"})
      .setColor(0xFFD700)
      .setTimestamp()
  
      return interaction.channel.send({embeds: [embed]})
    

}