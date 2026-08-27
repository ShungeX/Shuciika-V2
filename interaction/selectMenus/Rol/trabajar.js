const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, time } = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const userdb = db.collection("usuarios_server")
const updateInventario = require("../../../functions/updateInventario")
const versionEcon = require("../../../config")
const { trabajos } = require("../../../data/economia/economia")
const { recargarEnergia } = require("../../../functions/dataCharacters")




module.exports = {
    customId: "trabajar",
    selectAuthor: true,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async function ({ interaction, character, componentData: option, options: { option1: action, option2: extra } }) {
        const { deliveryCreate, bibliotecaCreate, activeGames } = require("../../../handlers/CMDHandler/Rol/chamba")
        let soul;

        switch (action) {
            case "delivery":
                this.deliveryResponse(interaction, option, character)
                break;
            case "postular":
                if (character.trabajo && character.trabajosExtras?.length > 0) return interaction.update({ content: "No puedes seleccionar este trabajo porque ya estas en uno (┬┬﹏┬┬)", components: [], flags: ["Ephemeral"] })
                await this.selectJob(interaction, option, character, extra === "extraJob" ? true : false)
                break;

            case "selectOptions":

                soul = await souls.findOne({ _id: interaction.user.id })

                if (option === "continuar") {

                    const returnJson = await deliveryCreate(interaction, character, soul)

                    console.log("Mensaje obtenido", returnJson)

                    if (!returnJson) {
                        interaction.reply({ content: "No se pudo continuar con el minijuego debido a un error... (┬┬﹏┬┬)", flags: ["Ephemeral"] })
                    } else {
                        interaction.update({ components: returnJson })
                    }

                } else {
                    this.endMiniGame(interaction, character, soul, trabajos[character.trabajo.code], true)
                }

                break;
            case "boostJob":
                const trabajo = trabajos[option]
                soul = await souls.findOne({ _id: interaction.user.id })
                const currentEnergy = await recargarEnergia(soul.nucleo?.energy ?? 0, soul);

                if (currentEnergy < trabajo.energia) return interaction.reply({
                    content: "No tienes suficiente energía para realizar este trabajo\n-# Tu energía: "
                        + `${currentEnergy}\n-# Energía necesaria: ${trabajo.energia}`
                })

                if (activeGames.get(interaction.user.id)) return interaction.reply({ content: "ya estas trabajando en este momento. (┬┬﹏┬┬)", flags: ["Ephemeral"] })

                if (option === "bibliotecario") {
                    await bibliotecaCreate(interaction, character, soul, true)
                } else if (option === "mensajero") {
                    await deliveryCreate(interaction, character, soul, true)
                } else {
                    const user = await userdb.findOne({ _id: interaction.user.id })
                    const timeSeconds = Math.floor(Date.now() / 1000)
                    const lastTrabajo = user?.Trabajo?.last || 0
                    const enfriamiento = Math.floor(Date.now() / 1000) + (4 * 60 * 60)

                    if (lastTrabajo >= timeSeconds) {
                        return interaction.reply({ content: `Tu personaje debe descansar antes de volver a trabajar. Debes esperar <t:${lastTrabajo}:R>`, ephemeral: true })
                    }


                    const lumensRand = Math.floor(Math.random() * (50 - 30 + 1) + 5)

                    const embed = new EmbedBuilder()
                        .setTitle("Has trabajado arduamente")
                        .setDescription("Te han pagado un total de **`" + lumensRand + "`** <a:Lumens:1335709991130103910> por tu arduo trabajo")
                        .setColor("Random")
                        .setFooter({ text: `Sistema de economia: ${versionEcon.versionEc}` })

                    await characters.updateOne({ _id: interaction.user.id }, {
                        $inc: {
                            "Dinero": lumensRand
                        }
                    })

                    await userdb.updateOne({ _id: interaction.user.id }, {
                        $set: {
                            "Trabajo.last": enfriamiento
                        }
                    })

                    interaction.reply({ embeds: [embed] })
                }

            default:
                break;
        }



    },

    selectJob: async function (interaction, option, character, extraJob) {
        const jobSelect = trabajos[option]
        if (!jobSelect) return interaction.reply({ content: "No se pudo seleccionar el trabajo.", flags: ["Ephemeral"] }).then(console.log("Ocurrio un error al seleccionar el trabajo: No disponible"))

        const confirmMessage = [
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
                                "url": "https://i.pinimg.com/736x/b6/a6/ef/b6a6ef75165a149b238a5335abf2a337.jpg"
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "Bienvenido a tu nuevo trabajo " + `${character.Nombre}`
                            },
                            {
                                "type": 10,
                                "content": "-# Ahora trabajas en: " + `**${jobSelect.nombre}**`
                            },
                            {
                                "type": 10,
                                "content": "\n*Puedes empezar a trabajar escribiendo nuevamente el comando **`/rol trabajar`***"
                            }
                        ]
                    }
                ]
            }
        ]

        if (extraJob) {
            await characters.updateOne({ ID: character.ID }, {
                $push: {
                    trabajosExtras: {
                        code: option,
                        nivel: 1,
                        veces: 0,
                        desde: Math.floor(Date.now() / 1000),
                    }
                }
            })
        } else {

            await characters.updateOne({ ID: character.ID }, {
                $set: {
                    trabajo: {
                        code: option,
                        nivel: 1,
                        veces: 0,
                        desde: Math.floor(Date.now() / 1000),
                    }
                }
            })
        }


        return interaction.update({ components: confirmMessage })
    },

    /**
    * Crea el mensaje de Discord (Embed + Componentes) para mostrar los trabajos.
    * @param {number} pageNumber El número de página actual a mostrar.
    * 
    */
    createJobDisplayMessage: async function (pageNumber, interaction) {
        const trabajosLista = []
        const jobporPagina = 3
        const allJobKeys = Object.keys(trabajos); // Array con todas las claves de los trabajos
        const totalPages = Math.ceil(allJobKeys.length / jobporPagina); // Calcular el total de páginas

        const jobsOnPage = getJobsForPage(pageNumber);

        // Añadir cada trabajo como un campo en el embed
        jobsOnPage.forEach(({ key, data }) => {
            const limitText = data.limite === Infinity ? "Hasta cansarse" : `${data.limite} veces por día`;
            const propinaText = data.propina ? "Sí (por suerte)" : "No";
            const mortalText = data.mortal ? "Sí" : "No";
            const img = data.img ? data.img : "https://i.pinimg.com/736x/bb/ae/02/bbae027f086f24fefc0f0de3904a8e7d.jpg"

            const jobJSON = {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": img
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": `- **${data.nombre}:**\n` + `-# ${data.descripcion}\n\n` + `- - -# **Salario: **${data.salario[0]}-${data.salario[1]} Lumens\n` +
                            `- - -# **Energia Req: ** ${data.energia} puntos\n` + `- - -# **Limite diario: **${limitText}\n` + `- - -# **Propina: ** ${propinaText}\n` +
                            `- - -# **Mortal: ** ${mortalText}`
                    }
                ]
            }

            trabajosLista.push(jobJSON)
        });

        trabajosLista.push({
            "type": 14,
            "divider": true,
            "spacing": 1
        },)
        // Fila de botones de navegación (si hay más de una página)
        if (totalPages > 1) {
            const buttonData = {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Anterior",
                        "emoji": null,
                        "disabled": pageNumber === 1,
                        "custom_id": `trabajar-${interaction.user.id}-listajobs-${pageNumber - 1}`
                    },
                    {
                        "type": 2,
                        "style": 2,
                        "label": "Siguiente",
                        "emoji": null,
                        "disabled": pageNumber === totalPages,
                        "custom_id": `trabajar-${interaction.user.id}-listajobs-${pageNumber + 1}`
                    }
                ]
            }

            trabajosLista.push(buttonData)
        }

        const selectMenuOptions = jobsOnPage.map(({ key, data }) => ({
            "label": `${data.nombre}`,
            "value": `${key}`,
            "description": `Salario: ${data.salario[0]}-${data.salario[1]} L, Energía: ${data.energia} E`,
            "emoji": null,
            "default": false

        }))


        const selectMenuList = {
            "type": 1,
            "components": [
                {
                    "type": 3,
                    "custom_id": `trabajar-${interaction.user.id}-postular`,
                    "options": selectMenuOptions,
                    "placeholder": "",
                    "min_values": 1,
                    "max_values": 1,
                    "disabled": false
                }
            ]
        }

        trabajosLista.push(selectMenuList)

        const trabajoEnd = [
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": [{
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": "https://i.pinimg.com/736x/3b/17/b1/3b17b11f0291089a8b36228dee3e5c56.jpg"
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": "# ¡Trabajo Voluntario!"
                        },
                        {
                            "type": 10,
                            "content": "-# ¡Oh, noble usuario! Ante ti se despliega el sagrado abanico de...\n\n-# **¡El trabajo forzado voluntario!**\n-# ¡Elige sabiamente! tomara un tiempo que puedas renunciar y aplicar para otro trabajo"
                        }
                    ]
                },
                {
                    "type": 14,
                    "divider": true,
                    "spacing": 1
                },
                ...trabajosLista,

                ]
            }
        ]

        return { component: trabajoEnd, };

        /**
        * Obtiene los trabajos para una página específica.
        * @param {number} pageNumber El número de página (empezando en 1).
        * @returns {Array<{key: string, data: object}>} Un array de objetos con la clave y los datos del trabajo.
        */
        function getJobsForPage(pageNumber) {
            const startIndex = (pageNumber - 1) * jobporPagina;
            const endIndex = startIndex + jobporPagina;
            return allJobKeys.slice(startIndex, endIndex).map(key => ({ key, data: trabajos[key] }));
        }
    },

    /**
 * 
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 */
    deliveryResponse: async function (interaction, paqueteSelect, character) {
        const { activeGames } = require("../../../handlers/CMDHandler/Rol/chamba")
        const { minigameMessage } = require("../../buttons/Rol/trabajar")
        const deliveryGame = activeGames.get(interaction.user.id)
        const soul = await souls.findOne({ _id: interaction.user.id })
        let mensaje = ""

        if (!deliveryGame) return interaction.reply({ content: "Esta interacción ya no es valida (┬┬﹏┬┬)", flags: ["Ephemeral"] })
        clearTimeout(deliveryGame.timeout)

        paquetesMensaje = ""

        const correcto = deliveryGame.secuencia.some(a => a.letter === paqueteSelect && a.name === deliveryGame.currentDelivery);


        if (correcto) {
            deliveryGame.correctDeliveries++;
            mensaje = `¡Entrega correcta! El paquete **${paqueteSelect}** fue entregado a la persona correcta`
        } else {
            mensaje = paqueteSelect === null ? `No entregaste a tiempo el paquete de ${deliveryGame.currentDelivery}` : `¡Entrega incorrecta! El paquete **${paqueteSelect}** no era para **${deliveryGame.currentDelivery}.**`
        }

        if (paqueteSelect === null) {
            deliveryGame.estadoActual.personasPendientes = deliveryGame.estadoActual.personasPendientes.filter(n => n !== deliveryGame.currentDelivery); //Elimina a la persona seleccionada
        } else {
            deliveryGame.estadoActual.paquetesRestantes = deliveryGame.estadoActual.paquetesRestantes.filter(p => p !== paqueteSelect); //Elimina el paquete seleccionado
            deliveryGame.estadoActual.personasPendientes = deliveryGame.estadoActual.personasPendientes.filter(n => n !== deliveryGame.currentDelivery); //Elimina a la persona seleccionada
        }


        deliveryGame.currentDeliveryIndex++;

        if (deliveryGame.estadoActual.personasPendientes.length === 0) {
            this.endMiniGame(interaction, character, soul, trabajos.mensajero)

        } else {

            const messageInfo = deliveryGame.estadoActual.personasPendientes.length === 1 ? "Ya casi acabas. Este es el ultimo paquete" : "Preparate, entregaras el siguiente paquete pronto..."
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
                            "content": `-# ${mensaje}\n\n-# ${messageInfo}`
                        }
                    ]
                }
            ]

            const mensajeSend = await minigameMessage(json, character, soul)

            const self = module.exports

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ components: mensajeSend })
                } else {
                    await interaction.update({ components: mensajeSend })
                }


            } catch (error) {
                activeGames.delete(interaction.user.id)
                await interaction.reply({ content: "ocurrio un error en el minijuego, no se ha gastado tu energía pero tampoco has obtenido recompensas", flags: "Ephemeral" })
                console.error(error)
            }

            setTimeout(() => self.nextDelivery(interaction, paqueteSelect, character, soul), 5000)
        }

    },

    nextDelivery: async function (interaction, paqueteSelect, character, soul) {
        const self = module.exports

        const { activeGames } = require("../../../handlers/CMDHandler/Rol/chamba")
        const { minigameMessage } = require("../../buttons/Rol/trabajar")
        const deliveryGame = activeGames.get(interaction.user.id)
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
        deliveryGame.currentDelivery = seleccionarAleatorio(deliveryGame.estadoActual.personasPendientes)


        deliveryGame.estadoActual.paquetesRestantes.map(letter => {
            paquetesMensaje += `\n- -# ${letter}`

            options.components[0].options.push({
                "label": `${letter}`,
                "value": `${letter}`,
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
                        "content": `¿Que paquete vas a entregar?\n\nPaquetes disponibles: ${paquetesMensaje}\nEntrega tardía: <t:${Math.floor((Date.now() / 1000) + 16)}:R>`
                    }
                ]
            }
        ]


        json.push(options)

        console.log("Persona actual:", deliveryGame.currentDelivery)
        const messageFinal = await minigameMessage(json, character, soul)
        deliveryGame.timeout = setTimeout(() => self.deliveryResponse(interaction, null, character), 15_000);

        await interaction.editReply({ components: messageFinal })

        function seleccionarAleatorio(array) {
            return array[Math.floor(Math.random() * array.length)];
        }

    },

    endMiniGame: async function (interaction, character, soul, jobData, definity = false, isTimeout = false) {
        const { activeGames } = require("../../../handlers/CMDHandler/Rol/chamba")
        const { minigameMessage } = require("../../buttons/Rol/trabajar")
        const deliveryGame = activeGames.get(interaction.user.id)

        if (deliveryGame && deliveryGame.timeout) {
            clearTimeout(deliveryGame.timeout);
        }

        if (definity) {
            clearTimeout(deliveryGame.timeoutEnd)

            const messageComponent = [
                {
                    "type": 9,
                    "accessory": {
                        "type": 11,
                        "media": {
                            "url": "https://c.tenor.com/Hehsl_icRLIAAAAC/tenor.gif"
                        },
                        "description": null,
                        "spoiler": false
                    },
                    "components": [
                        {
                            "type": 10,
                            "content": "# Has terminado de trabajar"
                        },
                        {
                            "type": 10,
                            "content": "**Resultado:**\n\n- -# **Lumens totales:** " + `${deliveryGame.dineroAcum}`
                                + `\n- -# **Trabajaste un total de ${deliveryGame.ronda + 1} veces**`
                        },
                        {
                            "type": 10,
                            "content": "¡Bien hecho, ahora puedes descansar! "
                        }
                    ]
                }
            ]

            const messageFinal = await minigameMessage(messageComponent, character, soul)

            activeGames.delete(interaction.user.id)

            console.log(messageFinal)

            if (isTimeout) {
                interaction.editReply({ components: messageFinal })
            } else {
                interaction.update({ components: messageFinal })
            }

            return
        }

        const finalData = this.getLumens(character, deliveryGame)

        let lumensEarned = finalData[0];
        let message = finalData[1];
        soul.energy = await recargarEnergia(soul?.nucleo?.energy ?? 0, soul);

        console.log(finalData)

        await characters.updateOne({ _id: interaction.user.id }, {
            $inc: {
                Dinero: lumensEarned,
                "trabajo.veces": 1
            }
        })

        await souls.updateOne({ _id: interaction.user.id }, {
            $inc: {
                "nucleo.energy": -jobData.energia,
                "energy": -jobData.energia
            }
        })
        character.veces += 1
        soul.nucleo.energy += -jobData.energia
        deliveryGame.dineroAcum += lumensEarned
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
                        "content": "# Entregas finalizadas"
                    },
                    {
                        "type": 10,
                        "content": `-# ${finalContent}\n\n-# Tu secuencia de entrega: ${deliveryGame.secuenciaUser.length > 0 ? deliveryGame.secuenciaUser.join(", ") : "No acertaste ninguna"}\n\n`
                            + `-# ${soul.nucleo.energy < jobData.energia ? "Te has quedado sin energía para trabajar. En unos momentos se dara tu resultado..." : `¿Deseas continuar trabajando? ` + "`" + `(-${jobData.energia}⚡)` + "`"}`
                    }
                ]
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 3,
                        "custom_id": `trabajar-${interaction.user.id}-selectOptions`,
                        "options": [
                            {
                                "label": "Continuar",
                                "value": `continuar`,
                                "description": null,
                                "emoji": null,
                                "default": false
                            },
                            {
                                "label": "Dejar de trabajar",
                                "value": `abandonar`,
                                "description": null,
                                "emoji": null,
                                "default": false
                            }
                        ],
                        "placeholder": "¿Deseas continuar trabajando?",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": soul.nucleo.energy < jobData.energia
                    }
                ]
            }
        ]

        const messageFinal = await minigameMessage(messageComponent, character, soul)

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ components: messageFinal }).then(
                deliveryGame.timeoutEnd = setTimeout(() => this.endMiniGame(interaction, character, soul, jobData, true, true), 20_000)
            )
        } else {
            await interaction.update({ components: messageFinal }).then(

                deliveryGame.timeoutEnd = setTimeout(() => this.endMiniGame(interaction, character, soul, jobData, true, true), 20_000))
        }

    },

    getLumens: function (character, dataGame) {
        const jobData = trabajos[character.trabajo.code]
        let lumensEarned = 0
        let message = '';

        if (character.trabajo.code === "mensajero") {
            if (dataGame.correctDeliveries === dataGame.maxSecuencia) {
                // Recompensa máxima
                lumensEarned = jobData.salario[1];
                message = `¡Increíble! Lograste entregar todos los paquetes correctamente. Ganaste **${lumensEarned} Lumens**.`;
            } else if (dataGame.correctDeliveries > 0) {
                // Recompensa parcial
                lumensEarned = Math.floor(jobData.salario[0] + (jobData.salario[1] - jobData.salario[0]) * (dataGame.correctDeliveries / dataGame.maxSecuencia));
                message = `Lograste entregar ${dataGame.correctDeliveries} de ${dataGame.maxSecuencia} paquetes de forma correcta. Ganaste **${lumensEarned} Lumens**.`;
            } else {
                // Sin recompensa o mínima
                lumensEarned = jobData.salario[0]; // Salario mínimo por intentarlo
                message = `No lograste entregar ningun paquete de forma correcta. Ganaste el salario base de **${lumensEarned} Lumens**.`;
            }

        }

        return [lumensEarned, message]
    },

}