const { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const timeconvert = require("humanize-duration");
const dbconfig = db.collection("usuarios_server")
const version = require("../../../../config")
const { procesarFoto } = require("../../../../interaction/modals/Rol/Modal Foto");
const { formatearTextoLim } = require("../../../../utils/textStrings");
const { crearCustomId } = require("../../../../utils/constructores/customId");
const { construirEditorFichaCorreccion } = require("../../../../interaction/selectMenus/Rol/verificar_ficha");


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("configuracion")
        .setDescription("Ajusta tu experiencia en el rol")
        .addAttachmentOption(img =>
            img
                .setName("foto")
                .setDescription("[Solo si quieres cambiar la foto de perfil de tu personaje activo]")
        ),
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


    ejecutar: async function (client, interaction, { character, cachepj }) {
        const userdb = await dbconfig.findOne({ _id: interaction.user.id })
        const imgs = await interaction.options.getAttachment("foto")

     

        // Flujo: Si es una ficha con cambios solicitados, enviar directamente al editor de correcciones
        if (cachepj?.status?.estado === "solicita_cambio") {
            const message = await interaction.deferReply({ withResponse: true,  })
            const editorComponents = construirEditorFichaCorreccion(cachepj, interaction.user.id);
            await interaction.editReply({ components: editorComponents, flags: ["IsComponentsV2"] });
            const replyMsg = await interaction.fetchReply();

            await dbconfig.updateOne(
                { _id: interaction.user.id },
                {
                    $set: {
                        fichaStatus: {
                            messageTemp: replyMsg.id,
                            channelTemp: interaction.channelId
                        },
                        created: Date.now()
                    }
                },
                { upsert: true }
            );
            return;
        }

        // Si la ficha está enviada y en espera de revisión
        if (cachepj?.waiting && cachepj?.status?.estado !== "solicita_cambio") {
            return await interaction.reply({
                content: "Tu ficha se encuentra actualmente en revisión por la administración. No puedes modificarla hasta que el staff termine de revisarla. (✿◡‿◡)",
                flags: ["Ephemeral"]
            });
        }
        const message = await interaction.deferReply({ withResponse: true,  })

        if (imgs) {
            const time = 300000 - (Date.now() - userdb?.time?.pjFoto)

            if ((Date.now() - userdb?.time?.pjFoto) < 300000) {
                return interaction.editReply({ content: "¡Oye!, Acabo de pegar tu foto... Bueno, es lo de menos (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y " })}` + "`** para establecer otra foto nueva (⇀‸↼‶)", flags: ["Ephemeral"] })
            }


            await procesarFoto(interaction, imgs.url)
            return
        }

        const opciones = [
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
                                "url": "https://i.pinimg.com/736x/d2/60/66/d26066c2f4922579a3ccc25ef5f6f3a6.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Configuración del rol .ᐟ.ᐟ"
                            },
                            {
                                "type": 10,
                                "content": "\"El alma es un lienzo que se perfecciona con la voluntad. Modifica aquí el reflejo de tu ser en Nix.\"\n\n-# ✦ Identidad: Personaliza los rasgos visibles de tu personaje (apariencia, apodo, descripción, etc.)\n\n-# ✦ Privacidad: Define quién puede interactuar con tu esencia. Controla la visibilidad de tu perfil, solicitudes de combate, crafteo e intercambios.\n\n-# ✦ Otro Reflejo: Cambia entre tus almas activas registradas. \n-# Disponible si tienes más de un alma registrada.\n\n-# Algunas funciones aún se encuentran en desarrollo. Agradecemos tu paciencia mientras se revelan."
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
                                "custom_id": crearCustomId({
                                    action: "configuracion",
                                    userId: interaction.user.id,
                                    characterId: character?._id
                                }),
                                "options": [
                                    {
                                        "label": "Identidad",
                                        "value": "personaje",
                                        "description": null,
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "Privacidad",
                                        "value": "privacidad",
                                        "description": null,
                                        "emoji": null,
                                        "default": false
                                    },
                                    {
                                        "label": "Otro Reflejo",
                                        "value": "switch",
                                        "description": null,
                                        "emoji": null,
                                        "default": false
                                    }
                                ],
                                "placeholder": "Selecciona la configuración",
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
                        "content": `Sistema de rol | Version: ${version.versionRol}`
                    }
                ]
            }
        ]

        
       return await interaction.editReply({ components: opciones, flags: ["IsComponentsV2"] })

        const previewCharacter = await this.messageBuild(character, userdb, interaction, message.resource.message.id)
    },

    messageBuild: async function (character, userdb, interaction, message) {
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
                "emoji": {
                    "name": "🔖",
                    "id": null
                },
            },
        ]

        const especiales = [
            { key: "cumpleaños", opt: { "label": "Cumpleaños [E]", "description": "Actualiza el cumpleaños de tu personaje", "value": `cumpleaños`, "emoji": { "name": "🎂", "id": null } }, },
            { key: "nombre", opt: { "label": "Nombre [E]", "description": "Cambia el nombre de tu personaje", "value": "nombre", "emoji": { "name": "📖", "id": null } } },
            { key: "familia", opt: { "label": "Familia [E]", "description": "Cambia el apellido/familia de tu personaje", "value": `familia`, "emoji": { "name": "👪", "id": null } } },
            { key: "ciudadOrg", opt: { "label": "Ciudad Org [E]", "description": "Cambia la ciudad de origen de tu personaje", "value": `ciudadOrg`, "emoji": { "name": "🏙️", "id": null } } },
            { key: "personalidad", opt: { "label": "Personalidad [E]", "description": "Cambia la personalidad de tu personaje", "value": `personalidad`, "emoji": { "name": "🎭", "id": null } } },
            { key: "especialidades", opt: { "label": "Especialidades [E]", "description": "Cambia las especialidades de tu personaje", "value": `especialidad`, "emoji": { "name": "🏂", "id": null } } },
        ];

        // añade solo las que el usuario tiene en data
        for (const { key, opt } of especiales) {
            if (userdb?.especial?.[key] > 0) options.push(opt);
        }

        const Nombre = character.perfil?.Nombre || "**Tu nombre estara aqui**"
        const Apodo = character.perfil?.Apodo || "Sin apodo"
        const foto = character.perfil?.avatarURL || "https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/v1/Resources/unknowncharacter"

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
                                "content": (character.perfil?.Historia ? "-# `Historia:`\n" + `${formatearTextoLim(character.perfil?.Historia, 270)}` :
                                    "-# `Historia:`\n-# *in rol / no establecida*") + `\n\n-# Descripcion: ${character.perfil?.Descripcion ? character.perfil.Descripcion : "Sin descripcion"}`
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
                        "content": "# Información: \n-# `🎎` **Sexo:** " + `${character.perfil?.Sexo || "** **"}` +
                            "\n-# `🍭` **Edad:** " + `${character.perfil?.Edad || "** **"}` + "\n-# `🎂` **Cumple:** " + `${character.perfil?.Cumpleaños || (character.perfil?.cumpleDia && character.perfil?.cumpleMes ? `${String(character.perfil.cumpleDia).padStart(2, '0')}/${String(character.perfil.cumpleMes).padStart(2, '0')}` : "** **")}` + "\n-# `🛫` **C/Org:** "
                            + `${character.perfil?.CiudadOrg || "** **"}` + "\n-# `👑` **Linaje Familiar:** " + `${character.perfil?.Familia || "** **"}` +
                            "\n-# `🎭` **Personalidad:** " + `${character.perfil?.Personalidad || "** **"}` + "\n-# `🏈` **Especialidades:** " + `${character.perfil?.Especialidad || "** **"}`
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
                            "-# - `📖` " + `Nombre ${userdb?.especial?.nombre > 0 ? "[Disponible]" : "[No disponible]"}\n` +
                            "-# - `🎂` " + `Cumpleaños ${userdb?.especial?.cumpleaños > 0 ? "[Disponible]" : "[No disponible]"}\n` +
                            "-# - `👨‍👩‍👧‍👦` " + `Familia / Apellido ${userdb?.especial?.familia > 0 ? "[Disponible]" : "[No disponible]"}\n` +
                            "-# - `🏙️` " + `Ciudad Org ${userdb?.especial?.ciudadOrg > 0 ? "[Disponible]" : "[No disponible]"}\n` +
                            "-# - `🎭` " + `Personalidad ${userdb?.especial?.personalidad > 0 ? "[Disponible]" : "[No disponible]"}\n` +
                            "-# - `🏂` " + `Especialidades ${userdb?.especial?.especialidad > 0 ? "[Disponible]" : "[No disponible]"}\n`

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