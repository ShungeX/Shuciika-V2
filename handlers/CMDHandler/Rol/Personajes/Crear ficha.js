const { EmbedBuilder, ChatInputCommandInteraction, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const { Client } = require("discord.js")
const { formatearTextoLim } = require("../../../../interaction/modals/Rol/Modal crearFicha")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("crear_ficha")
        .setDescription("Crea tu ficha de personaje para el rol"),

    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: false, required: false },
        cachepj: { obtener: true, required: false },
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, { character, cachepj }) => {

        const userdb = db.collection("usuarios_server")
        const userfind = await userdb.findOne({ _id: interaction.user.id })

        console.log(cachepj)
        if (!cachepj) {
            if ((userfind?.nix?.slotsPersonajes?.usados >= userfind?.nix?.slotsPersonajes?.total)) return interaction.reply({
                content: "¡No tienes slots disponibles!. ☆⌒(>。<) " + `**(${character?.perfil?.Nombre})**` +
                    "\n-# Usa `/rol perfil` para ver a tu personaje activo \n-# O compra más slots de personajes", flags: ["Ephemeral"]
            })
            message()
        } else if (cachepj?.waiting) {
            return interaction.reply({ content: '¡Ya has enviado tu ficha!. ☆⌒(>。<) \n-# Espera a que un administrador la verifique', ephemeral: true })
        } else if (userfind?.fichaStatus?.messageTemp) {
            const channel = await client.channels.fetch(userfind?.fichaStatus?.channelTemp) || null

            try {
                const msg = await channel.messages.fetch(userfind?.fichaStatus?.messageTemp) || false

                if (msg) {
                    const embed = new EmbedBuilder()
                        .setTitle("Haz click aqui para ir al mensaje")
                        .setURL(`https://discord.com/channels/${interaction.guildId}/${channel.id}/${userfind?.fichaStatus?.messageTemp}`)
                        .setDescription(`Ya existe una interacccion activa en ${channel}`)
                        .setColor("Red")
                    return interaction.reply({ embeds: [embed], ephemeral: true })
                }
            } catch (e) {
                console.log("No se encontro el mensaje")
                message()
            }
        }else {
            message()
        }

        async function message() {
            let msg;

            if (!cachepj) {
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

                await interaction.reply({ components: infoRoles, flags: ["IsComponentsV2"], withResponse: true })
            } else {
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



                msg = await interaction.reply({ components: previewCharacter, flags: ["IsComponentsV2"], withResponse: true })


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
            }


        }


    }

}