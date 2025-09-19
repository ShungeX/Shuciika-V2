const { ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, PermissionsBitField, User, CommandInteraction, GuildMember, ChannelType } = require("discord.js")
const clientdb = require("../../../Server.js");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characterPj = db2.collection("Personajes")
const souls = db2.collection("Soul")
const { errorMessage } = require("../../../functions/verifMD.js");
const { createJobDisplayMessage, deliveryResponse } = require("../../selectMenus/Rol/trabajar.js");
const { trabajos } = require("../../../economia.js");
const config = require("../../../config.js");
const { activeGames } = require("../../../handlers/CMDHandler/Rol/Economia/chamba.js");



module.exports = {
    customId: "trabajar",
    buttonAuthor: true,

    /**
    * @param {Client} client 
    * @param {ChatInputCommandInteraction} interaction
    */

    ejecutar: async function (client, interaction, action, option, color) {
        const character = await characterPj.findOne({ _id: interaction.user.id })

        if (action === "listajobs") {
            const data = await createJobDisplayMessage(Number(option), interaction)

            await interaction.update({ components: data.component })
        }

        if (action === "minigame") {
            switch (option) {
                case "biblioteca":
                    this.bibliotecaMinigame(interaction, color, character)
                    break;

                case "delivery":
                    this.deliveryMinigame(interaction, color, character)
                default:
                    break;
            }

        }
    },

    deliveryMinigame: async function (interaction, option, character) {
        const deliveryGame = activeGames.get(interaction.user.id)
        const soul = await souls.findOne({ _id: interaction.user.id })

        if (!deliveryGame) return interaction.reply({ content: "Esta interacción ya no es valida (┬┬﹏┬┬)", flags: ["Ephemeral"] })
        clearTimeout(deliveryGame.timeout)

        paquetesMensaje = ""
        const options = {
            "type": 1,
            "components": [
                {
                    "type": 3,
                    "custom_id": `trabajar-${interaction.user.id}-delivery`,
                    "options": [],
                    "placeholder": "Selecciona el paquete a entregar",
                    "min_values": 1,
                    "max_values": 1,
                    "disabled": false
                }
            ]
        }

        if (option === "start") {
            deliveryGame.currentDelivery = seleccionarAleatorio(deliveryGame.estadoActual.personasPendientes)
            deliveryGame.secuencia.forEach(pkg => {
                paquetesMensaje += `\n- -# ${pkg.letter}`

                options.components[0].options.push({
                    "label": `${pkg.letter}`,
                    "value": `${pkg.letter}`,
                    "description": null,
                    "emoji": null,
                    "default": false
                })

            })
            const json = [
                {
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": "https://i.pinimg.com/736x/00/a2/47/00a247725f88c9fcf5f53f4ab464e998.jpg"
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": `# Paquete para ${deliveryGame.currentDelivery}`
                        },
                        {
                            "type": 10,
                            "content": `-# Primera entrega del día, ¿Qué paquete entregas?\n\nPaquetes disponibles: ${paquetesMensaje}\nEntrega tardía: <t:${Math.floor((Date.now() / 1000) + 21)}:R>`
                        }
                    ]
                }
            ]

            json.push(options)

            const self = module.exports

            const messageFinal = await self.minigameMessage(json, character, soul)
            deliveryGame.timeout = setTimeout(() => deliveryResponse(interaction, null, character), 20_000);

            try {
                if(interaction.deferred || interaction.replied) {
                interaction.editReply({ components: messageFinal })
                }else {
                interaction.update({ components: messageFinal })
                }

            } catch (error) {
                interaction.editReply({ components: messageFinal })
            }


        }

        function seleccionarAleatorio(array) {
            return array[Math.floor(Math.random() * array.length)];
        }
    },

    bibliotecaMinigame: async function (interaction, color, character) {
        const gameTimeOut = 10_000 // Maximo de tiempo por secuencia para responder :b
        const trabajoData = trabajos["bibliotecario"]
        const user = interaction.user
        const gameState = activeGames?.get(user.id)
        const soul = await souls.findOne({ _id: interaction.user.id })
        if (!character.Nombre) {
            character = await characterPj.findOne({ _id: interaction.user.id })
        }

        console.log(character.Nombre)

        try {

            if (!gameState) {

                if (interaction.deferred || interaction.replied) {
                    return interaction.followUp({ content: "Ocurrio un error en esta interacción... (┬┬﹏┬┬)\n-# Es posible que hayas intentado interactuar con otro mensaje de trabajo, evita hacer eso. (┬┬﹏┬┬)", flags: ["Ephemeral"] })
                }
                return interaction.reply({ content: "Esta interacción ya no esta disponible (┬┬﹏┬┬)", flags: ["Ephemeral"] })
            }

            if (color === "start") {
                const self = module.exports;
                const messageComponent = [
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": "https://i.pinimg.com/736x/89/9a/c0/899ac0f1bb6f33a1add7c1f70ea17cdc.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Mini-juego del bibliotecario"
                            },
                            {
                                "type": 10,
                                "content": `<t:${Math.floor((Date.now() / 1000) + 10)}:R>`,
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
                        "components": gameState.buttons1
                    },
                    {
                        "type": 1,
                        "components": gameState.buttons2
                    }
                ]



                const messageJson = await self.minigameMessage(messageComponent, character, soul)


                try {
                    await interaction.update({ components: messageJson })
                } catch (error) {
                    await interaction.editReply({ components: messageJson })

                }


                gameState.timeout = setTimeout(() => self.endGame(interaction, gameState.correctCount, trabajoData, character, soul), gameTimeOut)
                return
            }

            clearTimeout(gameState.timeout)

            const colorEsperado = gameState.secuencia[gameState.currentIndex]

            let newContent = '';
            let isGameOver = false;

            console.log("Color seleccionado", color)
            console.log("Color esperado", colorEsperado)

            if (color === colorEsperado) {
                gameState.correctCount++;
                gameState.currentIndex++;
                gameState.secuenciaUser.push(colorEsperado)

                if (gameState.currentIndex < gameState.secuencia.length) {
                    newContent = `¡Correcto! ¿Cual es el siguiente libro?`;
                } else {
                    newContent = `¡Felicidades! Has organizado todos los libros correctamente. ¡Trabajo completado!`;
                    isGameOver = true;
                }
            } else {
                newContent = `¡Incorrecto! Esperaba **${colorEsperado}** pero elegiste **${color}**. El orden de los libros se ha perdido.`;
                isGameOver = true;
            }


            if (isGameOver) {
                await this.endGame(interaction, gameState.correctCount, trabajoData, character, soul);
            } else {
                const messageComponent = [
                    {
                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": "https://i.pinimg.com/736x/89/9a/c0/899ac0f1bb6f33a1add7c1f70ea17cdc.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "# Mini-juego del bibliotecario"
                            },
                            {
                                "type": 10,
                                "content": `<t:${Math.floor((Date.now() / 1000) + 10)}:R>\n\n-# Tu secuencia: ${gameState.secuenciaUser}\n\n-# ${newContent}`,
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
                        "components": gameState.buttons1
                    },
                    {
                        "type": 1,
                        "components": gameState.buttons2
                    }
                ]

                const messageJson = await this.minigameMessage(messageComponent, character, soul)

                gameState.timeout = setTimeout(() => this.endGame(interaction, gameState.correctCount, trabajoData, character, soul), gameTimeOut);
                await interaction.update({ components: messageJson }); // Actualizar el mensaje con el nuevo estado
            }
        } catch (error) {
            console.log(error)
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp("Ocurrio un error en esta interacción... (┬┬﹏┬┬)")
                await errorMessage(error, interaction)
            } else {
                await errorMessage(error, interaction)
            }
        }


    },

    /**
    * @param {Client} client 
    * @param {ChatInputCommandInteraction} interaction
    */

    endGame: async function (interaction, correctCount, jobData, character, soul, continueJob) {
        const userId = interaction.user.id;
        const gameState = activeGames.get(userId);

        if (gameState && gameState.timeout) {
            clearTimeout(gameState.timeout);
        }
        activeGames.delete(userId); // Eliminar el juego activo

        let lumensEarned = 0;
        let message = '';

        if (correctCount === gameState.maxSecuencia) {
            // Recompensa máxima
            lumensEarned = jobData.salario[1];
            message = `¡Increíble! Has organizado todos los libros perfectamente. Ganaste **${lumensEarned} Lumens**.`;
        } else if (correctCount > 0) {
            // Recompensa parcial
            lumensEarned = Math.floor(jobData.salario[0] + (jobData.salario[1] - jobData.salario[0]) * (correctCount / gameState.maxSecuencia));
            message = `Lograste organizar ${correctCount} de ${gameState.maxSecuencia} libros. Ganaste **${lumensEarned} Lumens**.`;
        } else {
            // Sin recompensa o mínima
            lumensEarned = jobData.salario[0]; // Salario mínimo por intentarlo
            message = `No lograste organizar los libros correctamente. Ganaste el salario base de **${lumensEarned} Lumens**.`;
        }

        await characterPj.updateOne({ _id: interaction.user.id }, {
            $inc: {
                Dinero: lumensEarned,
            }
        })

        await souls.updateOne({ _id: interaction.user.id }, {
            $inc: {
                energy: -jobData.energia
            }
        })
        soul.energy = -jobData.energia


        const finalContent = `${message}\n\n-# Energía gastada: ` + "`" + `${jobData.energia}⚡` + "`";



        const messageComponent = [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://i.pinimg.com/736x/89/9a/c0/899ac0f1bb6f33a1add7c1f70ea17cdc.jpg"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Mini-juego finalizado. "
                    },
                    {
                        "type": 10,
                        "content": `-# ${finalContent}\n\n-# Tu secuencia: ${gameState.secuenciaUser.length > 0 ? gameState.secuenciaUser.join(", ") : "No acertaste ninguna"}\n\n-# Este mensaje se borrara en unos segundos...`,
                    }
                ]
            },
        ]

        const messageJson = await this.minigameMessage(messageComponent, character, soul)

        try {

            await interaction.update({ components: messageJson }).then(m => setTimeout(() => m.delete(), 15_000))
        } catch (err) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ components: messageJson }).then(m => setTimeout(() => m.delete(), 15_000))
            } else {
                console.error("Error al enviar mensaje final del juego de bibliotecario:", err);
                errorMessage(err, interaction)
            }


        }
    },

    minigameMessage: async function (minigameData, character, soul) {
        const niveles = [
            { nombre: "Novato", rango: (nivel) => nivel >= 1 && nivel <= 5 },
            { nombre: "Intermedio", rango: (nivel) => nivel >= 6 && nivel <= 7 },
            { nombre: "Experto", rango: (nivel) => nivel >= 8 }
        ];

        const rango = niveles.find(n => n.rango(character.trabajo.nivel));

        const jsonFinal = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [
                ]
            },
        ]

        const topMessage = [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://c.tenor.com/AaxsbDWIIL0AAAAC/tenor.gif"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": `# Estas trabajando de ${trabajos[character.trabajo.code].nombre}`
                    },
                    {
                        "type": 10,
                        "content": `-# **Empleado:** ${character.Nombre}\n-# **Nivel de empleo:** ${character.trabajo.nivel} [${rango ? rango.nombre : "Desconocido"}]` +
                            "\n-# **Energía:** `" + `${soul.energy}⚡` + "`"
                    },
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
        ]

        const footerMessage = [
            {
                "type": 10,
                "content": `-# Sistema de economia [Trabajos] | Version: ${config.versionEc}`
            },
        ]

        jsonFinal[0].components.push(...topMessage)
        jsonFinal[0].components.push(...minigameData)
        jsonFinal[0].components.push(...footerMessage)
        return jsonFinal
    },
}
