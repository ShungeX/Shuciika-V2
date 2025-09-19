const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, TextInputBuilder, TextInputStyle } = require("discord.js")
const clientdb = require("../../../Server");
const { updateMessage } = require("../../modals/Rol/Modal crearFicha");
const { formatearTextoLim } = require("../../../utils/textStrings")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const dataCache = new Map()
const util = require(`util`);
const sleep = util.promisify(setTimeout)

module.exports = {
    customId: "crear_ficha",
    buttonAuthor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async (client, interaction, extras) => {
        let channel;
        let message;

        const userfind = await userdb.findOne({ _id: interaction.user.id })
        const messageId = userfind?.fichaStatus?.messageTemp
        const cachepj = await Cachedb.findOne({ _id: interaction.user.id })

        if (userfind && messageId) {
            try {
                channel = await client.channels.fetch(userfind.fichaStatus.channelTemp)
                message = await channel.messages.fetch(messageId)
            } catch (error) {
                console.log("No se encontro el mensaje o canal de la ficha temporal")
            }

        }


        if (extras === "opinion") {
            const opinion = new TextInputBuilder()
                .setCustomId("opinionpj")
                .setLabel("¿Te gustaria dejar tu opinion?")
                .setPlaceholder("Opinion sobre el metodo para crear personajes.")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setMinLength(20)
                .setRequired(false)

            const modal = new ModalBuilder()
                .setTitle("Creacion de ficha")
                .setCustomId("actualizarPerfil-opinion")
            const row = new ActionRowBuilder()

            row.addComponents(opinion)


            modal.addComponents(row)
            return await interaction.showModal(modal)
        }

        if (extras === "selectStudent") {
            const studentJson = [
                {
                    "type": 17,
                    "accent_color": 8412085,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/736x/ae/18/c4/ae18c47dc81c384bebed446069df9b07.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Postulación a estudiante..."
                                },
                                {
                                    "type": 10,
                                    "content": "-# Un estudiante se desarrolla y crece con el tiempo. Ya sea por vocación, accidente o designio del destino, cada uno ha sido llamado a Tobeya para descubrir su afinidad, fortalecer su resonancia y recorrer el sendero marcado por el Eón Creador.\n\n-# Su alma aún se encuentra en proceso de afinación, vulnerable tanto a la resonancia como al susurro de la disonancia.\n-# Muchos de ellos ignoran la magnitud del mundo que pisan… pero cada decisión los acerca o los aleja del propósito que les fue escrito en las estrellas."
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
                            "content": "# Ventajas:\n- -# Si buscas explotar al máximo tu potencial. este rol es perfecto para ti\n- -# Alma moldeable: eres flexible y vulnerable, esto te permite elegir mejor entre tus caminos\n- -# Desarrollo avanzado: El servidor esta mejor desarrollado para trabajar con los estudiantes.\n"
                        },
                        {
                            "type": 10,
                            "content": "# Desventajas:\n- -# Requiere de mayor esfuerzo para progresar\n- -# Mayor libertad de caminos es igual a perder más facil\n- -# Debilidad desde el principio\n- -# Economia baja (depende)"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "Una vez seleccionado el rol, ya no podrás cambiarlo a futuro.\nSin embargo, un estudiante puede volverse profesor si cumple ciertas características."
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 2,
                                    "style": 3,
                                    "label": "Seleccionar",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": `crear_ficha-${interaction.user.id}-rolStudent`
                                },
                                {
                                    "type": 2,
                                    "style": 4,
                                    "label": "Otra opción",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": `crear_ficha-${interaction.user.id}-menuOpciones`
                                }
                            ]
                        }
                    ]
                }
            ]

            return await interaction.update({ components: studentJson })
        } else if (extras === "selectMaster") {
            const masterJson = [
                {
                    "type": 17,
                    "accent_color": 8412085,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/1200x/4e/c1/e4/4ec1e4718dca8ae9f07ae483de713777.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Postulación a profesor..."
                                },
                                {
                                    "type": 10,
                                    "content": "-# Quienes imparten conocimiento en el Instituto no sólo dominan su arte: son guías, faros y guardianes del legado que el Eón Creador dejó al mundo.\n\n-# Ser profesor no es un título, es una responsabilidad divina: formar mentes, proteger la pureza del maná y evitar que la disonancia se siembre sobre los corazonés.\n-# Cada profesor tiene un pasado, un motivo para seguir enseñando, y una cicatriz que carga con orgullo o pesar.\n-# No todos los estudiantes escuchan, pero incluso los sordos al consejo sienten el peso de su presencia."
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
                            "content": "# Ventajas:\n- -# Menor complejidad: No requieres de mucho esfuerzo para mejorarlo\n- -# Poder inicial: Has recorrido un gran camino y dominas los hechizos\n- -# Mejor económica: El instituto te paga por enseñar, tu economía es estable.\n- -# Mayor autoridad: Ser un profesor requiere de mayor autoridad"
                        },
                        {
                            "type": 10,
                            "content": "# Desventajas:\n- -# Rigidez del Alma: Estas atado a seguir los principios. Ahora eres el ejemplo a seguir.\n- -# Crecimiento Lento: Tu camino ya se ha forjado, solo sabes contar el pasado\n- -# Sistema Beta: Los profesores están en versión de experimentación, es posible que el contenido sea menor"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 1
                        },
                        {
                            "type": 10,
                            "content": "# Consideraciones:\n- -# Antes de elegir este rol deberás completar un formulario adicional.\n- -# Postularse no garantiza la aceptación. Podrías ser rechazado, pero podrás volver a intentarlo más adelante o elegir el rol de estudiante.\n- -# Este rol requiere mayor dedicación: deberás conocer bien los principios del Instituto y estar dispuesto a impartir clases periódicas.\n- -# A cambio, tendrás más libertad para organizar eventos, dinámicas y aportar activamente al desarrollo del mundo de Nix."
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
                                    "label": "Seleccionar",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": `crear_ficha-${interaction.user.id}-solicitud`
                                },
                                {
                                    "type": 2,
                                    "style": 4,
                                    "label": "Otra opción",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": `crear_ficha-${interaction.user.id}-menuOpciones`
                                }
                            ]
                        }
                    ]
                }
            ]

            return await interaction.update({ components: masterJson })
        } else if (extras === "menuOpciones") {
            const infoRoles = [
                {
                    "type": 17,
                    "accent_color": 6452916,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 9,
                            "accessory": {
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/originals/69/bc/aa/69bcaade16a38429e4064ef419c598d2.gif"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Tipo de ficha"
                                },
                                {
                                    "type": 10,
                                    "content": "Antes de escribir tu historia, debes elegir tu lugar en el gran tapiz de Nix.\n¿Serás quien aprende… o quien guía?"
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
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/736x/ae/18/c4/ae18c47dc81c384bebed446069df9b07.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Postulación a estudiante."
                                },
                                {
                                    "type": 10,
                                    "content": "-# Aprendices del maná y los pilares. Aún en formación, los estudiantes avanzan entre la resonancia y la tentación de la disonancia. Su camino apenas comienza."
                                }
                            ]
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 2,
                                "style": 2,
                                "label": "Más info",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `crear_ficha-${interaction.user.id}-selectStudent`
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "** **"
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
                                "type": 11,
                                "media": {
                                    "url": "https://i.pinimg.com/1200x/4e/c1/e4/4ec1e4718dca8ae9f07ae483de713777.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Postulación a profesor."
                                },
                                {
                                    "type": 10,
                                    "content": "-# Guías del conocimiento y guardianes del equilibrio mágico. Han jurado formar a la nueva generación y mantener viva la voluntad del Eón Creador."
                                }
                            ]
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 2,
                                "style": 2,
                                "label": "Más info",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `crear_ficha-${interaction.user.id}-selectMaster`
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "** **"
                                }
                            ]
                        }
                    ]
                }
            ]

            return interaction.update({ components: infoRoles })
        } else if (extras === "solicitud") {

            return
        } else if (extras === "rolStudent") {
            if (message) {
                await interaction.update({}).then(m => setTimeout(() => m.delete(), 500));

                await interaction.followUp({content: "No puedes seleccionar esta opción porque ya tienes un personaje en creación...", flags: ["Ephemeral"]})

                return;

            }

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
                                    "content": cachepj?.historia ? "-# `Historia:`\n\n" + `${formatearTextoLim(cachepj?.historia, 270)}` :
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
                                "\n-# `🍭` **Edad:** " + `${cachepj?.edad || "** **"}` + "\n-# `🎂` **Cumple:** " + `${cachepj?.cumpleaños || "** **"}` + "\n-# `🛫` **C/Org:** "
                                + `${cachepj?.ciudadOrg || "** **"}` + "\n-# `👑` **Linaje Familiar:** " + `${cachepj?.familia || "** **"}` +
                                "\n-# `🎭` **Personalidad:** " + `${cachepj?.personalidad || "** **"}` + "\n-# `🏈` **Especialidades:** " + `${cachepj?.especialidad || "** **"}` +
                                "\n\n-# `📏` **Estatura:** " + `${cachepj?.estatura ? `${cachepj.estatura}cm` : "** **"}` +
                                "\n-# `🪨` **Peso:** " + `${cachepj?.peso ? `${cachepj.peso}kg` : "** **"}`
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
                                            "label": "» Peso (opcional).ᐟ.ᐟ",
                                            "value": `peso`,
                                            "description": "El peso de tu personaje (kg)",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "» Estatura (opcional).ᐟ.ᐟ",
                                            "value": `estatura`,
                                            "description": "Que tan alto o bajo es tu personaje",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "» Establecer historia (opcional)",
                                            "value": `historia`,
                                            "description": "El transfondo del personaje",
                                            "emoji": null,
                                            "default": false
                                        },
                                        {
                                            "label": "» Aspiración (opcional)",
                                            "value": `aspiracion`,
                                            "description": "¿Cual es tu proposito?",
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



            const msg = await interaction.update({ components: previewCharacter, flags: ["IsComponentsV2"], withResponse: true })



            await userdb.updateOne({ _id: interaction.user.id },
                {
                    $set: {
                        fichaStatus: {
                            messageTemp: msg.resource.message.id,
                            channelTemp: interaction.channelId
                        },
                        created: Date.now(),

                    }
                },
                { upsert: true }
            )

            return;
        }

        await interaction.deferReply({ flags: ["Ephemeral"] })

        if (extras === "enviar_true") {
            const characterCache = await Cachedb.findOne({ _id: interaction.user.id })

            if (!characterCache) return interaction.editReply({ content: "Mmm, es raro. no deberia aparecer este mensaje a menos que intentaras buguear el bot =.=\n-# Ficha ya enviada o inexistente" })
            message.delete()

            const channelfichas = await client.channels.fetch("803723665107451904")
            const canalOpinion = await client.channels.fetch("1009685257215287346")
            let historia = characterCache?.historia

            if (historia) {
                historia = formatearTextoLim(characterCache?.historia, 1000)
            }

            if (characterCache?.aspiracion) {
                const aspiracion = [
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
                                        "url": "https://i.pinimg.com/736x/f9/f4/d9/f9f4d906755e7b727ae2d25d13b1d0d0.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# Aspiración del personaje..."
                                    },
                                    {
                                        "type": 10,
                                        "content": "Nombre del personaje: " + `${characterCache.nombre}`
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
                                "content": `${formatearTextoLim(characterCache?.aspiracion, 1700)}`
                            }
                        ]
                    }
                ]

                canalOpinion.send({ components: aspiracion, flags: ["IsComponentsV2"] })
            }

            const familia = characterCache?.familia ? characterCache.familia : "Desconocida"


            channelfichas.send({
                content:
                    "**✧ Nombre.** " + characterCache.nombre + "\n**✧ Edad.** " + characterCache.edad + "\n**✧ Fecha de cumpleaños.** " + characterCache.cumpleaños
                    + "\n**✧ Genero.** " + characterCache.sexo + "\n**✧ Personalidad.** "
                    + characterCache.personalidad + "\n**✧ Ciudad de origen.** " + characterCache.ciudadOrg + "\n**✧ Familia.** " + familia + "\n**✧ Aptitud.** "
                    + characterCache.especialidad + "\n**✧ Peso: " + characterCache?.peso + "\n**✧ estatura: " + characterCache?.estatura +
                    `\n**✧ Historia:** ` + `${historia || "In rol"}` + "\n**`Ficha y personaje de:`** " + `${interaction.user}`,
                files: [characterCache.avatarURL]
            })
            await Cachedb.updateOne({ _id: interaction.user.id },
                { $set: { waiting: true } }
            )

            return await interaction.editReply({ content: "Muchas gracias por querer formar parte de este instituto. ♡( ◡‿◡ )\n **Espera hasta que un miembro del staff verifique tu ficha**" })
        }

        if (extras === "foto") {
            await interaction.editReply({ content: "Por favor, envía tu imagen (archivo/desde tu galeria o URL) en este canal en los próximos dos minutos" })

            const filter = msg => msg.author.id === interaction.user.id &&
                (msg.attachments.size > 0 ||
                    /^https?:\/\/.+\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(msg.content));

            const collector = interaction.channel.createMessageCollector({
                filter,
                max: 1,
                time: 120_000
            });

            collector.on('collect', async msg => {
                let imageUrl;
                if (msg.attachments.size > 0) {
                    imageUrl = msg.attachments.first().url;
                } else {
                    imageUrl = msg.content.trim();
                }

                await Cachedb.updateOne({ _id: interaction.user.id }, {
                    $setOnInsert: {
                        created: Date.now(),
                    },
                    $set: {
                        avatarURL: imageUrl,
                    }
                }, { upsert: true })


                const info = {
                    action: "avatarURL",
                    option: imageUrl
                }

                await updateMessage(interaction, message, null, true, info);

                await interaction.editReply('✅ Tu foto de perfil ha sido actualizada.');
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply('⏰ Se acabó el tiempo. Vuelve a pulsar “Establecer foto” para intentarlo de nuevo.');
                }
            });
        } else if (extras === "guia") {
            const tutorialV2 = [
                {
                    "type": 17,
                    "accent_color": 558079,
                    "spoiler": false,
                    "components": [
                        {
                            "type": 10,
                            "content": "# Guía basica para crear tu ficha"
                        },
                        {
                            "type": 10,
                            "content": "*Bienvenido nuevo aprendiz. Estas a punto de crear tu **ficha de personaje.***"
                        },
                        {
                            "type": 10,
                            "content": "-# Recuerda revisa las guias de creacion de ficha antes de comenzar: [Creación de personaje](https://canary.discord.com/channels/716342375303217285/1339103959855661096), [¿Cómo agregar una foto de perfil?](https://canary.discord.com/channels/716342375303217285/1330769969428041822)"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 2
                        },
                        {
                            "type": 10,
                            "content": "`✨` **¿Cómo empezar?**\n\n- *Haz clic en el menú desplegable que dice `Personaliza tu personaje...`*\n- *Selecciona el campo que deseas editar (por ejemplo, \"nombre\", \"edad\", \"personalidad\", etc.).*\n- *Se abrirá un modal (una pequeña ventana) donde podrás escribir la información correspondiente.*\n- *Repite este proceso hasta completar tu ficha.*\n\n-# Tranquilo/a, la información se guarda automaticamente y se actualiza cada que cambias algo de tu ficha"
                        },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 2
                        },
                        {
                            "type": 9,
                            "accessory": {
                                "type": 2,
                                "style": 1,
                                "label": "Enviar ficha",
                                "emoji": null,
                                "disabled": true,
                                "custom_id": "a4b19203613e42ccdd6f6d0eb59c6164"
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "`✅` **¿Cuándo puedo `Enviar ficha`?**\n\nEl botón `Enviar ficha` se desbloqueará automáticamente cuando hayas completado los siguientes campos mínimos:\n\n-# - Nombre\n-# - Edad\n-# - Sexo\n-# - Cumpleaños\n-# - Ciudad de origen\n-# - Personalidad"
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
                            "content": "`⚠️` ¿Tienes problemas para agregar contenido a tu ficha?\n\n-# Realiza un post en <#1319812744035438642> detallando tu problema o contacta al MD de <@!665421882694041630>"
                        }
                    ]
                }
            ]

            interaction.editReply({ components: tutorialV2, flags: ["IsComponentsV2"] })
        } else if (extras === "enviar_Ficha") {
            const characterCache = await Cachedb.findOne({ _id: interaction.user.id })

            if (!characterCache?.avatarURL) {
                interaction.editReply({ content: "-# Parece que tu personaje aun no tiene una **Foto de perfil**, es opcional... Pero te recomendamos agregar una ＞﹏＜\n-# Puedes asignar una presionando el boton `Establecer foto`**", ephemeral: true })
                await sleep(4000)
            }



            const Row = new ActionRowBuilder()
            const accept = new ButtonBuilder()
                .setCustomId(`crear_ficha-${interaction.user.id}-enviar_true`)
                .setStyle(ButtonStyle.Success)
                .setLabel("Enviar")
                .setEmoji("✅")

            Row.addComponents(accept)

            const embed = new EmbedBuilder()
                .setDescription("# ¿Estás seguro de que deseas enviar tu ficha?\n\n-# La información no agregada aparecerá como `Desconocido` o simplemente no se mostrará en tu perfil."
                    + "\n-# - Podrás modificar algunos datos de tu personaje más adelante.\n-# - Si deseas cancelar esta acción, simplemente descarta este mensaje." +
                    "\n\n-# **¡Una vez enviada tu ficha no podras ajustar nada de ella hasta que sea verificada por un administrador!**"
                )
                .setColor("Red")

            await interaction.editReply({ embeds: [embed], components: [Row] })
        }


    }
}