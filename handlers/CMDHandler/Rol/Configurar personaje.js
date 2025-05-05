const { EmbedBuilder, ActionRowBuilder,  ChatInputCommandInteraction, StringSelectMenuBuilder, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db= clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const timeconvert = require("humanize-duration");
const dbconfig = db.collection("usuarios_server")
const version = require("../../../config")
const { procesarFoto } = require("../../../interactionFuncions/modals/Rol/Modal Foto");
const { formatearTextoLim } = require("../../../utils/textStrings");


module.exports = {
    requireCharacter: true,
    requireSoul: false,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: true,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


 ejecutar: async function(client, interaction, {character, cachepj}) {
    const userdb = await dbconfig.findOne({_id: interaction.user.id})
    const imgs = await interaction.options.getAttachment("foto")

    const message = await interaction.deferReply({withResponse: true})

    if(imgs) {
        const time =  300000 - (Date.now() - userdb?.time?.pjFoto) 

        if((Date.now() - userdb?.time?.pjFoto) < 300000) {
            return interaction.editReply({ content: "¡Oye!, Acabo de pegar tu foto... Bueno, es lo de menos (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y "})}` + "`** para establecer otra foto nueva (⇀‸↼‶)", ephemeral: true})
        }
  
        
        await procesarFoto(interaction, imgs.url)
        return 
    }

    const previewCharacter = await this.messageBuild(character, userdb, interaction, message.resource.message.id)


    await interaction.editReply({components: previewCharacter, flags:["IsComponentsV2"]})

 },

 messageBuild: async function(character, userdb, interaction, message) {


    const options = [
        {
            "label": "Historia", 
            "description": "Cambia o actualiza el lore de tu personaje",
            "value": `historia`,
            "emoji": {
                "name": "🦜",
                "id": null
            },
        }, 
        {
            "label": "Apodo",
            "description": "Otras formas de llamar a tu personaje",
            "value": `apodo`,
            "emoji": {
                "name": "🗿",
                "id": null
            },
        }, 
        {
            "label": "Descripcion", 
            "description": "Establece una descripcion al perfil de tu personaje",
            "value": `descripcion`,
            "emoji":  {
                "name": "🔖",
                "id": null
            },
        }, 
    ]

    const especiales = [
        { key: "cumpleaños",  opt: { "label":"Cumpleaños [E]", "description": "Actualiza el cumpleaños de tu personaje", "value": `cumpleaños`, "emoji": {"name": "🎂", "id": null}},},
        { key: "nombre",      opt: { "label":"Nombre [E]", "description": "Cambia el nombre de tu personaje", "value": "nombre", "emoji": {"name": "📖", "id": null}  } },
        { key: "familia",     opt: { "label":"Familia [E]", "description": "Cambia el apellido/familia de tu personaje", "value": `familia`, "emoji": {"name":"👪", "id": null}  } },
        { key: "ciudadOrg",  opt: { "label":"Ciudad Org [E]", "description": "Cambia la ciudad de origen de tu personaje", "value": `ciudadOrg`, "emoji": {"name": "🏙️", "id": null} } },
        { key: "personalidad",  opt: { "label":"Personalidad [E]", "description": "Cambia la personalidad de tu personaje", "value": `personalidad`, "emoji": {"name": "🎭", "id": null}} },
        { key: "especialidades",  opt: { "label":"Especialidades [E]", "description": "Cambia las especialidades de tu personaje", "value": `especialidad`, "emoji": {"name": "🏂", "id": null} } },
      ];
      
      // añade solo las que el usuario tiene en data
      for (const { key, opt } of especiales) {
        if (userdb?.especial?.[key] > 0) options.push(opt);
      }

    const Nombre = character?.Nombre || "**Tu nombre estara aqui**"
    const Apodo = character?.Apodo || "Sin apodo"
    const foto = character?.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter"

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
                                "content": (character?.Historia ? "-# `Historia:`\n\n"+ `${formatearTextoLim(character?.Historia, 270)}` : 
                                 "-# `Historia:`\n-# *in rol / no establecida*") + `\n-# Descripcion: ${character?.Descripcion ? character.Descripcion : "Sin descripcion"}`
                            }
                        ]
                            
                    },
                    {
                      "type": 9,
                      "accessory": {
                          "type": 2,
                          "style": 2,
                          "label": "Cambiar foto",
                          "emoji": null,
                          "disabled": false,
                          "custom_id": `configurar_personaje-${interaction.user.id}-foto-${message}`
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
                        "content": "# Información: \n-# `🎎` **Sexo:** " + `${character?.Sexo || "** **"}` +
                        "\n-# `🍭` **Edad:** " + `${character?.Edad  || "** **"}` + "\n-# `🎂` **Cumple:** " + `${character?.Cumpleaños  || "** **"}`+ "\n-# `🛫` **C/Org:** " 
                         + `${character?.CiudadOrg  || "** **"}` + "\n-# `👑` **Linaje Familiar:** " + `${character?.Familia  || "** **"}` + 
                         "\n-# `🎭` **Personalidad:** " + `${character?.Personalidad  || "** **"}` + "\n-# `🏈` **Especialidades:** " + `${character?.Especialidad  || "** **"}`
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
                        "type": 10,
                        "content": "**`Opciones disponibles:`**\n\n-# - `📷` *Foto*\n-# - `🦜` *Historia*\n-# - `🗿` *Apodo*\n-# - `🔖` *Descripción*\n\n**`Requiere de permiso especiales`**\n\n-# `No disponible:` Necesitas obtener permisos\n-# `Disponible:` Cumples los requisitos para usar esa opción\n\n" +
                                "-# - `📖` " + `Nombre ${userdb?.especial?.nombre > 0 ? "[Disponible]" : "[No disponible]"}\n`+ 
                                "-# - `🎂` " + `Cumpleaños ${userdb?.especial?.cumpleaños > 0 ? "[Disponible]": "[No disponible]"}\n` + 
                                "-# - `👨‍👩‍👧‍👦` " + `Familia / Apellido ${userdb?.especial?.familia > 0 ? "[Disponible]": "[No disponible]"}\n` +
                                "-# - `🏙️` " + `Ciudad Org ${userdb?.especial?.ciudadOrg > 0 ? "[Disponible]": "[No disponible]"}\n`+
                                "-# - `🎭` " + `Personalidad ${userdb?.especial?.personalidad > 0 ? "[Disponible]": "[No disponible]"}\n` +
                                "-# - `🏂` " + `Especialidades ${userdb?.especial?.especialidad > 0 ? "[Disponible]": "[No disponible]"}\n` 
                            
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `update_character-${interaction.user.id}-${message}`,
                                "options": options,
                                "placeholder": "Personaliza tu personaje",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    },
                ]
            }
    ]

    return previewCharacter
 }
}