const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const Cachedb = db2.collection("CachePJ")
const dataCache = new Map()
const { formatearTextoLim } = require("../../../utils/textStrings")

module.exports = {
    customId: "actualizarPerfil",
    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async function(client, interaction, selectOption, messageIds) {
        const userfind = await userdb.findOne({_id: interaction.user.id})
        const fechaRegex = /^(\d{1,2})[\/\-](\d{1,2})$/;

        if(messageIds) {
            const messag = await interaction.channel.messages.fetch(messageIds)
            console.log(selectOption)

            switch (selectOption) {
                case "nombre":
                  const nombre = interaction.fields.getTextInputValue("nombrepj")
        
                  if(await Badwords()) {
                    return interaction.reply({content: `¡Hey! El nombre **${nombre}** contiene malas palabras（︶^︶）\n-# [Verifica el nombre de tu personaje]`, ephemeral: true})
                  }
        
                  try {
                    await characters.updateOne({_id: interaction.user.id}, {
                        $setOnInsert: {created: Date.now(),
                        },
                        $set: {
                            Nombre: nombre,
                        }
                      }, {upsert: true})
        
            
                      await interaction.deferUpdate()
        
                     await this.updateMessage(interaction, messag, "character")
                    
                  } catch (error) {
                    console.log("Error al actualizar el nombre", error)
                  }
        
                  return
        
                    break;
                case "apodo": 
                const apodo = interaction.fields.getTextInputValue("apodopj")
        
                if(await Badwords(apodo)) {
                  return interaction.reply({content: `¡Hey! El apodo **${apodo}** contiene malas palabras（︶^︶）\n-# [Verifica el apodo de tu personaje]`, ephemeral: true})
                }
        
                try {
                  await characters.updateOne({_id: interaction.user.id}, {
                      $setOnInsert: {created: Date.now(),
                    },
                      $set: {
                          Apodo: apodo,
                      }
                    }, {upsert: true})
        
          
                    await interaction.deferUpdate()
        
                   await this.updateMessage(interaction, messag, "character")
                }catch (error) {
                    console.log("Error al actualizar el apodo", error)
                  }
                break;
                case "edad": 
                const edadpj = interaction.fields.getTextInputValue("edadpj")
        
                if(isNaN(edadpj)) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se admiten valores numericos]`", ephemeral: true})
                }
            
                if(edadpj <= 13 || edadpj >= 22) {
                    return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se permiten edades mayores a 13 y menores a 22]`", ephemeral: true})
                }
        
                try {
                    await characters.updateOne({_id: interaction.user.id}, {
                        $setOnInsert: {created: Date.now(),
                        },
                        $set: {
                            Edad: edadpj,
                        }
                      }, {upsert: true})
        
                    await interaction.deferUpdate()
        
                    await this.updateMessage(interaction, messag, "character")
                } catch (error) {
                    console.error("Error al actualizar la edad", error)
                }
        
        
        
                        break;
                case "cumpleaños":
                let cumplepj = interaction.fields.getTextInputValue("cumplepj");
                const validarFecha = validarYformatearFecha(cumplepj)
            
                if(validarFecha?.error) {
                    return interaction.reply({ content: validarFecha.error, flags: "Ephemeral"})
                }else {
                    cumplepj = validarFecha
                }
        
                try {
                    await characters.updateOne({_id: interaction.user.id}, {
                        $setOnInsert: {created: Date.now(),
                        },
                        $set: {
                            Cumpleaños: cumplepj,
                        }
                      }, {upsert: true})
        
                    await interaction.deferUpdate()
        
                    await this.updateMessage(interaction, messag, "character")
                } catch (error) {
                    console.error("Error al actualizar el cumpleaños", error)
                }
        
                break;
                case "ciudadorg": 
                    const ciudadOrg = interaction.fields.getTextInputValue("ciudadpj")
              
                        if(await Badwords(ciudadOrg)) {
                          return interaction.reply({content: `¡Hey! la ciudad **${ciudadOrg}** contiene malas palabras（︶^︶）\n-# [Verifica la ciudad de tu personaje]`, ephemeral: true})
                        }
              
                        try {
                          await characters.updateOne({_id: interaction.user.id}, {
                              $setOnInsert: {created: Date.now(),
                              },
                              $set: {
                                  CiudadOrg: ciudadOrg,
                              }
                            }, {upsert: true})
              
                  
                            await interaction.deferUpdate()
              
                           await this.updateMessage(interaction, messag, "character")
                          
                        } catch (error) {
                          console.log("Error al actualizar el nombre", error)
                        }
                    break;
                case "personalidad":
                    if(extra) {
                        try {
                            await characters.updateOne({_id: interaction.user.id}, {
                                $setOnInsert: {created: Date.now(),
                              },
                                $set: {
                                    Personalidad: extra,
                                }
                              }, {upsert: true})
                  
                    
                              await interaction.deferUpdate();
                  
                             await this.updateMessage(interaction, messag, "character");
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
                                            "custom_id": "4d437fa68917439283ea331acff41ae0",
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
                    const family = interaction.fields.getTextInputValue("familiapj")
        
                    if(await Badwords(family)) {
                      return interaction.reply({content: `¡Hey! el apellido **${family}** contiene malas palabras（︶^︶）\n-# [Verifica el apellido de tu personaje]`, ephemeral: true})
                    }
          
                    try {
                      await characters.updateOne({_id: interaction.user.id}, {
                          $setOnInsert: {created: Date.now(),
                          },
                          $set: {
                              Familia: family,
                          }
                        }, {upsert: true})
          
              
                        await interaction.deferUpdate()
          
                       await this.updateMessage(interaction, messag, "character")
                      
                    } catch (error) {
                      console.log("Error al actualizar el nombre", error)
                    }
                    break; 
                case "especialidades": 
                    const especialidad = interaction.fields.getTextInputValue("especialidadpj")
        
                    try {
                        await characters.updateOne({_id: interaction.user.id}, {
                            $setOnInsert: {created: Date.now(),
                            },
                            $set: {
                                Especialidad: especialidad,
                            }
                          }, {upsert: true})
            
                
                          await interaction.deferUpdate()
            
                         await this.updateMessage(interaction, messag, "character")
                        
                      } catch (error) {
                        console.log("Error al actualizar el nombre", error)
                      }
        
                break;
                case "historia": 

                    const historia = interaction.fields.getTextInputValue("historiapj")
        
                    try {
                        await characters.updateOne({_id: interaction.user.id}, {
                            $setOnInsert: {created: Date.now(),
                            },
                            $set: {
                                Historia: historia,
                            }
                          }, {upsert: true})
            
                
                          await interaction.deferUpdate()
            
                         await this.updateMessage(interaction, messag, "character")
                        
                      } catch (error) {
                        console.log("Error al actualizar el nombre", error)
                      }
        
                      break;
                case "descripcion": 

                const descripcion = interaction.fields.getTextInputValue("descripcionset")
                try {
                    await characters.updateOne({_id: interaction.user.id}, {
                        $setOnInsert: {created: Date.now(),
                        },
                        $set: {
                            Descripcion: descripcion,
                        }
                      }, {upsert: true})
        
            
                      await interaction.deferUpdate()
        
                     await this.updateMessage(interaction, messag, "character")
                    
                  } catch (error) {
                    console.log("Error al actualizar el nombre", error)
                  }

                default:
            }

            return;
        }

        const messageId = userfind.messageTemp
        const channel = await client.channels.fetch(userfind.channelTemp)
        const msg = await channel.messages.fetch(messageId)
        let cacheCharacter = dataCache.get(interaction.user.id)


        if(!cacheCharacter) {
            const dbcharacter = await Cachedb.findOne({_id: interaction.user.id});

                const obj = {
                    nombre: dbcharacter?.nombre,
                    apodo: dbcharacter?.apodo,
                    edad: dbcharacter?.edad,
                    sexo: dbcharacter?.sexo,
                    cumpleaños: dbcharacter?.cumpleaños,
                    ciudadOrg: dbcharacter?.ciudadOrg,
                    personalidad: dbcharacter?.personalidad,
                    familia: dbcharacter?.familia,
                    especialidad: dbcharacter?.especialidad,
                    historia: dbcharacter?.historia,
                    avatarURL: dbcharacter?.avatarURL,
                }

                dataCache.set(interaction.user.id, obj)

                cacheCharacter = dataCache.get(interaction.user.id)

        }

        switch (selectOption) {
        case "nombre":
          const nombre = interaction.fields.getTextInputValue("nombrepj")

          if(await Badwords()) {
            return interaction.reply({content: `¡Hey! El nombre **${nombre}** contiene malas palabras（︶^︶）\n-# [Verifica el nombre de tu personaje]`, ephemeral: true})
          }

          try {
            cacheCharacter.nombre = nombre
            await Cachedb.updateOne({_id: interaction.user.id}, {
                $setOnInsert: {created: Date.now(),
                },
                $set: {
                    nombre: nombre,
                }
              }, {upsert: true})

    
              await interaction.deferUpdate()

             await this.updateMessage(interaction, msg, cacheCharacter)
            
          } catch (error) {
            console.log("Error al actualizar el nombre", error)
          }

          return

            break;
        case "apodo": 
        const apodo = interaction.fields.getTextInputValue("apodopj")

        if(await Badwords(apodo)) {
          return interaction.reply({content: `¡Hey! El apodo **${apodo}** contiene malas palabras（︶^︶）\n-# [Verifica el apodo de tu personaje]`, ephemeral: true})
        }

        try {
          cacheCharacter.apodo = apodo
          await Cachedb.updateOne({_id: interaction.user.id}, {
              $setOnInsert: {created: Date.now(),
            },
              $set: {
                  apodo: apodo,
              }
            }, {upsert: true})

  
            await interaction.deferUpdate()

           await this.updateMessage(interaction, msg, cacheCharacter)
        }catch (error) {
            console.log("Error al actualizar el apodo", error)
          }
        break;
        case "edad": 
        const edadpj = interaction.fields.getTextInputValue("edadpj")

        if(isNaN(edadpj)) {
            return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se admiten valores numericos]`", ephemeral: true})
        }
    
        if(edadpj < 13 || edadpj > 22) {
            return interaction.reply({ content: "Colocaste un valor incorrecto en **`Edad`** (・・;).\n `[Solo se permiten edades mayores a 13 y menores a 22]`", ephemeral: true})
        }

        try {
            cacheCharacter.edad = edadpj
            await Cachedb.updateOne({_id: interaction.user.id}, {
                $setOnInsert: {created: Date.now(),
                },
                $set: {
                    edad: edadpj,
                }
              }, {upsert: true})

            await interaction.deferUpdate()

            await this.updateMessage(interaction, msg, cacheCharacter)
        } catch (error) {
            console.error("Error al actualizar la edad", error)
        }



                break;
        case "cumpleaños":
        let cumplepj = interaction.fields.getTextInputValue("cumplepj");
        const validarFecha = validarYformatearFecha(cumplepj)
    
        if(validarFecha?.error) {
            return interaction.reply({ content: validarFecha.error, flags: "Ephemeral"})
        }else {
            cumplepj = validarFecha
        }

        try {
            cacheCharacter.cumpleaños = cumplepj
            await Cachedb.updateOne({_id: interaction.user.id}, {
                $setOnInsert: {created: Date.now(),
                },
                $set: {
                    cumpleaños: cumplepj,
                }
              }, {upsert: true})

            await interaction.deferUpdate()

            await this.updateMessage(interaction, msg, cacheCharacter)
        } catch (error) {
            console.error("Error al actualizar el cumpleaños", error)
        }

        break;
        case "ciudadorg": 
            const ciudadOrg = interaction.fields.getTextInputValue("ciudadpj")
      
                if(await Badwords(ciudadOrg)) {
                  return interaction.reply({content: `¡Hey! la ciudad **${ciudadOrg}** contiene malas palabras（︶^︶）\n-# [Verifica la ciudad de tu personaje]`, ephemeral: true})
                }
      
                try {
                  cacheCharacter.ciudadOrg = ciudadOrg
                  await Cachedb.updateOne({_id: interaction.user.id}, {
                      $setOnInsert: {created: Date.now(),
                      },
                      $set: {
                          ciudadOrg: ciudadOrg,
                      }
                    }, {upsert: true})
      
          
                    await interaction.deferUpdate()
      
                   await this.updateMessage(interaction, msg, cacheCharacter)
                  
                } catch (error) {
                  console.log("Error al actualizar el nombre", error)
                }
            break;
        case "personalidad":
            if(extra) {
                try {
                    cacheCharacter.personalidad = extra
                    await Cachedb.updateOne({_id: interaction.user.id}, {
                        $setOnInsert: {created: Date.now(),
                      },
                        $set: {
                            personalidad: extra,
                        }
                      }, {upsert: true})
          
            
                      await interaction.deferUpdate();
          
                     await this.updateMessage(interaction, msg, cacheCharacter);
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
                                    "custom_id": "4d437fa68917439283ea331acff41ae0",
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
            const family = interaction.fields.getTextInputValue("familiapj")

            if(await Badwords(family)) {
              return interaction.reply({content: `¡Hey! el apellido **${family}** contiene malas palabras（︶^︶）\n-# [Verifica el apellido de tu personaje]`, ephemeral: true})
            }
  
            try {
              cacheCharacter.familia = family
              await Cachedb.updateOne({_id: interaction.user.id}, {
                  $setOnInsert: {created: Date.now(),
                  },
                  $set: {
                      familia: family,
                  }
                }, {upsert: true})
  
      
                await interaction.deferUpdate()
  
               await this.updateMessage(interaction, msg, cacheCharacter)
              
            } catch (error) {
              console.log("Error al actualizar el nombre", error)
            }
            break; 
        case "especialidades": 
            const especialidad = interaction.fields.getTextInputValue("especialidadpj")

            try {
                cacheCharacter.especialidad = especialidad
                await Cachedb.updateOne({_id: interaction.user.id}, {
                    $setOnInsert: {created: Date.now(),
                    },
                    $set: {
                        especialidad: especialidad,
                    }
                  }, {upsert: true})
    
        
                  await interaction.deferUpdate()
    
                 await this.updateMessage(interaction, msg, cacheCharacter)
                
              } catch (error) {
                console.log("Error al actualizar el nombre", error)
              }

        break;
        case "historia": 
            const historia = interaction.fields.getTextInputValue("historiapj")

            try {
                cacheCharacter.historia = historia
                await Cachedb.updateOne({_id: interaction.user.id}, {
                    $setOnInsert: {created: Date.now(),
                    },
                    $set: {
                        historia: historia,
                    }
                  }, {upsert: true})
    
        
                  await interaction.deferUpdate()
    
                 await this.updateMessage(interaction, msg, cacheCharacter)
                
              } catch (error) {
                console.log("Error al actualizar el nombre", error)
              }

              break;
        case "opinion": 
            const channelop = client.channels.cache.get("1009685257215287346")
            const opinionpj = interaction.fields.getTextInputValue("opinionpj")

            const embedopinion = new EmbedBuilder()
            .setTitle("Opinion del comando Crear Ficha")
            .setDescription(`${opinionpj}`)
            .addFields({name: "Usuario:", value: `${interaction.user.username}`, inline: true})
            .setColor("Random")
          
            await channelop.send({embeds: [embedopinion]})
            await interaction.reply({content: "Gracias por dar tu opinion, apreciamos a todas las personitas que se toman el tiempo de hacerlo (≧◡≦) ♡", flags: ["Ephemeral"]})
            break;


        default:
        }



        async function Badwords(text) {
            const badwords = await import("bad-words");
            const filter = new badwords.Filter()



            if(filter.isProfane(text)){
                return true
            }else {
                return false
            }
        }

        function validarYformatearFecha(input) {
            const diasPorMes = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // indice 0,  valor (0) dummy

            if (!fechaRegex.test(input)) {
                return { error: "Formato inválido. Usa DD/MM ＞﹏＜" };
            }

            let [_, diaStr, mesStr] = fechaRegex.exec(input);
            let dia = parseInt(diaStr);
            let mes = parseInt(mesStr);

            let posiblesFechas = [
                { dia: dia, mes: mes }, // Interpretación original
                { dia: mes, mes: dia }  // Interpretación intercambiada
            ];

            let fechaValida = posiblesFechas.find(f => 
                f.mes >= 1 && f.mes <= 12 && f.dia >= 1 && f.dia <= 31
              );

            if (!fechaValida) {
                return { error: "Fecha inválida. ¿Intentaste día/mes?" };
            }

            dia = fechaValida.dia;
            mes = fechaValida.mes;
        

            const maxDias = diasPorMes[mes];
            if (dia > maxDias) {
                const mensajeFeb = mes === 2 ? "\n¡Recuerda! Febrero tiene máximo 28 días (29 en año bisiesto) ＞﹏＜" : "";
                return { error: `Día inválido para ${nombreMes(mes)} (1-${maxDias})${mensajeFeb}` };
              }
        
            return `${diaStr.padStart(2, '0')}/${mesStr.padStart(2, '0')}`
        }

        function nombreMes(mes) {
            const meses = [
                "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
            ];
            return meses[mes - 1];
        }
        
    },

    updateMessage: async function(interaction, message, data, externo, info,) { 
        const { messageBuild } = require("../../../handlers/CMDHandler/Rol/Configurar personaje");
        if(data === "character") {
            const userCache = await userdb.findOne({_id: interaction.user.id})
               const char = await characters.findOne({_id: interaction.user.id})

                const previewCharacter = await messageBuild(char, userCache, interaction, message.id)

                try {
                await message.edit({components: previewCharacter})
                }catch(error) {
                    console.log("Ocurrio un error al intentar mostrar el mensaje", error)
                }

                return;
        }

        if(externo) {
            data = dataCache.get(info.userId)

            if(!data) {
                const dbcharacter = await Cachedb.findOne({_id: interaction.user.id});
    
                    const obj = {
                        nombre: dbcharacter?.nombre,
                        apodo: dbcharacter?.apodo,
                        edad: dbcharacter?.edad,
                        sexo: dbcharacter?.sexo,
                        cumpleaños: dbcharacter?.cumpleaños,
                        ciudadOrg: dbcharacter?.ciudadOrg,
                        personalidad: dbcharacter?.personalidad,
                        familia: dbcharacter?.familia,
                        especialidad: dbcharacter?.especialidad,
                        historia: dbcharacter?.historia,
                        avatarURL: dbcharacter?.avatarURL,
                    }
    
                    dataCache.set(interaction.user.id, obj)
    
                    data = dataCache.get(interaction.user.id)
    
            }

            data[info.action] = info.option
        }

        const camposRequeridos = ["nombre", "edad", "sexo", "cumpleaños", "ciudadOrg", "personalidad"];
        const validSend = camposRequeridos.every(campo => data?.[campo])

        console.log(this.formatearTextoLim)

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
                                "url": `${data?.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter"}`
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": `# ${data?.nombre || "**Tu nombre estara aqui**"} *[${data?.apodo || "Sin apodo"}]* `
                            },
                            {
                                "type": 10,
                                "content": data?.historia ? "-# `Historia:`\n\n"+ `${formatearTextoLim(data?.historia, 270)}` : 
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
                        "content": "# Información: \n-# `🎎` **Sexo:** " + `${data?.sexo || "** **"}` +
                        "\n-# `🍭` **Edad:** " + `${data?.edad  || "** **"}` + "\n-# `🎂` **Cumple:** " + `${data?.cumpleaños  || "** **"}`+ "\n-# `🛫` **C/Org:** " 
                         + `${data?.ciudadOrg  || "** **"}` + "\n-# `👑` **Linaje Familiar:** " + `${data?.familia  || "** **"}` + 
                         "\n-# `🎭` **Personalidad:** " + `${data?.personalidad  || "** **"}` + "\n-# `🏈` **Especialidades:** " + `${data?.especialidad  || "** **"}`
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

        try {
            await message.edit({components: previewCharacter})
        } catch (error) {
            console.log("Ocurrio un error al intentar mostrar el mensaje", error)
        }



    },


}