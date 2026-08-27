const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, PermissionsBitField, User, CommandInteraction, GuildMember, ChannelType } = require("discord.js")
const clientdb = require("../../../Server.js");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characterPj = db2.collection("Personajes")
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4 } = require('uuid');
const { procesarFoto } = require("./ActualizarFoto");
const { errorMessage } = require("../../../functions/verifMD.js");


module.exports = {
    customId: "informacionRol",
    buttonAuthor: false,

    ejecutar: async (client, interaction, option) => {
        console.log(option)

        switch (option) {
            case "chprincipales":
                canalesPrincipales(interaction)
                break;
            case "inicioRol":
                inicio()
                break;
            default:
                break;
        }


        function canalesPrincipales(interaction) {
            const canalesjson = [
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
                                    "url": "https://i.pinimg.com/1200x/03/8e/ac/038eac055552abd8870b6161e2f6c590.jpg"
                                },
                                "description": null,
                                "spoiler": false
                            },
                            "components": [
                                {
                                    "type": 10,
                                    "content": "# Canales principales del Rol"
                                },
                                {
                                    "type": 10,
                                    "content": "Canales divididos en su función y proposito.\n\nEl contenido de canales se ira actualizando periodicamente"
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
                            "content": "**Lobby:**\n- -# [Novedades del rol](https://discord.com/channels/716342375303217285/812205418910449665)\n- -# [Buscar roleo](https://discord.com/channels/716342375303217285/1396662352434167948)\n- -# [Chat rol](https://discord.com/channels/716342375303217285/1396661228960481411)"
                        },
                        {
                            "type": 10,
                            "content": "**Lore (foros):**\n- -# [Lore principal/canonico](https://discord.com/channels/716342375303217285/1335001008920723598)\n- -# [Sistemas](https://discord.com/channels/716342375303217285/1365827270622580758)\n- -# [Eventos](https://discord.com/channels/716342375303217285/1368707896287957012)"
                        },
                        {
                            "type": 10,
                            "content": "**Canales del instituto (Disponibles 24/7):**\n- -# [Status Tobeya](https://discord.com/channels/716342375303217285/1368013029165240390)\n- -# [Entrada](https://discord.com/channels/716342375303217285/1396665944725651456)\n- -# [Santuario](https://discord.com/channels/716342375303217285/1396666041974652928)"
                        },
                        {
                            "type": 10,
                            "content": "**Ciudad de Tobeya (Disponibles 24/7):**\n- -# [Hospital](https://discord.com/channels/716342375303217285/1091945533242867732)\n- -# [Estación policia](https://discord.com/channels/716342375303217285/1197249862127865907)\n- -# [Centro de la ciudad](https://discord.com/channels/716342375303217285/1197249723820671027)"
                        }
                    ]
                }
            ]

            interaction.reply({ components: canalesjson, flags: ["IsComponentsV2", "Ephemeral"] })
        }

        function inicio() {
            const primerospasos = [
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
                                    "content": "# Tus primeros pasos "
                                },
                                {
                                    "type": 10,
                                    "content": "Estos son los primeros pasos a seguir para comenzar tu aventura en el rol."
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
                            "content": "1. **Presentate**\n-# Pasa por el canal [Chat rol](https://canary.discord.com/channels/716342375303217285/1396661228960481411) para saludar a tus nuevos compañeros.\n\n2. **Consulta tu perfil**\n-# Ve al canal [Comandos](https://canary.discord.com/channels/716342375303217285/1197245719451533414) y usa el comando `/rol perfil` para visualizar tu ficha. Si quieres personalizarla usa `/rol configurar_personaje`\n\n3. **¡A rolear!**\n-# Una vez listo puedes comenzar hablando por [Entrada al instituto](https://canary.discord.com/channels/716342375303217285/1396665944725651456) ¡Mucha suerte, aprendiz!"
                        }
                    ]
                }
            ]

            interaction.reply({components: primerospasos, flags: ["IsComponentsV2", "Ephemeral"]})
        }
    }
}