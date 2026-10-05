const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, TextInputStyle, ModalBuilder, TextInputBuilder } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")
const { crearBoton } = require("../../../utils/constructores/crearComponente")
const { construirPerfilV2 } = require("../../../handlers/CMDHandler/Rol/Personajes/Perfil")


module.exports = crearBoton({
    customId: "perfil_options",
    soloAutor: true,
    requirements: {
        character: { obtener: true, required: true }
    },

    ejecutar: async ({ client, interaction, character, componentData: { userId, extras } }) => {
        const [action] = extras
        const pincel = character.economia.Inventario.find(i => i.ID === 120 && i.Region === "TOB-01")
        const user = interaction.guild.members.resolve(character.ownerID)

        if (action === "addHistory") {
            if (!pincel) return interaction.reply({ content: "No se puede agregar un capitulo porque no tienes suficientes `Pincel Magico` ＞﹏＜", flags: ["Ephemeral"] })

            const modal = new ModalBuilder()
                .setTitle("Creacion de historia")
                .setCustomId("Creator_history")

            const title = new TextInputBuilder()
                .setCustomId("Title")
                .setLabel("¿Cual sera el titulo de esta historia?")
                .setPlaceholder('Recuerda seguir las normas del servidor')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(60)
                .setRequired(true)

            const historia = new TextInputBuilder()
                .setCustomId("Historia")
                .setLabel("¿Y que contendra esta historia?")
                .setPlaceholder('Escribe el contenido de este "Capitulo" ')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(50)
                .setMaxLength(2000)
                .setRequired(true)

            const imagen = new TextInputBuilder()
                .setCustomId("Imagen")
                .setLabel("¿Tendra una imagen representativa?")
                .setPlaceholder("Debes ingresar el link de la imagen [Opcional]")
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(200)
                .setRequired(false)

            const row = new ActionRowBuilder()
                .addComponents(title)
            const row2 = new ActionRowBuilder()
                .addComponents(historia)
            const row3 = new ActionRowBuilder()
                .addComponents(imagen)
            modal.addComponents(row,
                row2, row3)
            await interaction.showModal(modal)
        }

        if (action === "editHistory") {
            return interaction.reply({ content: `**Función en desarollo 〒▽〒**\n-# Espera pacientemente a que se agregue esta función.`, flags: ["Ephemeral"] })
        }

        if (action === "tutorial") {
            const tutorialV1 = [
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
                                    "url": "https://i.pinimg.com/736x/bd/82/dd/bd82dd786229d1f2984a967d517fd0b9.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Tutorial para crear capítulos"
                                },
                                {
                                    "type": 10,
                                    "content": "*Para agregar capítulos adicionales en tu perfil, necesitas tener en tu inventario el objeto **`Pincel Magico`***\n\n*Puedes comprarlo visitando la tienda y usando el comando **`/rol comprar 120`** (si tienes suficientes lumens)*"
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
                            "content": "**Puedes agregar el siguiente contenido en los capítulos:** \n- -# Icono (Link) \n- -# Titulo (60 caracteres) \n- -# Contenido / Historia (2000 caracteres) \n\n-# (¡Más funciones próximamente!)"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 2
                        },
                        {
                            "type": 10,
                            "content": "**`Demostración:`**"
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/736x/3c/c5/a2/3cc5a29c739a19889c2d17933bbbd74d.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Mis comidas favoritas"
                                },
                                {
                                    "type": 10,
                                    "content": "*Personaje:* Shuciika "
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
                            "content": "Las comidas de Tobeya son increíbles. He viajado por distintas regiones, pero ninguna se compara al sabor casero.\nEsto me ha llevado a pensar sobre mis comidas favoritas, aunque pensándolo bien...\nNo estoy segura de cuáles serían."
                        }
                    ]
                }
            ]

            await interaction.reply({ components: tutorialV1, flags: ["Ephemeral", "IsComponentsV2"] })
        }

        if (action === "expand") {
            const descripcion = character.perfil.Descripcion ? character.perfil.Descripcion : "*Sin descripcion*"
            const reputacion = character.estado?.Reputacion ? character.estado.Reputacion : "0"
            const grado = character.estado?.DesmpAcademico?.Grado ? character.estado.DesmpAcademico.Grado : "Aún no calculado"
            const urlavatar = character.perfil.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_480,h_480,c_fill/')

            const perfilV2 = [
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
                                    "url": urlavatar
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": `# ${character.perfil.Nombre}${character.perfil?.Apodo ? ` | ${character.perfil.Apodo}` : ""}`
                                },
                                {
                                    "type": 10,
                                    "content": descripcion + "\n\n-# *`Lumens:`* " + character.economia.Lumens + "\n-# *`Reputacion:`* " + reputacion + "\n-# *`Grado:`* " + grado
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
                                "label": "Reducir",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `perfil_options-${interaction.user.id}-${character._id}-reduct`
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "**Información personal:**" + "\n\n-# `🎎` *Sexo:* " + `${`${character.perfil.Sexo || 'No especificado'} ${character.perfil.Pronombres ? `(${character.perfil.Pronombres})` : ''}` || "** **"}` +
                                        "\n-# `🍭` *Edad:* " + character.perfil.Edad + "\n-# `🎂` *Cumpleaños:* " + (character.perfil.Cumpleaños || (character.perfil.cumpleDia && character.perfil.cumpleMes ? `${String(character.perfil.cumpleDia).padStart(2, '0')}/${String(character.perfil.cumpleMes).padStart(2, '0')}` : "** **")) +
                                        "\n-# `🎭` *Personalidad:* " + character.perfil.Personalidad + "\n-# `🛫` *Ciudad de origen:* " + character.perfil.CiudadOrg +
                                        "\n-# `👑` *Linaje familiar:* " + (character.perfil.Familia ? character.perfil.Familia : "No especificado") +
                                        "\n-# `🏈` *Especialidad:* " + character.perfil.Especialidad +
                                        "\n-# `🪨` *Peso:* " + character.perfil.Peso +
                                        "\n-# `📏` *Estatura:* " + character.perfil.Estatura +
                                        "\n\n-# `🔮` *Rol:* " + character.estado.Rol + "\n-# `💳` *ID:* " + character._id +
                                        "\n-# `🎉` *Fecha de creacion:* " + `<t:${character.metadata.fechaCreacion}:R>`
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
                            "content": "**Medallas:**\n-# " + `${character.social.Medallas?.length > 0 ? character.social.Medallas.join("\n") : "Sin medallas"}`
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
                                    "custom_id": `selectPerfil-${interaction.user.id}-${character._id}`,
                                    "options": [
                                        {
                                            "label": "Perfil principal",
                                            "value": "perfil",
                                            "description": null,
                                            "emoji": {
                                                name: "d9056043c1e148e38efd10e4515e33d2",
                                                id: "1356111301859868823"
                                            },
                                            "default": true,
                                            "disabled": false
                                        },
                                        {
                                            "label": "Apariencia [Galeria]",
                                            "value": "galeria",
                                            "description": null,
                                            "emoji": {
                                                name: "EmuNui",
                                                id: "1370631281028890727"
                                            },
                                            "default": false,
                                            "disabled": false
                                        },
                                        {
                                            "label": "Historia [Lore]",
                                            "value": "historia",
                                            "description": null,
                                            "emoji": {
                                                name: "BunnyBook",
                                                id: "1356111194997395496"
                                            },
                                            "default": false,
                                            "disabled": false
                                        },
                                        {
                                            "label": "Alma [Núcleo]",
                                            "value": "alma",
                                            "description": null,
                                            "emoji": {
                                                name: "KrisJojos",
                                                id: "1350664814414004395"
                                            },
                                            "default": false,
                                            "disabled": false
                                        },
                                        {
                                            "label": "Mascotas [Nuevo]",
                                            "value": "mascota",
                                            "description": null,
                                            "emoji": {
                                                name: "pets",
                                                id: "1356111134758932510"
                                            },
                                            "default": false,
                                            "disabled": false
                                        }
                                    ],
                                    "placeholder": "Selecciona una opción",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        },
                        {
                            "type": 10,
                            "content": "-# Personaje de: " + `<@!${character.ownerID}>\n` + `-# Sistema de personaje | v1.5`
                        }
                    ]
                }
            ]


            await interaction.update({ components: perfilV2 })
        }

        if (action === "reduct") {
            const perfilV2 = construirPerfilV2(character, interaction.user.id)
            return interaction.update({ components: perfilV2 })
        }
    }
})



