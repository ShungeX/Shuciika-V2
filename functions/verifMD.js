const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, PermissionsBitField, User, CommandInteraction, GuildMember, ChannelType } = require("discord.js")
const clientdb = require("../Server.js");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characterPj = db2.collection("Personajes")
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)
const transaccionCache = require("../utils/cache.js")
const { v4: uuidv4 } = require('uuid');
const client = require("../bot.js")



const dmActiveCheck = new Map()

const guild = client.guilds.cache.get("716342375303217285")
const categoria = guild.channels.cache.get("1079982078105497700")
const bloquedrol = guild.roles.cache.get("1138984843418542140")
const unbloquedrol = guild.roles.cache.get("1397641367911530647")


/**
* @param {Object} param -Parametros de un mensaje de discord
* @param {Client} client 
* @param {GuildMember} member
* @param {ChatInputCommandInteraction} interaction
*/
async function sendMD(member, param = {}) {
    try {
        if (!param) {
            console.error("No se pudo enviar el mensaje al MD debido a que faltan parametros", member.id)
            return
        }

        await member.send(param)
        console.log("Mensaje enviado correctamente al MD del usuario")

        if (member.roles.cache.has(bloquedrol.id)) {
            await member.roles.remove(bloquedrol, 'MDs desbloqueados.');
            console.log(`[${guild.name}] Rol '${bloquedrol.name}' removido de ${member.id}.`);
        }
        if (!member.roles.cache.has(unbloquedrol.id)) {
            await member.roles.add(unbloquedrol, 'MDs desbloqueados.');
            console.log(`${unbloquedrol.name} asignado a ${member.id}.`);
        }

        return true
    } catch (error) {
        if (error.code === 50007) {
            console.warn("No se puede enviar MD a ", member.id, " Iniciando proceso de verificación")
            await Mdbloqued(member, param)
            return false
        } else {
            await errorMessage(error)
            console.error("Ocurrio, un error diferente al enviar al MD", error)
        }
    }


}

/**
* @param {Object} param -Parametros de un mensaje de discord
* @param {Client} client 
* @param {GuildMember} member
* @param {ChatInputCommandInteraction} interaction
*/
async function Mdbloqued(member, messageExtra = null) {
    if (!member.roles.cache.has(bloquedrol.id)) {
        try {
            await member.roles.add(unbloquedrol, "Usuario con MD bloqueado")
        } catch (error) {
            console.error(`No se ha podido asignar el rol de MD bloqueados a ${member.displayName} | ${member.id}`)
            errorMessage(error)
        }
    }

    let channelTemp = dmActiveCheck.get(member.id)
    channelTemp = await guild.channels.cache.get(channelTemp)

    if (!channelTemp) {
        try {

            channelTemp = await guild.channels.create({
                name: `mdverif-${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
                type: ChannelType.GuildText,
                parent: categoria.id,
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone
                        deny: [PermissionsBitField.Flags.ViewChannel], // Nadie puede verlo por defecto
                    },
                    {
                        id: member.id, // El usuario específico
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], // Solo el usuario puede verlo y escribir
                    },
                    {
                        id: client.user.id, // El bot
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], // Solo el bot puede verlo y escribir
                    }
                ],
                reason: `Canal temporal para verificación de MDs de ${member.id}.`
            })

            console.log(`Canal temporal creado para el usuario ${member.id}`)

            const messageprelim = [
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

            const message = [
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
                                    "content": "¡Hola, [@usuario]! Hemos notado que no podemos enviarte mensajes directos (MD). Pero para recibir notificaciones importantes, misiones personales y disfrutar de la experiencia completa del rol, necesitarás habilitar tu MD para este servidor.\n\n**Es un requisito técnico para las funciones avanzadas.**"
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
                                        "url": "attachment://8635c94e415f4e73c02da532aa804648.mp4"
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
                            "content": "Para versiones de celular (Android/IOS)"
                        },
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": "attachment://dc7069af8b2a47feb00fbbdb68930c1b.mp4"
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
                            "content": "Una vez que lo hayas hecho, presiona el botón de abajo para verificar."
                        }
                    ]
                }
            ]

            if (messageExtra) {
                await channelTemp.send(messageExtra)
            }
            await channelTemp.send({ components: messageprelim, flags: ["IsComponentsV2"] })

            dmActiveCheck.set(member.id, channelTemp.id)

        } catch (error) {
            errorMessage(error)
        }
    } else {
        if (messageExtra) {
            try {
                if(messageExtra) {
                await channelTemp.send(messageExtra)
                }

                await channelTemp.send({content: `Recordatorio para verificar tus MD: ${member}`}).then(m => setTimeout(() => m.delete(), 5000))
            } catch (error) {
                errorMessage(error, null)
            }

        }
    }
}

/**
* @param {Object} param -Parametros de un mensaje de discord
* @param {Client} client 
* @param {GuildMember} member
* @param {ChatInputCommandInteraction} interaction
*/
async function errorMessage(error, interaction) {
    const channelError = guild.channels.cache.get("716518718947065868")

    let filePath = 'Desconocido';
    let methodName = 'Desconocido';
    let lineNumber = 'Desconocido';

    if (error.stack) {
        const stackLines = error.stack.split('\n').map(line => line.trim());

        // Filtra líneas de node_modules y de archivos internos de Node.js
        // y busca la primera línea que parezca ser de tu código.
        const relevantLine = stackLines.find(line =>
            line.startsWith('at') &&
            !line.includes('node_modules') &&
            !line.includes('node:internal') &&
            (line.includes('.js') || line.includes('<anonymous>')) // Asegura que sea un archivo JS o función anónima
        );

        if (relevantLine) {
            // Regex para capturar el nombre de la función (opcional), la ruta del archivo y el número de línea.
            // Ejemplos que maneja:
            // at async createCharacter (C:\path\to\file.js:92:17)
            // at Object.ejecutar (C:\path\to\file.js:58:9)
            // at C:\path\to\file.js:92:17 (para funciones anónimas)
            const regex = /at\s+(?:async\s+)?(?:(.*?)\s+\()?([^:]+):(\d+)(?::\d+)?\)?/;
            const match = relevantLine.match(regex);

            if (match) {
                methodName = match[1] || 'anonymous'; // Grupo 1: Nombre de la función, o 'anonymous'
                // Limpiar el nombre del método si incluye prefijos de objeto o exportación
                if (methodName.startsWith('Object.')) methodName = methodName.substring('Object.'.length);
                if (methodName.startsWith('module.exports.')) methodName = methodName.substring('module.exports.'.length);
                if (methodName === '<anonymous>') methodName = 'anonymous'; // Estandarizar 'anonymous'

                filePath = match[2]; // Grupo 2: Ruta completa del archivo
                // Hacer la ruta relativa al directorio de trabajo actual
                const cwd = process.cwd().replace(/\\/g, '/'); // Normalizar CWD a barras inclinadas
                if (filePath.startsWith(cwd)) {
                    filePath = filePath.substring(cwd.length);
                }
                filePath = filePath.replace(/\\/g, '/'); // Asegurar barras inclinadas
                if (filePath.startsWith('/')) filePath = filePath.substring(1); // Remover barra inicial si existe

                lineNumber = match[3]; // Grupo 3: Número de línea
            } else {
                // Fallback para líneas que no encajan en el regex principal pero son relevantes
                const simpleMatch = relevantLine.match(/([^:]+):(\d+)(?::(\d+))?/);
                if (simpleMatch) {
                    filePath = simpleMatch[1];
                    const cwd = process.cwd().replace(/\\/g, '/');
                    if (filePath.startsWith(cwd)) {
                        filePath = filePath.substring(cwd.length);
                    }
                    filePath = filePath.replace(/\\/g, '/');
                    if (filePath.startsWith('/')) filePath = filePath.substring(1);
                    lineNumber = simpleMatch[2];
                    methodName = 'anonymous'; // Asumir anónimo si no se capturó nombre de método
                }
            }
        }
    }



    const messageError = [
        {
            "type": 10,
            "content": "<@&734142447256469584>"
        },
        {
            "type": 17,
            "accent_color": 16711680,
            "spoiler": false,
            "components": [
                {
                    "type": 10,
                    "content": "# Ocurrio un error al ejecutar un comando"
                },
                {
                    "type": 10,
                    "content": `\`\`\`js\n${error.name}: ${error.message}\n\`\`\``
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 10,
                    "content": " **`📂` Archivo:**\n-# " + `\`${filePath}:${lineNumber}\``
                },
                {
                    "type": 10,
                    "content": " **`🧨` Metodo:**\n-# " + `\`${methodName}\``
                },
                {
                    "type": 10,
                    "content": " **`🖥️` Comando:**\n-# " + `\`${getCommandString(interaction)}\``
                },
                {
                    "type": 10,
                    "content": " **`💚` Usuario:**\n-# " + `${interaction?.user?.tag} (${interaction?.user?.id})`
                },
                {
                    "type": 10,
                    "content": " **`🪡` Canal:**\n-# " + `<#${interaction?.channel?.id}>`
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                {
                    "type": 10,
                    "content": "`Fecha del error:`" + `<t:${Math.floor(Date.now() / 1000)}:R>\n\n-# Sistema de reporte de errores. `
                }
            ]
        }
    ]

    try {
        await channelError.send({ components: messageError, flags: ["IsComponentsV2"] })
        console.log("[ERROR_LOG] Error enviado correctamente ")
    } catch (err) {
        console.error("[ERROR_LOG] No se pudo enviar el error al canal")
        console.error(error, err)
    }
}

function getCommandString(interaction) {
    if (!interaction) return '/Desconocido';

    if (interaction.isCommand?.()) { // Es un Slash Command
        let fullCommand = interaction.commandName;
        const subcommandGroup = interaction.options.getSubcommandGroup(false); // false para no lanzar error si no existe
        const subcommand = interaction.options.getSubcommand(false); // false para no lanzar error si no existe

        if (subcommandGroup) {
            fullCommand += ` ${subcommandGroup}`;
        }
        if (subcommand) {
            fullCommand += ` ${subcommand}`;
        }
        return `/${fullCommand}`;
    } else if (interaction.isButton?.() || interaction.isSelectMenu?.() || interaction.isModalSubmit?.()) {
        // Es una interacción de componente o modal, usamos el customId
        return `/${interaction.customId}`;
    }
    // Fallback para otros tipos de interacción no manejados explícitamente
    return '/Desconocido';
}



module.exports = {
    sendMD,
    Mdbloqued,
    errorMessage,
}


