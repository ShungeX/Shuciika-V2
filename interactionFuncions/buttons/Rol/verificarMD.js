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
    customId: "verifMD",
    buttonAuthor: true,

    /**
    * @param {Client} client 
    * @param {ChatInputCommandInteraction} interaction
    */

    ejecutar: async (client, interaction, select) => {

        try {
            const guild = client.guilds.cache.get("716342375303217285")
            const categoria = guild.channels.cache.get("1079982078105497700")
            const bloquedrol = guild.roles.cache.get("1138984843418542140")
            const unbloquedrol = guild.roles.cache.get("1397641367911530647")

            const member = guild.members.cache.get(interaction.user.id)


            console.log(select)

            if (select === "pctutorial") {
                const messagePC = [
                    {
                        "type": 17,
                        "accent_color": 14396152,
                        "spoiler": false,
                        "components": [
                            {
                                "type": 9,
                                "accessory": {
                                    "type": 11,
                                    "media": {
                                        "url": "https://i.pinimg.com/736x/20/4f/28/204f280860580558a829d5a096d76ba3.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# Política de Comunicación del Instituto"
                                    },
                                    {
                                        "type": 10,
                                        "content": `¡Hola, ${interaction.user}! Hemos notado que no podemos enviarte mensajes directos (MD). Puedes continuar en el servidor, pero para recibir notificaciones importantes, misiones personales y disfrutar de la experiencia completa del rol, necesitarás habilitar tu MD para este servidor.\n\n**Es un requisito técnico para las funciones avanzadas.**`
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
                                "content": "¿Cómo hacerlo?\n\nPara versiones de escritorio (pc)"
                            },
                            {
                                "type": 12,
                                "items": [
                                    {
                                        "media": {
                                            "url": "https://cdn.discordapp.com/attachments/665423320765693982/1397649009929228389/Mi_video.mp4?ex=68827d93&is=68812c13&hm=ede49154818f075d8656f0aa7ae70dcc8c10f2838dfe9e2c5feeb8d5d86b2906&"
                                        },
                                        "description": null,
                                        "spoiler": false
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
                                    "style": 1,
                                    "label": "Mostrar tutorial",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": `verifMD-${member.id}-celtutorial`
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "Para versiones de celular (Android/IOS)"
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
                                "content": "Una vez que lo hayas hecho, presiona el botón de abajo para verificar."
                            },
                            {
                                "type": 1,
                                "components": [
                                    {
                                        "type": 2,
                                        "style": 3,
                                        "label": "Verificar MD",
                                        "emoji": null,
                                        "disabled": false,
                                        "custom_id": `verifMD-${member.id}-verifStatus`
                                    }
                                ]
                            }
                        ]
                    }
                ]
                return interaction.update({ components: messagePC })
            } else if (select === "celtutorial") {
                const messageCel = [
                    {
                        "type": 17,
                        "accent_color": 14396152,
                        "spoiler": false,
                        "components": [
                            {
                                "type": 9,
                                "accessory": {
                                    "type": 11,
                                    "media": {
                                        "url": "https://i.pinimg.com/736x/20/4f/28/204f280860580558a829d5a096d76ba3.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# Política de Comunicación del Instituto"
                                    },
                                    {
                                        "type": 10,
                                        "content": `¡Hola, ${member}! Hemos notado que no podemos enviarte mensajes directos (MD). Puedes continuar en el servidor, pero para recibir notificaciones importantes, misiones personales y disfrutar de la experiencia completa del rol, necesitarás habilitar tu MD para este servidor.\n\n**Es un requisito técnico para las funciones avanzadas.**`
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
                                    "style": 1,
                                    "label": "Mostrar tutorial",
                                    "emoji": null,
                                    "disabled": false,
                                    "custom_id": `verifMD-${member.id}-pctutorial`
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "¿Cómo hacerlo?\n\nPara versiones de escritorio (pc)"
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
                                "content": "Para versiones de celular (Android/IOS)"
                            },
                            {
                                "type": 12,
                                "items": [
                                    {
                                        "media": {
                                            "url": "https://cdn.discordapp.com/attachments/665423320765693982/1397649795774156831/Mi_video-1.mp4?ex=68827e4e&is=68812cce&hm=f898a563d9d7e7128b22758701c661081daffb08d387d057ca58f9c881ccc991&"
                                        },
                                        "description": null,
                                        "spoiler": false
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
                                "content": "Una vez hayas realizado los pasos y activado el MD, presiona el boton de abajo para verificar"
                            },
                            {
                                "type": 1,
                                "components": [
                                    {
                                        "type": 2,
                                        "style": 3,
                                        "label": "Verificar MD",
                                        "emoji": null,
                                        "disabled": false,
                                        "custom_id": `verifMD-${member.id}-verifStatus`
                                    }
                                ]
                            }
                        ]
                    }
                ]
                return interaction.update({ components: messageCel })
            } else if (select === "verifStatus") {
                if (!member) return interaction.reply({ content: "No se a podido realizar la solicitud. Intentalo de nuevo" })

                try {
                    await interaction.user.send({ content: "-# Mensaje de prueba...", flags: ["SuppressNotifications"] }).then(m => setTimeout(() => m.delete(), 2000))
                    console.log("[¡Verificación del MD's realida por completo!]")

                    if (member.roles.cache.has(bloquedrol.id)) {
                        await member.roles.remove(bloquedrol, 'MDs desbloqueados.');
                        console.log(`[${guild.name}] Rol '${bloquedrol.name}' removido de ${member.id}.`);
                    }
                    if (!member.roles.cache.has(unbloquedrol.id)) {
                        await member.roles.add(unbloquedrol, 'MDs desbloqueados.');
                        console.log(`${unbloquedrol.name} asignado a ${member.id}.`);
                    }


                    const channelTemp = await guild.channels.fetch(interaction.channel.id)

                    const deleteMessage = [
                        {
                            "type": 10,
                            "content": "Se ha verificado correctamente. Este canal sera eliminado dentro de unos segundos... ( ´ ꒳ ` )🧨\n<t:" + Math.floor((Date.now() / 1000) + 15) + ":R>"
                        }
                    ]

                    await interaction.update({components: deleteMessage}).then(setTimeout(() => channelTemp.delete("Verificación del usuario completada"), 15000))
                } catch (error) {
                    if (error.code === 50007) {
                        interaction.reply({ content: "Parece que aún no has habilitado los mensajes directos (MD). Verifica que hayas seguido los pasos correctamente.\n-# Es posible que los cambios tarden entre 5 y 10 segundos en aplicarse.\n-# Si ya lo hiciste y crees que se trata de un error, por favor abre un ticket para que podamos ayudarte." })
                    } else {
                        interaction.reply({ content: "ocurrio un error inesperado al verificar. Abre un ticket con adjuntando una captura de este mensaje." })
                        console.log(error)
                    }
                }

            }
        } catch (error) {
            errorMessage(error, interaction)
        }


    }
}