const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const userdbs = db.collection("usuarios_server")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../../config")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("perfil")
        .setDescription("Muestra tu perfil de personaje o el de otro usuario")
        .addUserOption(o =>
            o
                .setName("usuario")
                .setDescription("Selecciona a un usuario")
        )
        .addIntegerOption(o =>
            o
                .setName("personaje")
                .setDescription("Ingresa la ID del personaje")
                .setAutocomplete(true)
        ),
    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: false },
        cachepj: { obtener: true, required: false},
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, { character, soul, cachepj }) => {
        let Idfind = interaction.options.getInteger("personaje")
        var user = interaction.options.getUser("usuario")
        var estado = ""
        var statusMsg;

        if (Idfind || user) {
            let personaje;

            if(user) {
                const userdb = await userdbs.findOne({_id: user.id})
                
                if(userdb) {
                    Idfind = userdb?.nix?.personajeActivo
                }else {
                    Idfind = null
                }
            }

            personaje = await characters.findOne({
                $or: [
                    { _id: Idfind },
                ]
            })

            if (!personaje) {
                return interaction.reply({ content: "El usuario que mencionaste no tiene un personaje registrado (╥﹏╥)\n-# ¿O quizás fue la ID?", ephemeral: true })
            }

            user = interaction.guild.members.resolve(personaje.ownerID)
            console.log("verificación por usuario")
            perfil(personaje)
        } else if (cachepj) {
            if (cachepj?.waiting) {
                estado = "En espera"
                statusMsg = "Esto significa que aun no ha sido verificada. espera pacientemente (∪｡∪)｡｡｡zzZ"
            } else {
                estado = "No enviada"
                statusMsg = "Parece que aun estas definiendo tu ficha. para enviar tu ficha y continuar el proceso, usa el comando `/rol crear_ficha` (∪｡∪)｡｡｡zzZ"
            }

            const noverif = new EmbedBuilder()
                .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTitle(`${cachepj?.nombre} ${cachepj?.apodo ? `[${cachepj?.apodo}]` : ''}`)
                .setDescription(cachepj.historia ? cachepj.historia : "Sin Historia (¿In rol?)")
                .addFields(
                    { name: "Informacion", value: "`📑` **Apodo: ** " + cachepj?.apodo + "\n`🎎` **Sexo: **" + cachepj?.sexo + "\n`🍭` **Edad: **" + cachepj?.edad + "\n`🛫` **C/Org: **" + cachepj?.ciudadOrg, inline: true },
                    { name: "Extra", value: "`🎂` **Cumple **" + cachepj?.cumpleaños + "\n`👑` **Linaje Familiar **" + cachepj?.familia + "\n`❔`** Estado:** " + estado, inline: true },
                    { name: "🎭 Personalidad", value: cachepj?.personalidad, inline: false },
                    { name: "🎮 Especialidad", value: (cachepj?.especialidad || "No definido"), inline: false }
                )
                .setThumbnail(`${cachepj.avatarURL ? cachepj.avatarURL : "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"}`)
                .setColor(`Red`)
            return interaction.reply({ content: `**Vista previa de tu personaje.**\n-# ${statusMsg}`, embeds: [noverif] })
        } else {
            if (!character) {
                await interaction.reply({content: "No tienes un **personaje** o **ficha pendiente** para usar esto.╮(￣～￣)╭\n" + 
                    "-# Puedes usar el comando **`/rol crear_ficha`** para empezar.\n-# tambien puedes buscar un personaje por usuario o ID", flags: ["Ephemeral"]})
                return;
            }

            perfil(character)


        }

        async function perfil(pjuser) {
            const perfil = pjuser.perfil

            const descripcion = perfil.Descripcion ? perfil.Descripcion : "*Sin descripcion*"
            const reputacion = pjuser?.estado?.Reputacion ? pjuser.estado.Reputacion : "0"
            const grado = pjuser?.estado?.DesmpAcademico?.Grado ? pjuser.estado.DesmpAcademico.Grado : "Aun no calculado"
            const urlavatar = perfil.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_480,h_480,c_fill/')

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
                                    "content": `# ${perfil.Nombre}${perfil?.Apodo ? ` | ${perfil.Apodo}` : ""}`
                                },
                                {
                                    "type": 10,
                                    "content": descripcion + "\n\n-# *`Lumens:`* " + pjuser.economia.Lumens + "\n-# *`Reputacion:`* " + reputacion + "\n-# *`Grado:`* " + grado
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
                                "label": "Expandir",
                                "emoji": null,
                                "disabled": false,
                                "custom_id": `perfil_options-${interaction.user.id}-${pjuser._id}-expand`
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "**Información personal:**" + "\n\n-# `🎎` *Sexo:* " + perfil.Sexo +
                                        "\n-# `🍭` *Edad:* " + perfil.Edad + "\n-# `🎂` *Cumpleaños:* " + perfil.Cumpleaños +
                                        "\n-# `🎭` *Personalidad:* " + perfil.Personalidad + "\n-# `🛫` *Ciudad de origen:* " + perfil.CiudadOrg
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
                            "content": "**Medallas:**\n-# " + `${pjuser.social?.Medallas?.length > 0 ? pjuser.social.Medallas.join("\n") : "Sin medallas"}`
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
                                    "custom_id": `selectPerfil-${interaction.user.id}-${pjuser._id}`,
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
                                            "defualt": false,
                                            "disabled": true
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
                            "content": "-# Personaje de: " + `<@!${pjuser.ownerID}>\n` + `-# Sistema de personaje | v1.5`
                        }
                    ]
                }
            ]

            await interaction.reply({ components: perfilV2, flags: ["IsComponentsV2", "SuppressNotifications"], withResponse: true })

            return;

        }

    }
}