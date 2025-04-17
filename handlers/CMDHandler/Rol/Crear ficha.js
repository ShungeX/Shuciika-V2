const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const clientdb = require("../../../Server")
const { Client } = require("discord.js")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")


module.exports =  {
    requireCharacter: true,
    requireSoul: false,
    requireCharacterCache: true,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: false,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

ejecutar: async(client, interaction, {character, cachepj}) => {

    const userdb = db.collection("usuarios_server")
    const userfind = await userdb.findOne({_id: interaction.user.id})

    if(character) {
        return interaction.reply({content: "¡Ya tienes registrado a un personaje!. ☆⌒(>。<) " + `**(${character.Nombre})**` + "\nUsa `/rol perfil` para verlo \n", ephemeral: true})
    }else if(cachepj?.isFinish) {
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
        .setTitle("Guia de creacion de personaje")
        .setDescription("`🔮` "+`*Bienvenido nuevo aprendiz. Estas a punto de crear tu **ficha de personaje.*** \n\n*Para comenzar tu viaje, presiona el boton **Iniciar***.`)
        .addFields([ {
            name: "Obligatorio", value: "Debes enviar minimo los dos primeros formularios para poder enviar tu ficha:  **`Iniciar`** y **`Continuar`**"
        }, {
            name: "Problemas", value: "Si tienes problemas para enviar tus formularios, envia un mensaje al privado de <@!665421882694041630>"
        }, {
            name: "Foto de perfil", value: "Para colocar una foto de perfil a tu ficha, REVISA EL FORO: <#1330769969428041822>."
        }, {
            name: "Dudas", value: "Cualquier duda crea una publicacion en <#1064054917662265404> con tu duda"
        }, {
            name: "Importante", value: "Recuerda revisa las guias de creacion de ficha antes de comenzar: <#1339103959855661096>.\n\n" + 
            '-# Es posible que algunos canales te aparezcan como `#Desconocida`, presiona el canal y funcionara de manera normal (Esto es problema de discord)\n\n' + 
            '-# Puedes cerrar los formularios si necesitas verificar algo, la informacion se guarda automaticamente (por bastante rato)'
        }
    
    ])
        .setColor("Random")
    

    
        const msg = await interaction.reply({content: `${interaction.user}`,embeds: [embed], components: [Row], fetchReply: true})
    
    
          await userdb.updateOne({_id: interaction.user.id}, 
            {
                $set: {
                    created: Date.now(), buttons: {
                    cachepj1: userfind?.buttons?.cachepj1 || false,
                    cachepj2: userfind?.buttons?.cachepj2 || false,
                    cachepj3: userfind?.buttons?.cachepj3 || false,
                },
                messageTemp: msg.id, 
                channelTemp: interaction.channelId
            }
            },
            {upsert: true}
          )
    }

   
}

}