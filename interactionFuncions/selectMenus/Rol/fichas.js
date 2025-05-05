const { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle} = require(`discord.js`);
const { updateMessage } = require("../../modals/Rol/Modal crearFicha");
const clientdb = require("../../../Server");
let buttonAuthor;
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
module.exports = {
    customId: "crear_ficha",
    selectAutor: true,

    /**
     * 
     * @param {*} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async (client, interaction, character) => {
        console.log(interaction.values[0])

        const [ action, extra ] = interaction.values[0].split("*")

        const userfind = await userdb.findOne({_id: interaction.user.id})
        const messageId = userfind?.messageTemp
        const channel = await client.channels.fetch(userfind.channelTemp)
        const msg = await channel.messages.fetch(messageId)

        const modal = new ModalBuilder()
        .setTitle("Creacion de ficha")
        .setCustomId("actualizarPerfil")
        const row = new ActionRowBuilder()
        console.log("info extra", extra)
        console.log("info action", action)
    
    switch ((action || interaction.values[0])) {
        case "nombre":
            const nombre = new TextInputBuilder()
            .setCustomId("nombrepj")
            .setLabel("Nombra a tu personaje")
            .setPlaceholder("Ej: Shuciika")
            .setStyle(TextInputStyle.Short)
            .setMinLength(4)
            .setMaxLength(18)
            .setRequired(true)

            modal.setCustomId("actualizarPerfil-nombre")
            row.addComponents(nombre)
            break;
        case "apodo": 
        const apodo = new TextInputBuilder()
        .setCustomId("apodopj")
        .setLabel("Apodo")
        .setPlaceholder("(Deja este campo vacio si no tiene apodo)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(18)
        .setRequired(false)
        modal.setCustomId("actualizarPerfil-apodo")
        row.addComponents(apodo)
            break;
        case "sexo": 


        if(extra) {

            try {

                await Cachedb.updateOne({_id: interaction.user.id}, {
                    $setOnInsert: {created: Date.now(),
                  },
                    $set: {
                        sexo: extra,
                    }
                  }, {upsert: true})

                  const info = {
                    userId: interaction.user.id,
                    action: action,
                    option: extra
                  }
      
        
                  await interaction.deferUpdate();
      
                 await updateMessage(interaction,msg, null, true, info);
                 
              }catch (error) {
                  console.log("Error al actualizar el apodo", error);
              }
              return;
        }

        const jsonV2Sex = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": "https://i.pinimg.com/736x/54/f5/34/54f5342560444a7bedce8d9854b8a401.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Elige el sexo de tu personaje "
                            }
                        ]
                    },
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 3,
                                "custom_id": `crear_ficha-${interaction.user.id}`,
                                "options": [
                                    {
                                        "label": "Masculino",
                                        "value": "sexo*Masculino",
                                        "description": null,
                                        "emoji":  {
                                            "id": "1368440396614602853",
                                            "name": "boy",
                                            "animated": false
                                        },
                                        "default": false
                                    },
                                    {
                                        "label": "Femenino",
                                        "value": "sexo*Femenino",
                                        "description": null,
                                        "emoji": {
                                            "id": "1368440420824256672",
                                            "name": "girl",
                                            "animated": false
                                        },
                                        "default": false
                                    },
                                    {
                                        "label": "No binario",
                                        "value": "sexo*No binario",
                                        "description": null,
                                        "emoji":  {
                                            "id": "1368440451853582386",
                                            "name": "question",
                                            "animated": false
                                        },
                                        "default": false
                                    }
                                ],
                                "placeholder": "Selecciona una opción...",
                                "min_values": 1,
                                "max_values": 1,
                                "disabled": false
                            }
                        ]
                    }
                ]
            }
        ]

       return await interaction.reply({components: jsonV2Sex, flags: ["Ephemeral", "IsComponentsV2"]})
                break;
        case "edad": 
        const edad = new TextInputBuilder()
        .setCustomId("edadpj")
        .setLabel("¿Cuantos años tendra? (Edad)")
        .setPlaceholder("Responde con un numero (Edad Min: 13, Edad max: 22)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(2)
        .setRequired(true)

        modal.setCustomId("actualizarPerfil-edad")
        row.addComponents(edad)
                break;
        case "cumpleaños":
            const cumpleaños = new TextInputBuilder()
            .setCustomId("cumplepj")
            .setLabel("Cumpleaños de tu personaje")
            .setPlaceholder("**Respuesta con numeros. Recuerda respetar la diagonal para separar /** (04/12 => Día/Mes)")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(3)
            .setMaxLength(5)
            .setRequired(true)
            row.addComponents(cumpleaños)
            modal.setCustomId("actualizarPerfil-cumpleaños")
            break;
        case "ciudadorg": 
            const ciudadorg = new TextInputBuilder()
            .setCustomId("ciudadpj")
            .setLabel("¿Tu personaje vivía en...? (Ciudad de origen)")
            .setPlaceholder("Puede ser una ciudad inventada o real")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(12)
            .setRequired(true)
            row.addComponents(ciudadorg)
            modal.setCustomId("actualizarPerfil-ciudadorg")
            break;
        case "personalidad":

        if(extra) {

            try {

                await Cachedb.updateOne({_id: interaction.user.id}, {
                    $setOnInsert: {created: Date.now(),
                  },
                    $set: {
                        personalidad: extra,
                    }
                  }, {upsert: true})

                  const info = {
                    userId: interaction.user.id,
                    action: action,
                    option: extra
                  }
      
        
                  await interaction.deferUpdate();
      
                 await updateMessage(interaction,msg, null, true, info);
                 
              }catch (error) {
                  console.log("Error al actualizar el apodo", error);
              }
              return;
        }

            const personalidadV2 = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/originals/9b/77/07/9b7707ecb96eb24a57b7c6531236b540.gif"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Elige la personalidad de tu personaje"
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
                                    "custom_id": `crear_ficha-${interaction.user.id}`,
                                    "options": [
                                        {
                                            "label": "𖹭.ᐟ ANALISTAS:",
                                            "value": "notOpcion*A",
                                            "description": null,
                                            "emoji": null,
                                            "default": false,
                                            "disabled": true
                                        },
                                        {
                                            "label": "⤿ Arquitecto Arcano (INTJ) ࣪",
                                            "value": "personalidad*INTJ",
                                            "description": "Estrategas meticulosos que dominan la teoría mágica",
                                            "emoji": null,
                                            "default": false,
                                        },
                                        {
                                            "label": "⤿ Lógico Místico (INTP) ࣪",
                                            "value": "personalidad*INTP",
                                            "description": "Inventores de nuevos hechizos y teorías mágicas",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Comandante de Hechiceros (ENTJ)",
                                            "value": "personalidad*ENTJ",
                                            "description": "Líderes naturales de grupos mágicos",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Innovador Arcano (ENTP)",
                                            "value": "personalidad*ENTP",
                                            "description": "Debatientes que desafían las normas mágicas",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "ָ☾. DIPLOMÁTICOS:",
                                            "value": "notOpcion*B",
                                            "description": null,
                                            "emoji": null,
                                            "default": false,
                                            "disabled": true
                                        },
                                        {
                                            "label": "⤿ Consejero Visionario (INFJ)",
                                            "value": "personalidad*INFJ",
                                            "description": "Guardianes de antiguas profecías",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Sanador Empático (INFP)",
                                            "value": "personalidad*INFP",
                                            "description": "Curadores que conectan con las emociones",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Líder Inspirador (ENFJ)",
                                            "value": "personalidad*ENFJ",
                                            "description": "Mentores carismáticos de jóvenes magos",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Activista Mágico (ENFP)",
                                            "value": "personalidad*ENFP",
                                            "description": "Revolucionarios que luchan por la igualdad",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⋆˙⟡ CENTINELAS: ",
                                            "value": "notOpcion*C",
                                            "description": null,
                                            "emoji": null,
                                            "default": false,
                                            "disabled": true
                                        },
                                        {
                                            "label": "⤿ Guardián del Orden (ISTJ)",
                                            "value": "personalidad*ISTJ",
                                            "description": "Defensores de las tradiciones mágicas",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Protector Devoto (ISFJ)",
                                            "value": "personalidad*ISFJ",
                                            "description": "Guardaespaldas mágicos y cuidadores",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Ejecutor de Leyes (ESTJ)",
                                            "value": "personalidad*ESTJ",
                                            "description": "Administradores de instituciones mágicas",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Embajador Mágico (ESFJ)",
                                            "value": "personalidad*ESFJ",
                                            "description": "Mediadores entre comunidades",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⋆☀︎. EXPLORADORES: ",
                                            "value": "notOpcion*D",
                                            "description": null,
                                            "emoji": null,
                                            "default": false,
                                            "disabled": true
                                        },
                                        {
                                            "label": "⤿ Artesano Místico (ISTP)",
                                            "value": "personalidad*ISTP",
                                            "description": "Maestros en la creación de objetos mágicos",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Artista Elemental (ISFP)",
                                            "value": "personalidad*ISFP",
                                            "description": "Creadores que expresan magia a través del arte",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Aventurero Mágico (ESTP)",
                                            "value": "personalidad*ESTP",
                                            "description": "Exploradores de lugares peligrosos",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "⤿ Animador Ilusionista (ESFP)",
                                            "value": "personalidad*ESFP",
                                            "description": "Entretenedores con magia espectacular",
                                            "emoji": null,
                                            "default": false
                                        }
                                    ],
                                    "placeholder": "Selecciona una opción...",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        },
                        {
                            "type": 10,
                            "content": "Si tienes dudas, recuerda revisar los [Arquetipos de personalidad](https://canary.discord.com/channels/716342375303217285/1362988047578435605) ( •̀ ω •́ )✧\n\n" +
                            `-# Nota:  Manifiesten para que Discord agregue la posibilidad de deshabilitar opciones de los Select Menus >:`
                        }
                    ]
                }
            ]

            return interaction.reply({components: personalidadV2, flags: ["Ephemeral", "IsComponentsV2"]})
        case "apellido":
            const familia = new TextInputBuilder()
            .setCustomId("familiapj")
            .setLabel("¿Tu personaje tiene apellido (Familia)?")
            .setPlaceholder("Dejar en blanco si no tiene ningun apellido o linaje familiar")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setRequired(false)
            modal.setCustomId("actualizarPerfil-apellido")
            row.addComponents(familia)
            break; 
        case "especialidades": 
            const especialidad = new TextInputBuilder()
            .setCustomId("especialidadpj")
            .setLabel("¿En que es bueno tu personaje?")
            .setPlaceholder("Respuesta libre [Maximo 4 cosas] - (Deportes, cocina, videojuegos o cosas mas especificas)")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(30)
            .setRequired(false)
            row.addComponents(especialidad)
            modal.setCustomId("actualizarPerfil-especialidades")
        break;
        case "historia": 
        const historia = new TextInputBuilder()
        .setCustomId("historiapj")
        .setLabel("Cuentame más de tu personaje... (Prologo)")
        .setPlaceholder("[Opcional] Respuesta libre. ")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setMinLength(20)
        .setRequired(false)
        row.addComponents(historia)
        modal.setCustomId("actualizarPerfil-historia")
        break;
        case "notOpcion" :
        return interaction.reply({content: "Hey, eso es solo una opción de decoración ＞﹏＜", flags: ["Ephemeral"]})
        default:
            break;
    }



        const MDs = new TextInputBuilder()
        .setCustomId("mds")
        .setLabel("¿Te envío tu ficha por mensaje directo?")
        .setPlaceholder('Responde solamente con "Si" y "No"')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true)
      

        modal.addComponents(row)
        await interaction.showModal(modal)
    }
};