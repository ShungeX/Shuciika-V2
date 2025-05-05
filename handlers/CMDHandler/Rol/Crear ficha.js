const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const clientdb = require("../../../Server")
const { Client } = require("discord.js")
const { formatearTextoLim } = require("../../../interactionFuncions/modals/Rol/Modal crearFicha")
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
    }else if(cachepj?.waiting) {
        return interaction.reply({content: '¡Ya has enviado tu ficha!. ☆⌒(>。<) \n-# Espera a que un administrador la verifique', ephemeral: true})
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
        const Nombre = cachepj?.nombre || "**Tu nombre estara aqui**"
        const Apodo = cachepj?.apodo || "Sin apodo"
        const foto = cachepj?.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter"
        const camposRequeridos = ["nombre", "edad", "sexo", "cumpleaños", "ciudadOrg", "personalidad"];
        const validSend = camposRequeridos.every(campo => cachepj?.[campo])

        const previewCharacter = [
            {
                "type": 10,
                "content": `${interaction.user}`
            },
            {
                "type": 17,
                "accent_color": 8211391,
                "spoiler": false,
                "components": [
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": `${foto}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${Nombre} *[${Apodo}]*`
                            },
                            {
                                "type": 10,
                                "content": cachepj?.historia ? "-# `Historia:`\n\n"+ `${formatearTextoLim(cachepj?.historia, 270)}` : 
                                 "-# `Historia:`\n-# *in rol / no establecida*"
                            }
                        ]
                            
                    },
                    {
                      "type": 9,
                      "accessory": {
                          "type": 2,
                          "style": 2,
                          "label": "Establecer foto",
                          "emoji": null,
                          "disabled": false,
                          "custom_id": `crear_ficha-${interaction.user.id}-foto`
                      },
                      "components": [
                          {
                              "type": 10,
                              "content": "** **"
                          },
                      ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 10,
                        "content": "# Información: \n-# `🎎` **Sexo:** " + `${cachepj?.sexo || "** **"}` +
                        "\n-# `🍭` **Edad:** " + `${cachepj?.edad  || "** **"}` + "\n-# `🎂` **Cumple:** " + `${cachepj?.cumpleaños  || "** **"}`+ "\n-# `🛫` **C/Org:** " 
                         + `${cachepj?.ciudadOrg  || "** **"}` + "\n-# `👑` **Linaje Familiar:** " + `${cachepj?.familia  || "** **"}` + 
                         "\n-# `🎭` **Personalidad:** " + `${cachepj?.personalidad  || "** **"}` + "\n-# `🏈` **Especialidades:** " + `${cachepj?.especialidad  || "** **"}`
                    },
                    {
                        "type": 10,
                        "content": "-# `Más opciones se irán agregando en un futuro`"
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `crear_ficha-${interaction.user.id}`,
                                "options": [
                                    {
                                        "label": "» Nombre .ᐟ.ᐟ",
                                        "value": `nombre`,
                                        "description": "El nombre de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Apodo (opcional) .ᐟ.ᐟ",
                                        "value": `apodo`,
                                        "description": "El apodo de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Sexo .ᐟ.ᐟ",
                                        "value": `sexo`,
                                        "description": "El sexo de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Edad .ᐟ.ᐟ",
                                        "value": `edad`,
                                        "description": "La edad de tu personaje",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Cumpleaños .ᐟ.ᐟ",
                                        "value": `cumpleaños`,
                                        "description": "Día de cumpleaños (DD/MM)",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Ciudad de origen .ᐟ.ᐟ",
                                        "value": `ciudadorg`,
                                        "description": "Ciudad en la que nació",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Linaje Familiar (opcional) .ᐟ.ᐟ",
                                        "value": `apellido`,
                                        "description": "Apellido ",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Personalidad .ᐟ.ᐟ",
                                        "value": `personalidad`,
                                        "description": "Estructura MBTI",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Especialidades (opcional).ᐟ.ᐟ",
                                        "value": `especialidades`,
                                        "description": "Actividades en las que es bueno",
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "» Establecer historia",
                                        "value": `historia`,
                                        "description": "El transfondo del personaje",
                                        "emoji": null,
                                        "default": false
                                    }
                                ],
                                "placeholder": "Personaliza tu personaje",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    },
                    {
                        "type": 14,
                        "divider": true,
                        "spacing": 1
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "style": 3,
                                "label": "Guía / Tutorial",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `crear_ficha-${interaction.user.id}-guia`
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": "Da tu opinión",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `crear_ficha-${interaction.user.id}-opinion`
                            },
                            {
                              "type": 2,
                              "style": 1,
                              "label": "Enviar ficha",
                              "emoji": null,
                              "disabled": !validSend,
                              "custom_id": `crear_ficha-${interaction.user.id}-enviar_Ficha`
                          }
                        ]
                    }
                ]
            }
        ]
    

    
        const msg = await interaction.reply({components: previewCharacter, flags: ["IsComponentsV2"], withResponse: true})
    

    
          await userdb.updateOne({_id: interaction.user.id}, 
            {
                $set: {
                created: Date.now(),
                messageTemp: msg.resource.message.id, 
                channelTemp: interaction.channelId
            }
            },
            {upsert: true}
          )
    }

   
}

}