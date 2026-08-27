const { ChatInputCommandInteraction, Client } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdbs = db.collection("usuarios_server")
const { messageBuild } = require("../../../handlers/CMDHandler/Rol/Personajes/Configurar personaje");
const { version, versionEc, versionRol } = require("../../../config");
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")

module.exports = {
    customId: "configuracion",
    selectAutor: true,

    /**
    * @param {Object} context
    * @param {Client} context.client - El cliente de Discord.
    * @param {ChatInputCommandInteraction} context.interaction - La interacción del comando.
    */
    ejecutar: async ({ client, interaction, character, componentData, options: { option1: accionPrivacidad } }) => {

        const [action, key] = componentData.split("*")

        if (accionPrivacidad === "configPriv") {
            characters.updateOne({ _id: character._id }, {
                $set: {
                    [`privacidad.${action}`]: key
                }
            })
            character.privacidad ??= {}
            character.privacidad[`${action}`] = key

            const message = privMessage(character)

            await interaction.update({ components: message })
            return;
        }

        if (accionPrivacidad === "selectCharacter") {
            await userdbs.updateOne({ _id: interaction.user.id }, {
                $set: {
                    "nix.personajeActivo": Number(action)
                }
            })

            const inicioMess = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "**La sincronización ha comenzado... Transfiriendo tu consciencia al alma elegida**"
                        }
                    ]
                }
            ]

            const intermedio = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": "https://cdn.discordapp.com/attachments/857300864107282462/1401787286684962857/blackswain-1.gif?ex=68918ba5&is=68903a25&hm=eb70077aa1a7e5d72685ab8af4fc7b298d39cb7b9ecfdac051d147ffc66dd22c&"
                                    },
                                    "description": null,
                                    "spoiler": false
                                }
                            ]
                        }
                    ]
                }
            ]

            const finalSesion = [
                {
                    "type": 17,
                    "accent_color": null,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "**El vínculo se ha transferido. Un nuevo par de ojos se abren a la voluntad de tu alma.**"
                        },
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": "https://i.pinimg.com/originals/48/72/68/4872684130ed1ab447b6ec065562c278.gif"
                                    },
                                    "description": null,
                                    "spoiler": false
                                }
                            ]
                        }
                    ]
                }
            ]

            await interaction.update({ components: inicioMess }).then(setTimeout(() => interaction.editReply({ components: intermedio }), 4500))
            setTimeout(() => interaction.editReply({ components: finalSesion }), 15500)

            setTimeout(() => interaction.deleteReply(), 21000)
        }

        const userdb = await userdbs.findOne({ _id: interaction.user.id })

        switch (action) {
            case "personaje":

                const message = await messageBuild(character, userdb, interaction, null)

                await interaction.reply({ components: message, flags: ["IsComponentsV2", "SuppressNotifications"] })
                break;

            case "privacidad":
                const messagePriv = privMessage(character)

                await interaction.update({ components: messagePriv })
                break;
            case "switch":
                const messageCharacter = await switchCharacter(userdb)
                await interaction.update({ components: messageCharacter })
                break;
            default:
                break;
        }


        function privMessage(character) {
            const message = [
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
                                    "url": "https://i.pinimg.com/1200x/55/cb/a5/55cba54b6d1c1cc7f8cefbf11f33ac2d.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Configuración de privacidad"
                                },
                                {
                                    "type": 10,
                                    "content": "-# Algunas configuraciones están en fase de desarrollo, es posible que no se apliquen del todo.\n\n-# " +
                                        "Aviso: Solo aplican dentro del sistema del bot, esto no afecta el text rol"
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "**✧ Regalos:**\n-# ¿Quién puede enviarte regalos mágicos u objetos?"
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 3,
                                    "custom_id": `configuracion-${interaction.user.id}-configPriv-a`,
                                    "options": [
                                        {
                                            "label": "Todos",
                                            "value": `regalos*todos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710472302034985",
                                                name: "Cinnamoroll_shock"
                                            },
                                            "default": character.privacidad?.regalos === "todos"
                                        },
                                        {
                                            "label": "Solo amigos",
                                            "value": `regalos*amigos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710462084579470",
                                                name: "Cinnamoroll_happy"
                                            },
                                            "default": character.privacidad?.regalos === "amigos"
                                        },
                                        {
                                            "label": "Solo compañero",
                                            "value": `regalos*compañero`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710483437785148",
                                                name: "Cinnamoroll_love"
                                            },
                                            "default": character.privacidad?.regalos === "compañero"
                                        },
                                        {
                                            "label": "Nadie",
                                            "value": `regalos*nadie`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710448994287736",
                                                name: "Cinnamoroll_sleep"
                                            },
                                            "default": character.privacidad?.regalos === "nadie"
                                        }
                                    ],
                                    "placeholder": "Sin configurar",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        },
                        {
                            "type": 10,
                            "content": "✧ Combate:\n-# ¿Quién puede retarte a combates PvP o duelos mágicos? (Si deshabilitas esta opción no podrás retar a otros usuarios / esto solo aplica en pvp amistosos)"
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 3,
                                    "custom_id": `configuracion-${interaction.user.id}-configPriv-b`,
                                    "options": [
                                        {
                                            "label": "Todos",
                                            "value": `combate*todos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710472302034985",
                                                name: "Cinnamoroll_shock"
                                            },
                                            "default": character.privacidad?.combate === "todos"
                                        },
                                        {
                                            "label": "Solo amigos",
                                            "value": `combate*amigos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710462084579470",
                                                name: "Cinnamoroll_happy"
                                            },
                                            "default": character.privacidad?.combate === "amigos"
                                        },
                                        {
                                            "label": "Solo compañero",
                                            "value": `combate*compañero`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710483437785148",
                                                name: "Cinnamoroll_love"
                                            },
                                            "default": character.privacidad?.combate === "compañero"
                                        },
                                        {
                                            "label": "Nadie",
                                            "value": `combate*nadie`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710448994287736",
                                                name: "Cinnamoroll_sleep"
                                            },
                                            "default": character.privacidad?.combate === "nadie"
                                        }
                                    ],
                                    "placeholder": "Sin configurar",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        },
                        {
                            "type": 10,
                            "content": "✧ Ver alma:\n-# ¿Quién puede ver la información de tu alma y atributos?"
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 3,
                                    "custom_id": `configuracion-${interaction.user.id}-configPriv-c`,
                                    "options": [
                                        {
                                            "label": "Todos",
                                            "value": `alma*todos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710472302034985",
                                                name: "Cinnamoroll_shock"
                                            },
                                            "default": character.privacidad?.alma === "todos"
                                        },
                                        {
                                            "label": "Solo amigos",
                                            "value": `alma*amigos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710462084579470",
                                                name: "Cinnamoroll_happy"
                                            },
                                            "default": character.privacidad?.alma === "amigos"
                                        },
                                        {
                                            "label": "Solo compañero",
                                            "value": `alma*compañero`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710483437785148",
                                                name: "Cinnamoroll_love"
                                            },
                                            "default": character.privacidad?.alma === "compañero"
                                        },
                                        {
                                            "label": "Nadie",
                                            "value": `alma*nadie`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710448994287736",
                                                name: "Cinnamoroll_sleep"
                                            },
                                            "default": character.privacidad?.alma === "nadie"
                                        }
                                    ],
                                    "placeholder": "Sin configurar",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        },
                        {
                            "type": 10,
                            "content": "✧ Invitaciones:\n-# ¿Quién puede invitarte a un grupo o misión cooperativa?"
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 3,
                                    "custom_id": `configuracion-${interaction.user.id}-configPriv-d`,
                                    "options": [
                                        {
                                            "label": "Todos",
                                            "value": `invitaciones*todos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710472302034985",
                                                name: "Cinnamoroll_shock"
                                            },
                                            "default": character.privacidad?.invitaciones === "todos"
                                        },
                                        {
                                            "label": "Solo amigos",
                                            "value": `invitaciones*amigos`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710462084579470",
                                                name: "Cinnamoroll_happy"
                                            },
                                            "default": character.privacidad?.invitaciones === "amigos"
                                        },
                                        {
                                            "label": "Solo compañero",
                                            "value": `invitaciones*compañero`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710483437785148",
                                                name: "Cinnamoroll_love"
                                            },
                                            "default": character.privacidad?.invitaciones === "compañero"
                                        },
                                        {
                                            "label": "Nadie",
                                            "value": `invitaciones*nadie`,
                                            "description": null,
                                            "emoji": {
                                                id: "1401710448994287736",
                                                name: "Cinnamoroll_sleep"
                                            },
                                            "default": character.privacidad?.invitaciones === "nadie"
                                        }
                                    ],
                                    "placeholder": "Sin configurar",
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
                            "type": 10,
                            "content": `Sistema de rol | Version: ${versionRol}`
                        }
                    ]
                }
            ]

            return message
        }

        async function switchCharacter(dataUser) {
            const listaDePersonajes = await characters.find({ ownerID: interaction.user.id }).toArray()

            const allCharacters = []
            const selectCharacter = []


            for (const ch of listaDePersonajes) {
                const activo = dataUser.nix.personajeActivo === ch._id;
                const soul = await souls.findOne({ _id: ch._id });

                const apodoFormateado = ch.perfil.apodo ? `[${ch.perfil.apodo}]` : "";

                allCharacters.push({
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": `${ch.perfil.avatarURL}`
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# ${ch.perfil.Nombre} ${apodoFormateado} - Lv: ${soul ? soul.sendero.nivel : "0"}
                            \n\n- -# ID: ${ch._id} \n- -# Estado: ${activo ? "Activo" : "Inactivo"} \n- -# Rol: ${ch.estado.Rol}
                            \n- -# Lumens: ${ch.economia.Lumens}\n- -# Fecha de creación: <t:${ch.metadata.fechaCreacion}:R>`
                        }
                    ]
                });

                selectCharacter.push({
                    "label": `${ch.perfil.Nombre} - Lv: ${soul ? soul.sendero.nivel : "0"}`,
                    "value": `${ch._id}`,
                    "description": null,
                    "emoji": null,
                    "default": activo
                });
            }

            const message = [
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
                                    "url": "https://i.pinimg.com/736x/f6/4f/43/f64f43b81a346c2be4cdf395efa26716.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Selecciona a tu personaje"
                                },
                                {
                                    "type": 10,
                                    "content": "-# Esta funcion esta en fase de desarrollo."
                                }
                            ]
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        ...allCharacters,
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
                                    "custom_id": `configuracion-${interaction.user.id}-selectCharacter`,
                                    "options": selectCharacter,
                                    "placeholder": "Selecciona tu personaje",
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
                            "type": 10,
                            "content": `Sistema de personaje | Version: ${versionRol}`
                        }
                    ]
                }
            ]

            return message
        }
    }
}