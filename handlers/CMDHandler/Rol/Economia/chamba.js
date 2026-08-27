const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const userdb = db.collection("usuarios_server")
const updateInventario = require("../../../../functions/updateInventario")
const versionEcon = require("../../../../config")
const { createJobDisplayMessage } = require("../../../../interaction/selectMenus/Rol/trabajar")
const { errorMessage } = require("../../../../functions/verifMD")
const { trabajos } = require("../../../../data/economia/economia")
const { recargarEnergia } = require("../../../../functions/dataCharacters")




module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("trabajar")
        .setDescription("Trabaja para obtener algunos lumens [Beta]"),

    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false },
    },
    isDevOnly: false,
    enMantenimiento: false,
    activeGames: new Map(),


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async function (client, interaction, { character, soul }) {
        const user = await userdb.findOne({ _id: interaction.user.id })
        const timeSeconds = Math.floor(Date.now() / 1000)
        const lastTrabajo = user?.Trabajo?.last || 0
        const enfriamiento = Math.floor(Date.now() / 1000) + (4 * 60 * 60)

        const boostMember = interaction.member.roles.cache.has("796205038665072661")

        if (!character?.trabajo) {
            const trabajos2 = await createJobDisplayMessage(1, interaction)

            return await interaction.reply({ components: trabajos2.component, flags: ["IsComponentsV2", "SuppressNotifications"] })
        }

        soul.nucleo.energy = await recargarEnergia(soul.nucleo?.energy, soul)

        if (this.activeGames.get(interaction.user.id)) return interaction.reply({ content: "ya estas trabajando en este momento. (┬┬﹏┬┬)", flags: ["Ephemeral"] })

        if (boostMember) {

            if (character.trabajosExtras.length > 0) {
                const trabajosDisp = []

                const trabajosCh = [
                    character.trabajo.code,
                    ...(character.trabajosExtras?.map(t => t.code).filter(Boolean) || [])
                ];
                console.log(trabajosCh)

                trabajosCh.forEach(key => {
                    const t = trabajos[key]

                    trabajosDisp.push({
                        "label": `${t.nombre}`,
                        "value": `${key}`,
                        "description": null,
                        "emoji": null,
                        "default": false
                    })
                })

                const jsonTrabajoSelect = [
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
                                        "url": "https://i.pinimg.com/1200x/ee/48/36/ee48367684523b9807ddf3539688d4ce.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# ¿En que trabajaras hoy?"
                                    },
                                    {
                                        "type": 10,
                                        "content": "**Beneficio del boost activo**\n\n-# Selecciona alguno de tus dos trabajos"
                                    }
                                ]
                            },
                            {
                                "type": 1,
                                "components": [
                                    {
                                        "type": 3,
                                        "custom_id": `trabajar-${interaction.user.id}-boostJob`,
                                        "options": trabajosDisp,
                                        "placeholder": "Selecciona el trabajo...",
                                        "min_values": 1,
                                        "max_values": 1,
                                        "disabled": false
                                    }
                                ]
                            }
                        ]
                    }
                ]


                return interaction.reply({ components: jsonTrabajoSelect, flags: ["IsComponentsV2", "SuppressNotifications"], withResponse: true })


            } else {
                const trabajosDisp = []

                const allJobs = Object.keys(trabajos)

                const trabajosCh = [
                    character.trabajo.code,
                    ...(character.trabajosExtras?.map(t => t.code).filter(Boolean) || [])
                ];

                const trabajosDisponibles = allJobs.filter(
                    key => !trabajosCh.includes(key)
                )

                trabajosDisponibles.forEach(key => {
                    const t = trabajos[key]

                    trabajosDisp.push({
                        "label": `${t.nombre}`,
                        "value": `${key}`,
                        "description": null,
                        "emoji": null,
                        "default": false
                    })
                })

                const jsonBoost = [
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
                                        "url": "https://i.pinimg.com/736x/d1/4e/7a/d14e7a74645b4b044708fe85d70f97e9.jpg"
                                    },
                                    "description": null,
                                    "spoiler": false
                                },
                                "components": [
                                    {
                                        "type": 10,
                                        "content": "# Selecciona un trabajo adicional"
                                    },
                                    {
                                        "type": 10,
                                        "content": "**¡Gracias por boostear el servidor!** ♡( ◡‿◡ )\n\n-# Como recompensa, tienes acceso a un slot extra de trabajo.\n-# Este slot estará disponible solo mientras tu boost esté activo.\n\n-# **Importante:** Si en algún momento se elimina el boost, no podrás usar el trabajo extra, pero los datos se conservarán para cuando vuelvas a boostear."
                                    }
                                ]
                            },
                            {
                                "type": 1,
                                "components": [
                                    {
                                        "type": 3,
                                        "custom_id": `trabajar-${interaction.user.id}-postular-extraJob`,
                                        "options": trabajosDisp,
                                        "placeholder": "Selecciona un trabajo disponible",
                                        "min_values": 1,
                                        "max_values": 1,
                                        "disabled": false
                                    }
                                ]
                            }
                        ]
                    }
                ]


                return interaction.reply({ components: jsonBoost, flags: ["IsComponentsV2", "SuppressNotifications"] })
            }

        }

        const trabajo = trabajos[character.trabajo.code]
        if (soul.nucleo.energy < trabajo.energia) return interaction.reply({
            content: "No tienes suficiente energia para realizar este trabajo\n-# Tu energia:"
                + `${soul.nucleo.energy}\n-# Energia necesaria: ${trabajo.energia}`
        })

        switch (character.trabajo.code) {
            case "text":

                break;

            case "asisespiritual":
                await this.bibliotecaCreate(interaction, character, soul)
                break;
            case "mensajero":
                await this.deliveryCreate(interaction, character, soul)
                break;
            default:
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

                break;
        }

        return



    },

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    bibliotecaCreate: async function (interaction, character, soul, boost) {
        const { bibliotecaMinigame, minigameMessage, deliveryMinigame } = require("../../../../interaction/buttons/Rol/trabajar")
        const librosColores = ["Rojo", "Morado", "Verde", "Azul", "Naranja", "Amarillo", "Rosa"]
        const maxSecuencia = 5 // Maxima secuencia a recordar :b
        const gameTimeOut = 10_000 // Maximo de tiempo por secuencia para responder :b
        const secuencia = generateSequence()
        const mensajeInicial = `Bienvenido/a cuidador de la biblioteca.\n\n-# Al inicio de tu jornada los libros se encontraban ordenados de la siguiente manera:\n`
            + `-# **${secuencia.join(', ')}**\n\n-# Hasta que un grupo de estudiantes entro y los dejo desordenados. Tienes que volver a ordenarlos antes de terminar tu jornada.\n\nMemoriza el orden y presiona los botones en el orden correcto.\n¡Tienes ${gameTimeOut / 1000} segundos por cada libro` +
            `${character.trabajo.veces === 0 ? "" : `\n\n**El juego comenzara en unos segundos...**`}`
        const buttonComponents1 = []
        const buttonComponents2 = []

        function generateSequence() {
            const sequence = [];
            for (let i = 0; i < maxSecuencia; i++) {
                sequence.push(librosColores[Math.floor(Math.random() * librosColores.length)]);
            }
            return sequence;
        }

        librosColores.forEach((color, index) => {

            const buttonData = {
                "type": 2,
                "style": 2,
                "label": `${color}`,
                "emoji": null,
                "disabled": false,
                "custom_id": `trabajar-${interaction.user.id}-minigame-biblioteca-${color}`
            }

            if (index >= 5) {
                buttonComponents2.push(buttonData)
            } else {
                buttonComponents1.push(buttonData)
            }


        })

        const messageJson = [
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
                        "content": mensajeInicial
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            }
        ]

        if (character.trabajo?.veces === 0) {
            messageJson[0].components.push(
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 2,
                            "style": 3,
                            "label": "Comenzar",
                            "emoji": null,
                            "disabled": false,
                            "custom_id": `trabajar-${interaction.user.id}-minigame-biblioteca-start`
                        }
                    ]
                })
        }


        const messageFinal = await minigameMessage(messageJson, character, soul)
        let messageSend;

        if (boost) {
            messageSend = interaction.update({ components: messageFinal })

            console.log(messageSend)
        } else {
            messageSend = await (await interaction.reply({ components: messageFinal, flags: ["IsComponentsV2", "SuppressNotifications"], withResponse: true })).resource.message
        }
        const self = module.exports

        self.activeGames.set(interaction.user.id, {
            gameType: 'bibliotecario',
            buttons1: buttonComponents1,
            buttons2: buttonComponents2,
            maxSecuencia: maxSecuencia,
            secuenciaUser: [],
            secuencia: secuencia,
            currentIndex: 0,
            correctCount: 0,
            messageId: messageSend.id,
            timeout: null, // Timeout inicial
        })

        try {
            setTimeout(() => bibliotecaMinigame(interaction, "start", character), 6_000)
        } catch (error) {
            console.log(error)
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: "Ocurrio un error en esta interacción... (┬┬﹏┬┬)\n-# Es posible que hayas intentado interactuar con otro mensaje de trabajo, evita hacer eso. (┬┬﹏┬┬)", flags: "Ephemeral" })
                await errorMessage(error, interaction)
            } else {
                await errorMessage(error, interaction)
            }
        }


    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    deliveryCreate: async function (interaction, character, soul, boost) {
        const { minigameMessage, deliveryMinigame } = require("../../../../interaction/buttons/Rol/trabajar")
        const deliveryporPagina = 4
        const deliveryTime = 20_000
        const tutorial = character.trabajo.veces === 0 ? "-# ¡Hola! parece ser que es tu primera vez trabajando... No te preocupes, te explicare lo escencial\n-# Recibirás paquetes etiquetados con letras del abecedario, Cada letra representa a una persona diferente. Por ejemplo: \n\n A = Axel.\n\n-# Cuando te toque entregar un paquete a alguien, solo busca la letra que le corresponde y entrégaselo.\n\n" : "Hola, es bueno verte de nuevo por aqui. Aqui estan los pedidos de hoy:\n\n"
        let paquetesMensaje = ""
        const letrasTotales = ['A', 'B', 'C', 'D', "E", "F", "G", "H"];
        const nombres = ['Kevin', 'Sandra', 'Milly', 'Lucas', 'Elena', 'David', 'Soledad', "Hikari", "Yume", "Miyu", "Kaito", "Emu", "Hinata", "Yuu", "Kumo"];
        const paquetesMenu = [
            {
                "type": 1,
                "components": [
                    {
                        "type": 3,
                        "custom_id": `trabajar-${interaction.user.id}-delivery`,
                        "options": [],
                        "placeholder": "Selecciona el paquete",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    }
                ]
            }
        ]

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        const nombresRevuelto = shuffleArray([...nombres]).splice(0, deliveryporPagina) //Para que A no siempre sea "kevin" (revolver valores)
        const letras = shuffleArray([...letrasTotales].splice(0, deliveryporPagina))
        const paquetesRevueltos = letras.map((letra, i) => ({
            letter: letra,
            name: nombresRevuelto[i]
        }
        ));


        console.log(paquetesRevueltos)


        paquetesRevueltos.forEach(pkg => {
            paquetesMensaje += `- -# **Paquete ${pkg.letter}** para **${pkg.name}**\n`;

            paquetesMenu[0].components[0].options.push({
                "label": `Paquete: ${pkg.letter}`,
                "value": `${pkg.letter}`,
                "description": null,
                "emoji": null,
                "default": false
            })

        });

        const messageJson = [
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://c.tenor.com/LMp0mDmKsjYAAAAd/tenor.gif"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": "# Minijuego del mensajero mágico"
                    },
                    {
                        "type": 10,
                        "content": `${tutorial}${paquetesMensaje}\n\nMemoriza quién recibe cada paquete. ¡Tienes ${deliveryTime / 1000} segundos por entrega!` +
                            `${character.trabajo?.veces === 0 ? " " : `\n\n-# El juego comenzara **<t:${Math.floor((Date.now() / 1000) + 13)}:R>** `}`
                    }
                ]
            }
        ]

        if (character.trabajo?.veces === 0) {
            messageJson.push(
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 2,
                            "style": 3,
                            "label": "Comenzar",
                            "emoji": null,
                            "disabled": false,
                            "custom_id": `trabajar-${interaction.user.id}-minigame-delivery-start`
                        }
                    ]
                })
            messageJson.push({
                "type": 14,
                "divider": true,
                "spacing": 1
            })

        } else {
            messageJson.push({
                "type": 14,
                "divider": true,
                "spacing": 1
            })

            setTimeout(() => deliveryMinigame(interaction, "start", character), 12_000)
        }



        const self = module.exports
        const mensaje = await minigameMessage(messageJson, character, soul)
        const userDataExist = self.activeGames.get(interaction.user.id)



        if (userDataExist) {
            clearTimeout(userDataExist?.timeoutEnd)
            userDataExist.gameType = 'delivery'
            userDataExist.selectMenu = paquetesMenu
            userDataExist.maxSecuencia = deliveryporPagina
            userDataExist.secuenciaUser = []
            userDataExist.secuencia = paquetesRevueltos
            userDataExist.currentDelivery = null
            userDataExist.estadoActual = {
                paquetesRestantes: letras,
                personasPendientes: nombresRevuelto
            }
            userDataExist.correctDeliveries = 0
            userDataExist.ronda += 1
            userDataExist.timeout = null // Timeout inicial
            console.log("Mensaje de vuelta:", mensaje)
            return mensaje
        } else {
            let messageSend;

            if (boost) {
                messageSend = interaction.update({ components: mensaje })

                console.log(messageSend)
            } else {
                messageSend = await (await interaction.reply({ components: mensaje, flags: ["IsComponentsV2"], withResponse: true }))
            }



            self.activeGames.set(interaction.user.id, {
                gameType: 'delivery',
                selectMenu: paquetesMenu,
                maxSecuencia: deliveryporPagina,
                secuenciaUser: [],
                secuencia: paquetesRevueltos,
                currentDelivery: null,
                estadoActual: {
                    paquetesRestantes: letras,
                    personasPendientes: nombresRevuelto,
                },
                correctDeliveries: 0,
                ronda: 0,
                dineroAcum: 0,
                messageId: messageSend.id,
                timeout: null, // Timeout inicial
            })
        }

    },

    cleanCreate: async function (interaction, character, soul) {
        const CLEANING_AGENTS = {
            "disolvente_arcana": { name: "Disolvente Arcana", emoji: "🧪" },
            "hechizo_purificacion": { name: "Hechizo de Purificación", emoji: "✨" },
            "escoba_encantada": { name: "Escoba Encantada", emoji: "🧹" },
            "recipiente_contencion": { name: "Recipiente de Contención", emoji: "🫙" }
        };

        // Definición de los tipos de suciedad y qué agente los limpia
        const DIRT_TYPES = [
            {
                name: "Moco de Duende",
                description: "Una sustancia pegajosa y verde, subproducto de travesuras elementales.",
                correctAgent: "disolvente_arcana"
            },
            {
                name: "Polvo de Estrellas Fugaces",
                description: "Residuo brillante y volátil de conjuros de invocación astral.",
                correctAgent: "recipiente_contencion"
            },
            {
                name: "Mancha de Poción Burbujeante",
                description: "Una marca ácida y humeante dejada por un experimento de alquimia fallido.",
                correctAgent: "hechizo_purificacion"
            },
            {
                name: "Restos de Runas Rotas",
                description: "Fragmentos de inscripciones mágicas que perdieron su poder.",
                correctAgent: "escoba_encantada"
            },
            {
                name: "Telaraña de Sombra",
                description: "Una urdimbre oscura y fría dejada por criaturas nocturnas.",
                correctAgent: "hechizo_purificacion"
            },
            {
                name: "Cristal de Mana Derretido",
                description: "Un charco pegajoso y brillante de energía mágica inestable.",
                correctAgent: "recipiente_contencion"
            },
            {
                name: "Cenizas de Fuego Fatuo",
                description: "Pequeñas partículas incandescentes que flotan en el aire.",
                correctAgent: "escoba_encantada"
            }
        ];

        const DIRT_SPOTS_PER_GAME = 7; // Número de manchas a limpiar en un juego
        const GAME_TIMEOUT_MS = 120 * 1000; // 120 segundos (2 minutos) para completar todo el juego

        // Cantidades iniciales de agentes que el jugador tiene para el juego
        const INITIAL_AGENT_QUANTITIES = {
            "disolvente_arcana": 2,
            "hechizo_purificacion": 2,
            "escoba_encantada": 2,
            "recipiente_contencion": 2
        };

        /**
 * Obtiene un tipo de suciedad aleatorio de la lista, evitando repeticiones si es posible.
 * @param {string[]} excludeNames Nombres de suciedad a excluir.
 * @returns {object} Un objeto de tipo de suciedad.
 */
        function getRandomDirtType(excludeNames = []) {
            const availableDirt = DIRT_TYPES.filter(d => !excludeNames.includes(d.name));
            if (availableDirt.length === 0) {
                // Si no quedan tipos únicos, reinicia la lista o toma cualquiera
                return DIRT_TYPES[Math.floor(Math.random() * DIRT_TYPES.length)];
            }
            return availableDirt[Math.floor(Math.random() * availableDirt.length)];
        }

        const dirtSpots = [];
        const usedDirtNames = new Set();
        for (let i = 0; i < DIRT_SPOTS_PER_GAME; i++) {
            let newDirtType;
            do {
                newDirtType = getRandomDirtType();
            } while (usedDirtNames.has(newDirtType.name) && usedDirtNames.size < DIRT_TYPES.length); // Evitar repeticiones si hay suficientes tipos
            usedDirtNames.add(newDirtType.name);

            dirtSpots.push({
                id: `spot_${i}`, // ID único para la mancha
                type: newDirtType,
                cleaned: false
            });
        }

        // Estado inicial de los agentes de limpieza
        const agentQuantities = { ...INITIAL_AGENT_QUANTITIES };

        let initialMessage = `¡Bienvenido, Encargado de Limpieza! La habitación está llena de suciedad mágica. Tu tarea es diagnosticar y limpiar cada mancha.\n\n` +
            `**Manchas en la Habitación:**\n`;
        dirtSpots.forEach((spot, index) => {
            initialMessage += `\`Mancha ${index + 1}:\` ${spot.type.name}\n`;
        });

        initialMessage += `\n**Agentes de Limpieza Disponibles:**\n`;
        for (const agentKey in agentQuantities) {
            initialMessage += `${CLEANING_AGENTS[agentKey].emoji} ${CLEANING_AGENTS[agentKey].name}: ${agentQuantities[agentKey]} usos\n`;
        }
        initialMessage += `\n¡Tienes ${GAME_TIMEOUT_MS / 1000} segundos para limpiar la habitación!`;

    }

}