const {ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    ChatInputCommandInteraction,
    ComponentType,
    SeparatorSpacingSize,
    ThumbnailBuilder,} = require("discord.js") 

const Builders = require("@discordjs/builders")
const Enums = require("discord-api-types/v10")
const util = require(`util`);
const sleep = util.promisify(setTimeout)
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const v2 = [
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
                          "url": "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter"
                      },
                      "description": null,
                      "spoiler": false
                  },
                  "components": [
                      {
                          "type": 10,
                          "content": "# **Tu nombre ira aqui** [Sin apodo]"
                      },
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
                    "custom_id": "9b74d685ffc5406b95d37fdd490ec891"
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
                  "content": "# Información: \n-# `🎎` **Sexo:**\n-# `🍭` **Edad:**\n-# `🎂` **Cumple:**\n-# `🛫` **C/Org:** \n-# `👑` **Linaje Familiar**\n-# `🎭` **Personalidad:** \n-# `🏈` **Especialidades:** \n"
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
                          "custom_id": "1295c06f8b0a4f0ef04817da94b5effc",
                          "options": [
                              {
                                  "label": "Nombre",
                                  "value": "155be4e346814e3f95cea58c85aebfc9",
                                  "description": "El nombre de tu personaje",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Apodo (opcional)",
                                  "value": "f6645e69fdf1428dda7b2d82e9ab8455",
                                  "description": "El apodo de tu personaje",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Cumpleaños",
                                  "value": "aafe2cfcdf024691ba58ff2608e0d80c",
                                  "description": "Día de cumpleaños (DD/MM)",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Ciudad de origen",
                                  "value": "d7b52952e08b4fccb74597b711cb907a",
                                  "description": "Ciudad en la que nació",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Linaje Familiar",
                                  "value": "52a979dc275e44ab953872b6d3e4374c",
                                  "description": "Apellido ",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Personalidad",
                                  "value": "7e9f079ade6c4d16b26433327fbd93c2",
                                  "description": "Estructura MBTI",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Especialidades",
                                  "value": "56d3d9f354b84da491c86309e0c6b73c",
                                  "description": "Actividades en las que es bueno",
                                  "emoji": null,
                                  "default": false
                              },
                              {
                                  "label": "Establecer historia",
                                  "value": "8717d93afb1f45cfd76245e369593117",
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
                  "type": 1,
                  "components": [
                      {
                          "type": 2,
                          "style": 3,
                          "label": "Guía / Tutorial",
                          "emoji": null,
                          "disabled": false,
                          "custom_id": "2abc6350b58f418fc90d79310fcdaf87"
                      },
                      {
                          "type": 2,
                          "style": 2,
                          "label": "Da tu opinión",
                          "emoji": null,
                          "disabled": false,
                          "custom_id": "eeb7020a266a49e2c6e0aa5616b87d19"
                      },
                      {
                          "type": 2,
                          "style": 4,
                          "label": "¡Borrar ficha!",
                          "emoji": null,
                          "disabled": false,
                          "custom_id": "866e72c2c5cd4cc5a3ac04aa13cc8c89"
                      },
                      {
                        "type": 2,
                        "style": 1,
                        "label": "Terminar ficha",
                        "emoji": null,
                        "disabled": false,
                        "custom_id": "866e72c2c5cd4cc5a3ac04aa13cc8c892"
                    }
                  ]
              }
          ]
      }
  ]


  const mascotas = [
    {
        "type": 17,
        "accent_color": 15703927,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://c.tenor.com/WWsyEIAgqNYAAAAC/tenor.gif"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**Zerav | PN**\n\n-# *Nivel:* 1\n-# *Experiencia:* 0/100\n-# *Tipo:* Zorra"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Alimentar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "a3de3f2336cd4b8ade316814015bc624"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495> Hambre"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Limpiar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "9af87fedfaca46c6c1b884ef468d815c"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495> Suciedad"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Jugar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "14c9286ea2274a42b010563f3ebb4054"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495> Diversión"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Dormir []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "66d5f6b88bf34b9be6b5220d48efc113"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495> Energia"
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
                        "type": 3,
                        "custom_id": "f5e164849aa747e293bda9e5473475dc",
                        "options": [
                            {
                                "label": "Mascota activa",
                                "value": "dd94b262d74649d6e47b734be1ad26b3",
                                "description": null,
                                "emoji": null,
                                "default": true
                            },
                            {
                                "label": "Abandonar",
                                "value": "074801ca5a0946d8fe95ec4848a4c852",
                                "description": null,
                                "emoji": null,
                                "default": false,
                                "disabled": false
                            }
                        ],
                        "placeholder": "Selecciona una actividad",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            }
        ]
    }
]


interaction.channel.messages.cache.get()
    

  
  const m = await interaction.reply({
    components: mascotas,
    flags: ["IsComponentsV2"],
    withResponse: true,
  })

  const message = m.resource.message
  
  await sleep(200)

    const mascotas2 = [
    {
        "type": 17,
        "accent_color": 15703927,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://c.tenor.com/WWsyEIAgqNYAAAAC/tenor.gif"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**Zerav | PN**\n\n-# *Nivel:* 1\n-# *Experiencia:* 0/100\n-# *Tipo:* Zorra"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Alimentar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "a3de3f2336cd4b8ade316814015bc624"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944> Hambre"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Limpiar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "9af87fedfaca46c6c1b884ef468d815c"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944> Suciedad"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Jugar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "14c9286ea2274a42b010563f3ebb4054"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944> Diversión"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Dormir []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "66d5f6b88bf34b9be6b5220d48efc113"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944> Energia"
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
                        "type": 3,
                        "custom_id": "f5e164849aa747e293bda9e5473475dc",
                        "options": [
                            {
                                "label": "Mascota activa",
                                "value": "dd94b262d74649d6e47b734be1ad26b3",
                                "description": null,
                                "emoji": null,
                                "default": true
                            },
                            {
                                "label": "Abandonar",
                                "value": "074801ca5a0946d8fe95ec4848a4c852",
                                "description": null,
                                "emoji": null,
                                "default": false,
                                "disabled": false
                            }
                        ],
                        "placeholder": "Selecciona una actividad",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            }
        ]
    }
]
    message.edit({components: mascotas2})
    await sleep(200)


    const mascotas3 = [
    {
        "type": 17,
        "accent_color": 15703927,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://c.tenor.com/WWsyEIAgqNYAAAAC/tenor.gif"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**Zerav | PN**\n\n-# *Nivel:* 1\n-# *Experiencia:* 0/100\n-# *Tipo:* Zorra"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Alimentar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "a3de3f2336cd4b8ade316814015bc624"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944> Hambre"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Limpiar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "9af87fedfaca46c6c1b884ef468d815c"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944> Suciedad"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Jugar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "14c9286ea2274a42b010563f3ebb4054"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944> Diversión"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Dormir []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "66d5f6b88bf34b9be6b5220d48efc113"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944> Energia"
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
                        "type": 3,
                        "custom_id": "f5e164849aa747e293bda9e5473475dc",
                        "options": [
                            {
                                "label": "Mascota activa",
                                "value": "dd94b262d74649d6e47b734be1ad26b3",
                                "description": null,
                                "emoji": null,
                                "default": true
                            },
                            {
                                "label": "Abandonar",
                                "value": "074801ca5a0946d8fe95ec4848a4c852",
                                "description": null,
                                "emoji": null,
                                "default": false,
                                "disabled": false
                            }
                        ],
                        "placeholder": "Selecciona una actividad",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            }
        ]
    }
]
    message.edit({components: mascotas3})
    await sleep(200)

    const mascotas4 = [
    {
        "type": 17,
        "accent_color": 15703927,
        "spoiler": false,
        "components": [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://c.tenor.com/WWsyEIAgqNYAAAAC/tenor.gif"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**Zerav | PN**\n\n-# *Nivel:* 1\n-# *Experiencia:* 0/100\n-# *Tipo:* Zorra"
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Alimentar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "a3de3f2336cd4b8ade316814015bc624"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PE:1374218668095045765> Hambre"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Limpiar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "9af87fedfaca46c6c1b884ef468d815c"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PE:1374218668095045765> Suciedad"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Jugar []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "14c9286ea2274a42b010563f3ebb4054"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`100%`** <:PI:1374218616601575495><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PM:1374218640764964944><:PE:1374218668095045765> Diversión"
                    }
                ]
            },
            {
                "type": 9,
                "accessory": {
                    "type": 2,
                    "style": 2,
                    "label": "Dormir []",
                    "emoji": null,
                    "disabled": false,
                    "custom_id": "66d5f6b88bf34b9be6b5220d48efc113"
                },
                "components": [
                    {
                        "type": 10,
                        "content": "**`70%`**  | <:PI:1374224204253237258><:PM:1374224241708240947><:PM:1374224241708240947><:PM:1374224241708240947><:PM:1374224241708240947><:PM:1374224241708240947><:PM:1374224241708240947><:PM:1374224241708240947><:EM:1374224400819294219><:EE:1374224348289699985>   Energia  "
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
                        "type": 3,
                        "custom_id": "f5e164849aa747e293bda9e5473475dc",
                        "options": [
                            {
                                "label": "Mascota activa",
                                "value": "dd94b262d74649d6e47b734be1ad26b3",
                                "description": null,
                                "emoji": null,
                                "default": true
                            },
                            {
                                "label": "Abandonar",
                                "value": "074801ca5a0946d8fe95ec4848a4c852",
                                "description": null,
                                "emoji": null,
                                "default": false,
                                "disabled": false
                            }
                        ],
                        "placeholder": "Selecciona una actividad",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            }
        ]
    }
]

    message.edit({components: mascotas4})


}