const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const clientdb = require("../../../Server")
const { Client } = require("discord.js")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {

    const characterCache = db2.collection("CachePJ")
    const characterPj = db2.collection("Personajes")
    const userdb = db.collection("usuarios_server")
    const userfind = await userdb.findOne({_id: interaction.user.id})
    const pj = await characterPj?.findOne({_id: interaction.user.id})
    const ficha = await characterCache?.findOne({_id: interaction.user.id})

    if(pj) {
        return interaction.reply({content: "¡Ya tienes registrado a un personaje!. ☆⌒(>。<) " + `**(${pj.Nombre})**` + "\nUsa `/rol perfil` para verlo \n", ephemeral: true})
    }else if(ficha?.isFinish) {
        return interaction.reply({content: '¡Ya tienes una ficha!. ☆⌒(>。<) \n para poder enviarla solo usa **`' + `/rol enviar-ficha` + '`**', ephemeral: true})
    }else if(userfind?.messageTemp) {
        const channel = await client.channels.fetch(userfind.channelTemp) || null
        
        try {
            const msg = await channel.messages.fetch(userfind.messageTemp) || false

            if(msg) {
                const embed = new EmbedBuilder()
                .setTitle("Haz click aqui para ir al mensaje")
                .setURL(`https://discord.com/channels/${interaction.guildId}/${channel.id}/${userfind.messageTemp}`)
                .setDescription(`Ya existe una interacccion activa en ${channel}`)
                .setColor("Red")
                return interaction.reply({embeds: [embed], ephemeral: true})
            }
        }catch(e) {
            console.log("No se encontro el mensaje")
            message()
        }
    }else {
        message()
    }
    
    async function message() {
        const Row = new ActionRowBuilder()
        const buttonstatus = userfind?.buttons?.cachepj1 || false

        const home = new ButtonBuilder()
        .setCustomId(`pjmodal1-${interaction.user.id}`)
        .setStyle(ButtonStyle.Primary)
        .setLabel("Iniciar")
        .setEmoji("<:1_:804234149967167498>")
        .setDisabled(buttonstatus)

        Row.addComponents(home)

        if(userfind) {
            
            const continues = new ButtonBuilder()
            .setCustomId(`pjmodal2-${interaction.user.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Continuar")
            .setEmoji("\<:2_:804234147907371008> ")
            .setDisabled(userfind?.buttons?.cachepj2 || false)
          const mopts =  new ButtonBuilder()
            .setCustomId(`pjmodalextra-${interaction.user.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Más opciones")
            .setEmoji("<a:catwhat:1084972549496131644>")
            .setDisabled(userfind?.buttons?.cachepj3 || false)
           const end = new ButtonBuilder()
            .setCustomId(`pjFinish-${interaction.user.id}`)
            .setStyle(ButtonStyle.Success)
            .setLabel("Terminar")
            .setEmoji("<:TSH_KkannaTomamidinero:798393303170154496>")
            .setDisabled(false)
            Row.addComponents(continues, mopts, end)
        }

        const embed = new EmbedBuilder()
        .setTitle("Guia rapida")
        .setDescription("`🔮` "+`*Bienvenido nuevo aprendiz.* Estas a punto de crear tu **ficha de personaje.** \n\n Para comenzar tu viaje, presiona el botón *Iniciar*. Sigue las instrucciones y apareceran otros botones`)
        .addFields([ {
            name: "Boton actualizar", value: "Si después de enviar ambos formularios y la opcion **terminar** aun no se desbloquea, presiona el ultimo boton para actualizar el mensaje"
        }, {
            name: "Problemas", value: "Si llegas a tener algun problema al enviar tus formularios, envia un mensaje a <@!665421882694041630>"
        }, {
            name: "Foto de perfil", value: "Antes de colocar una foto de perfil, revisa el foro: <#1330769969428041822>."
        }, {
            name: "Dudas", value: "Cualquier otra duda puedes crear una publicacion en <#1064054917662265404>"
        }, {
            name: "Importante", value: "Recuerda revisa las guias de creacion de ficha antes de comenzar."
        }
    
    ])
        .setColor("Random")
    

    
        const msg = await interaction.reply({embeds: [embed], components: [Row], fetchReply: true})
    
    
          const result = await userdb.updateOne({_id: interaction.user.id}, 
            {
                $setOnInsert: {
                    created: Date.now(), buttons: {
                    cachepj1: true,
                    cachepj2: false,
                    cachepj3: false,
                }
            },
                $set: {messageTemp: msg.id, channelTemp: interaction.channelId},
            },
            {upsert: true}
          )
    }

   
}