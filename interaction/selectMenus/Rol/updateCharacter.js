const { ChatInputCommandInteraction, ModalBuilder, ActionRowBuilder, EmbedBuilder, Client, TextInputBuilder, TextInputStyle, LabelBuilder, StringSelectMenuBuilder } = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const timeconvert = require("humanize-duration");
const { construirJsonV2Personalidad } = require("../../../utils/constructores/construirPersonalidad");

module.exports = {
    customId: "update_character",
    selectAutor: true,


    /**
    * @param {Client} client 
    * @param {ChatInputCommandInteraction} interaction
    */

    ejecutar: async (client, interaction, character, messageId) => {
        const userf = await userdb.findOne({ _id: interaction.user.id })
        const [action, extra] = interaction.values[0].split("*")
        let time;

        if (!character) {
            return interaction.reply({ content: "Primero empecemos por crear tu personaje, ¿que dices (´･ᴗ･´)?\n-# ¿Porque no intentas crear uno?, usa el comando `/rol crear_ficha`", flags: ["Ephemeral"] })
        }

        const modal = new ModalBuilder()
            .setTitle("Creacion de ficha")
            .setCustomId(`actualizarPerfil-character-${messageId}`)
        const row = new ActionRowBuilder()

        switch ((action || interaction.values[0])) {
            case "nombre":
                if (userf?.PermissionsTime?.editname <= 0) {
                    return interaction.reply({ content: "¡Oye!, no hay más autocorrector para cambiar tu nombre... quizás debas obtener más con un `permiso especial` (￣へ￣)", flags: ["Ephemeral"] })
                }


                const nombre = new TextInputBuilder()
                    .setCustomId("nombrepj")
                    .setLabel("Nombra a tu personaje")
                    .setPlaceholder("Ej: Shuciika")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(4)
                    .setMaxLength(18)
                    .setRequired(true)

                modal.setCustomId(`actualizarPerfil-nombre-${messageId}`)
                row.addComponents(nombre)
                break;
            case "apodo":
                time = (3600000 * 24) - (Date.now() - userf?.time?.pjApodo)
                if ((Date.now() - userf?.time?.pjApodo) < (3600000 * 24)) {
                    return interaction.reply({ content: "¡Oye!, Acabo de decirle a mis amigos de tu nuevo apodo... (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["h", "m", "s"], round: true, conjunction: " y " })}` + "`** para establecer un nuevo apodo (⇀‸↼‶)", flags: ["Ephemeral"] })
                }

                const apodo = new TextInputBuilder()
                    .setCustomId("apodopj")
                    .setLabel("Apodo")
                    .setPlaceholder("(Deja este campo vacio si no tiene apodo)")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(3)
                    .setMaxLength(18)
                    .setRequired(false)
                modal.setCustomId(`actualizarPerfil-apodo-${messageId}`)
                row.addComponents(apodo)
                break;
            case "sexo":


                if (extra) {

                    try {

                        await Cachedb.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                sexo: extra,
                            }
                        }, { upsert: true })

                        const info = {
                            userId: interaction.user.id,
                            action: action,
                            option: extra
                        }


                        await interaction.deferUpdate();

                        await updateMessage(interaction, msg, null, true, info);

                    } catch (error) {
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
                                        "content": "# Elige el sexo biológico de tu personaje\n-# Tambien puedes elegir tus pronombres (Opcional). Se seleccionan de forma automática según el sexo biológico que elijas. ( •̀ ω •́ )✧"
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
                                                "emoji": {
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
                                                "label": "Prefiero no especificar",
                                                "value": "sexo*Sin especificar",
                                                "description": null,
                                                "emoji": {
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
                                    },
                                    {
                                        "type": 3,
                                        "custom_id": `crear_ficha-${interaction.user.id}`,
                                        "options": [
                                            {
                                                "label": "He/Him",
                                                "value": "pronombres*HeHim",
                                                "description": null,
                                                "default": false
                                            },
                                            {
                                                "label": "She/Her",
                                                "value": "pronombres*SheHer",
                                                "description": null,
                                                "default": false
                                            },
                                            {
                                                "label": "They/Them",
                                                "value": "pronombres*TheyThem",
                                                "description": null,
                                                "default": false
                                            },
                                            {
                                                "label": "Any/all",
                                                "value": "pronombres*AnyAll",
                                                "description": null,
                                                "default": false
                                            },
                                            {
                                                "label": "Ask me",
                                                "value": "pronombres*askme",
                                                "description": null,
                                                "default": false
                                            },
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

                return await interaction.reply({ components: jsonV2Sex, flags: ["Ephemeral", "IsComponentsV2"] })
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

                modal.setCustomId(`actualizarPerfil-edad-${messageId}`)
                row.addComponents(edad)
                break;
            case "cumpleaños": {
                modal.setCustomId(`actualizarPerfil-cumpleaños-${messageId}`);
                modal.setTitle("Cumpleaños de tu personaje");

                const mesLabel = new LabelBuilder()
                    .setLabel("Mes de nacimiento")
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId("cumple_mes")
                            .setPlaceholder("Selecciona un mes")
                            .addOptions(
                                { label: "Enero", value: "1" },
                                { label: "Febrero", value: "2" },
                                { label: "Marzo", value: "3" },
                                { label: "Abril", value: "4" },
                                { label: "Mayo", value: "5" },
                                { label: "Junio", value: "6" },
                                { label: "Julio", value: "7" },
                                { label: "Agosto", value: "8" },
                                { label: "Septiembre", value: "9" },
                                { label: "Octubre", value: "10" },
                                { label: "Noviembre", value: "11" },
                                { label: "Diciembre", value: "12" },
                            )
                    );

                const diaLabel = new LabelBuilder()
                    .setLabel("Día de nacimiento (1-31)")
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId("cumple_dia")
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(1)
                            .setMaxLength(2)
                            .setPlaceholder("Ej: 14")
                            .setRequired(true)
                    );

                modal.addLabelComponents(mesLabel, diaLabel);
                return await interaction.showModal(modal);
            }
            case "ciudadorg":
                const ciudadorg = new TextInputBuilder()
                    .setCustomId("ciudadpj")
                    .setLabel("¿Tu personaje vivía en...? (Ciudad de origen)")
                    .setPlaceholder("Puede ser una ciudad inventada o real")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(12)
                    .setRequired(true)
                row.addComponents(ciudadorg)
                modal.setCustomId(`actualizarPerfil-ciudadOrg-${messageId}`)
                break;
            case "personalidad":

                if (extra) {

                    try {

                        await Cachedb.updateOne({ _id: interaction.user.id }, {
                            $setOnInsert: {
                                created: Date.now(),
                            },
                            $set: {
                                personalidad: extra,
                            }
                        }, { upsert: true })

                        const info = {
                            userId: interaction.user.id,
                            action: action,
                            option: extra
                        }


                        const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, extra, "crear_ficha");
                        if (!interaction.deferred && !interaction.replied) {
                            await interaction.update({ components: personalidadV2 });
                        } else {
                            await interaction.editReply({ components: personalidadV2 });
                        }

                        await updateMessage(interaction, msg, null, true, info);

                    } catch (error) {
                        console.log("Error al actualizar la personalidad", error);
                    }
                    return;
                }

                const personalidadV2 = construirJsonV2Personalidad(interaction.user.id, character?.perfil?.Personalidad, "crear_ficha");
                return interaction.reply({ components: personalidadV2, flags: ["Ephemeral", "IsComponentsV2"] });
            case "apellido":
                const familia = new TextInputBuilder()
                    .setCustomId("familiapj")
                    .setLabel("¿Tu personaje tiene apellido (Familia)?")
                    .setPlaceholder("Dejar en blanco si no tiene ningun apellido o linaje familiar")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(10)
                    .setRequired(false)
                modal.setCustomId(`actualizarPerfil-apellido-${messageId}`)
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
                modal.setCustomId(`actualizarPerfil-especialidades-${messageId}`)
                break;
            case "historia":
                time = 60000 - (Date.now() - userf?.time?.pjHistoria)

                if ((Date.now() - userf?.time?.pjHistoria) < 60000) {
                    return interaction.reply({ content: "¡Oye!, Acabo de escribir mucho... estoy cansada (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y " })}` + "`** para establecer otra historia(⇀‸↼‶)", flags: ["Ephemeral"] })
                }

                const historia = new TextInputBuilder()
                    .setCustomId("historiapj")
                    .setLabel("Cuentame más de tu personaje... (Prologo)")
                    .setPlaceholder("[Opcional] Respuesta libre. ")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(2000)
                    .setMinLength(20)
                    .setRequired(false)
                row.addComponents(historia)
                modal.setCustomId(`actualizarPerfil-historia-${messageId}`)
                break;
            case "descripcion":
                time = (1_000 * 60) - (Date.now() - userf?.time?.pjDescripcion)
                if ((Date.now() - userf?.time?.pjDescripcion) < 1_000 * 60) {
                    return interaction.reply({ content: "¡Oye!, acabo de cambiar tu descripcion (￣へ￣)\nEspera al menos **`" + `${timeconvert(time, { language: "es", units: ["m", "s"], round: true, conjunction: " y " })}` + "`** para establecer una nueva descripción (⇀‸↼‶)", flags: ["Ephemeral"] })
                }
                const descrip = new TextInputBuilder()
                    .setCustomId("descripcionset")
                    .setLabel("Ingresa la descripcion")
                    .setPlaceholder("Las descripciones son cortas. Similares al 'info' de whatsapp")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(50)
                    .setMinLength(1)
                    .setRequired(true)
                row.addComponents(descrip)
                modal.setCustomId(`actualizarPerfil-descripcion-${messageId}`)

                break;
            case "notOpcion":
                return interaction.reply({ content: "Hey, eso es solo una opción de decoración ＞﹏＜", flags: ["Ephemeral"] })
            default:
                break;
        }

        await modal.addComponents(row)
        await interaction.showModal(modal)
    }
}