const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const npcs = db2.collection("NPCs")
const regiones = db2.collection("Regiones")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const getXp = require("../../../functions/getXP")
const { duelSystem, duelEmitter } = require("../../../functions/duelManager")
const util = require(`util`);
const updateInventario = require("../../../functions/updateInventario")
const sleep = util.promisify(setTimeout)
const configServer = require("../../../config")


const explorarModulo2 = {
    customId: "exOp",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async function(client, interaction, state, key, actions) {
        const soul = await souls.findOne({_id: interaction.user.id})
        const userCache = transaccionCache.getUser(interaction.user.id)
        let cache;

        if(userCache) {
            cache = transaccionCache.get(userCache?.explorarID)
            if(!cache) return interaction.reply({content: "No puedes interactuar con esta opcion porque ya ha caducado ＞﹏＜", flags: ["Ephemeral"]})
        }else {
            return interaction.reply({content: "No puedes interactuar con esta opcion porque ya ha caducado ＞﹏＜", ephemeral: true})
        }

        console.log("state", state)

        switch (state) {
            case "zona":
                explorarModulo2.zonaMessage(client, interaction, key, soul)
                break;
                case "battle": 
                explorarModulo2.battleSwitch(client, interaction, key, soul, actions, userCache)
            default:
                break;
        }

        return



        async function getRewards(enemy, characterId) {
            const loot = enemy.loot
            const recompensas = []

            for(const recompensa of loot) {
                const isItem = recompensa.typeLoot === "item"

                if(recompensa.dropRate >= 1) {
                    const cantidad = getRandomCantidad(recompensa.quantity)
                    let obj = {
                        ...recompensa,
                        cantidad: cantidad,

                    }

                    if(isItem) {
                        const objInfo = await duelSystem.getObjetInfo(recompensa.itemId[0], recompensa.itemId[1])

                        obj = {
                            ...recompensa,
                            Nombre: objInfo.Nombre,
                            ID: objInfo.ID,
                            cantidad: cantidad
                        }
                    }

                    
                    let objData = {
                        ID: recompensa?.itemId?.[1],
                        Region: recompensa?.itemId?.[0],
                        cantidad: cantidad,
                        isItem: isItem,
                        typeLoot: recompensa.typeLoot
                    }

                   const isLevel = await updateInventario(client, interaction, characterId, objData)

                   if(isLevel?.message) {
                    levelUp = isLevel
                  }

                    recompensas.push(obj)
                }else {
                    if(Math.random() < recompensa.dropRate) {

                    
                        const cantidad = getRandomCantidad(recompensa.quantity)
                        let obj = {
                            ...recompensa,
                            cantidad: cantidad,
    
                        }

                        if(isItem) {
                            const objInfo = await duelSystem.getObjetInfo(recompensa.itemId[0], recompensa.itemId[1])
                            obj = {
                                ...recompensa,
                                Nombre: objInfo.Nombre,
                                ID: objInfo.ID,
                                cantidad: cantidad
                            }

                        }

                        let objData = {
                            ID: recompensa?.itemId?.[1],
                            Region: recompensa?.itemId?.[0],
                            cantidad: cantidad,
                            isItem: isItem,
                            typeLoot: recompensa.typeLoot
                        }

                      const isLevel =  await updateInventario(client, interaction, characterId, objData)

                      if(isLevel?.message) {
                        levelUp = isLevel
                      }

                        recompensas.push(obj)  
                    }                  
                }
            }

            return recompensas.map(reward => { 
                switch(reward.typeLoot) {
                    case "item" : 
                        return `${reward.cantidad} **${reward.Nombre}**`
                    case "xp": 
                        return `<:XP:1350575069113352265> **XP: ** ${reward.cantidad}`
                    case "lumens":
                        return `<a:Lumens:1335709991130103910> **Lumens:** ${reward.cantidad} `
                    default: 
                    return `${reward.cantidad} **${reward.Nombre}**`
                    
                }
            }).join("\n")

        }

        async function resumeExploration(cache, rewards, isWin = false, cacheId) {
            const messageWin = isWin ? `Ganaste el duelo contra **${cache.enemy.Nombre}**` : `Perdiste el duelo contra **${cache.enemy.Nombre}**`
            const embed = new EmbedBuilder()
            .setTitle("Resultado de la batalla / Exploración")
            .setDescription(levelUp ? `${messageWin}\n-# ¿Deberiamos seguir explorando?\n Ademas... ${levelUp.message}`: `${messageWin}\n-# ¿Deberiamos seguir explorando?`)
            .setTimestamp()
            if(isWin) {
                const gifswin = []

                embed.addFields(
                    {name: "Has conseguido:", value: `${rewards}`}
                )
                embed.setImage("https://c.tenor.com/FDQMqVd1Eo0AAAAd/tenor.gif")
                .setColor("Green")
            }else {
                embed.setImage("https://c.tenor.com/GpeoeGe1yiMAAAAd/tenor.gif")
                .setColor("Red")
            }


            let components = new StringSelectMenuBuilder()
            .setCustomId(`selectRegion-${interaction.user.id}-${cacheId}`)
            .setPlaceholder("¿Que quieres hacer? ♪(^∇^*)")
            .setMaxValues(1)

            components.addOptions(
                {
                    label: `Seguir explorando [ ⚡${cache.areas[cache.areaSelect].energiaNecesaria} ]`,
                    description: `Continuaras explorando en ${cache.areas[cache.areaSelect].Nombre}`,
                    value: `continue*${cache.areaSelect}`,
                    emoji: `<a:CirnoFumoWalking1:1350682005691699220>`
                },
                {
                    label: `Dejar de explorar`,
                    description: `Siempre es bueno saber hasta donde soltar las cosas`,
                    value: `surrend*${cache.areaSelect}`,
                    emoji: "<:TuxedoSamTired:1350682023370555454>"
                }
            )    
            
            components = new ActionRowBuilder().addComponents(components)            

            await interaction.user.send({content: `Puedes continuar explorando.\n-# [Has click aqui para ir al mensaje de exploración](https://discord.com/channels/${cache.message.guildId}/${cache.message.channelId}/${cache.message.id})`})
            return cache.message.edit({embeds: [embed], components: [components]})

        }

        function getRandomCantidad(cantidad) {
            const [min, max] = cantidad.split('-').map(Number)

            return Math.floor(Math.random() * ((max || 1) - min + 1)) + min;
        }

        function getEnergy(currentEnergy, maxEnergy) {
            const porcentaje = (currentEnergy / maxEnergy) * 100
            const maxbar = 5;
    
            let filledBars  = Math.round(((currentEnergy > maxEnergy ? maxEnergy : currentEnergy) / maxEnergy) * maxbar)
            const emptyBars = maxbar - filledBars;
    
            let energyBars = "⚡".repeat(filledBars)
            let energyEmpty = ".".repeat(emptyBars)
    
            return "`"+ `[${energyBars}${energyEmpty}]` + "`" + ` **(${currentEnergy}/${maxEnergy})**`
    
        }

        
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    zonaMessage: async function(client, interaction, key, soul) {
        
        const userCache = transaccionCache.getUser(interaction.user.id)
        const exploracionCache = transaccionCache.get(userCache?.explorarID)

        if(!exploracionCache) return interaction.reply({content: "Esta interaccion ya no es valida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true})

            let zonaSelect = await regiones.aggregate([
                { 
                  $match: { 
                    _id: exploracionCache.regionSelect 
                  } 
                },
                {
                  $project: {
                    _id: 0,
                    area: `$areas.${key}` 
                  }
                },
                {
                  $replaceRoot: {
                    newRoot: "$area"
                  }
                }
              ]).toArray();

        zonaSelect = zonaSelect[0]

        if(!zonaSelect) return interaction.reply({content: "Al parecer ese lugar ya no aparece en el mapa...", ephemeral: true})
        exploracionCache.zona = key
        
        const options = []

        const components = [
                {
                  "type": 10,
                  "content": "# Sistema de exploración \n-# *Región Seleccionada:* `" + exploracionCache.regionNombre + "`" +
                  "\n-# *Zona Seleccionada:* `" + zonaSelect.Nombre + "`" 
                  + `\n-# *Energia:*  ${explorarModulo2.barrasDeEnergia((soul?.energy || 0), configServer.maxEnergy)}`
                },
                {
                  "type": 10,
                  "content": "*¿Qué sub-zona vamos a explorar hoy?* ( •̀ ω •́ )y"
                },
                {
                  "type": 14,
                  "divider": true,
                  "spacing": 2
                },
              ];


        Object.keys(zonaSelect.subzonas).forEach(key => {
            const subzona = zonaSelect.subzonas[key]
            const isHabilitado = subzona.habilitado ? "`" + `(⚡${subzona.energiaNecesaria})` + "`" : "[Deshabilitado]"

            if(subzona.habilitado) {
                options.push(
                        {
                            "label": `${subzona.nombre}`,
                            "value": `subzona*${key}`,
                            "description": `${subzona?.descripcion || ""}`,
                            "emoji": null,
                            "default": false
                        }
              );

              components.push({
                "type": 10,
                "content": `-# - **${subzona.nombre} ${isHabilitado}**`
            });
            }
        })

        components.push(
            {
                "type": 1,
                "components": [
                    {
                        "type": 3,
                        "custom_id": `selectExplorar-${interaction.user.id}`,
                        "options": options,
                        "placeholder": "Selecciona una opción...",
                        "min_values": 1,
                        "max_values": 1,
                        "disabled": false
                    },
                ],

            },
            {
              "type": 14,
              "divider": true,
              "spacing": 1
            },
            {
              "type": 12,
              "items": [
                {
                  "media": {
                    "url": "https://i.pinimg.com/originals/b9/69/02/b96902ca778bdd612e49f137f71dfa28.gif"
                  },
                  "description": null,
                  "spoiler": false
                }
              ]
            },
            {
              "type": 10,
              "content": "-# Puedes actualizar tu energia cón el boton de actualizar. (10 min > 1 punto de energia.)"
            }
        );


        const v2Exploracion = [
            {
              "type": 17,
              "accent_color": null,
              "spoiler": false,
              "components": components
            }
          ];

        try {
            interaction.deferUpdate()
            const message = await interaction.channel.messages.fetch(exploracionCache.message.id)
            await message.edit({components: v2Exploracion, flags: ["IsComponentsV2"]})
        } catch (error) {
            console.error(error)
            return interaction.reply({content: "Esta interaccion ya no es valida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true})
        }


    },

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    battleSwitch: async function(client, interaction, enemyId, soul, action, cache) {
        const { calcularAmenaza, generateMessage } = require("../../selectMenus/Rol/ExplorarOptions")

        const exploracionCache = transaccionCache.get(cache?.explorarID)
        if(!exploracionCache) return interaction.reply({content: "Esta interaccion ya no es valida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true})


        let subzonaSelect = await regiones.aggregate([
            { 
              $match: { 
                _id: exploracionCache.regionSelect 
              } 
            },
            {
              $project: {
                _id: 0,
                subzona: `$areas.${exploracionCache.zona}.subzonas.${exploracionCache.subzona}` 
              }
            },
            {
              $replaceRoot: {
                newRoot: "$subzona"
              }
            }
          ]).toArray();


        const enemy = await npcs.findOne({_id: `${enemyId}`})

        const MdAuthor = await interaction.user.createDM()
        let message;
        exploracionCache.actualName = subzonaSelect[0].nombre

        try {
            message = await interaction.channel.messages.fetch(`${exploracionCache.message.id}`)

            if(!message) return interaction.reply({content: "Esta interaccion ya no es valida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true})

            await MdAuthor.send({content: "-# Comprobando DM...\n-# Este mensaje se borra automaticamente", flags: ["SuppressNotifications"]}).then(
                m => setTimeout(() => m.delete(), 3000)
            )
        } catch (error) {
            return interaction.reply({content: "No puedes iniciar un duelo si tienes los **mensajes directos** desactivados.\n-# Intenta activar 'Mensajes directos de otros' o pide ayuda en el foro <#1064054917662265404>", ephemeral: true})
        }

        if(!enemy) {
                console.log("Enemigo no encontrado [explorarSelect.js]")
                return interaction.reply({content: "Hubo un error al cargar el duelo. [Enemigo no encontrado]\n-# Intenta cancelar el encuentro o contacta a soporte con una captura de este mensaje... 〒▽〒", ephemeral: true})
        }


        if(action === "runAway") {
            const probabilidad = explorarModulo2.getEscapeP(enemy.restrictions?.probabilidadEscape || 100, soul.stats.agilidad, soul.stats.inteligencia)
            const roll = Math.random() * 100       
            const isSuccess = (roll < probabilidad)
            const dificultad = calcularAmenaza(soul, enemy)

            const messages = {
                "debil": 
                [
                    {title: "Intentas escapar...", description: "No todos los combates se ganan con fuerza. A veces, la mejor decisión es saber cuándo correr.", value: 1},
                    {title: "Te das la vuelta...", description: "Consciente del riesgo, optas por retirarte. El sonido de tus pasos resuena con fuerza.", value: 1},
                    {title: "¡Huyendo del peligro!", description: "Giras sobre tus talones y te lanzas a la carrera, buscando cualquier ruta de escape.", value: 1},
                    {title: "Intentas escapar...", description: "Tu instinto de supervivencia se activa: es hora de huir.", value: 1},

                ],
                "medio": [
                    {title: "¡No es cobardía… es estrategia!", description: "El miedo aprieta el pecho, pero tus piernas no dudan. Cada segundo podría ser el último.", value: 1},
                    {title: "La adrenalina te domina", description: "La mirada del enemigo te hiela la sangre. Tu única salida es huir, y corres con el alma en llamas.", value: 1},
                    {title: "La valentía también es saber huir", description: "El corazón late con fuerza mientras tomas la difícil decisión de no luchar… aún no.", value: 1},
                ],
                "hard": [
                    {title: "¡Escape.exe iniciado!", description: "Realizas una retirada táctica con una velocidad que ni tú sabías que tenías.", value: 1},
                    {title: "No estás listo… aún", description: "Apretando los dientes, das un paso atrás. El orgullo duele más que las heridas que no llegaste a tener.", value: 1},
                    {title: "Te invade el temblor…", description: "El sudor recorre tu frente. No hay tiempo para pensar. Tus pies se mueven antes que tus pensamientos.", value: 1},
                    {title: "El orgullo se traga en silencio", description: "Te tragas el impulso de pelear. No te rendiste... simplemente elegiste vivir.", value: 1},
                ],
                "very hard": [
                    {title: "El juicio del cazador te alcanza", description: " Sabes que huir no asegura la vida… pero quedarte sí promete la muerte.", value: 1},
                    {title: "Las estrellas no están de tu lado… aún", description: "El cielo se mantuvo en silencio. Sin un augurio favorable, tu instinto mágico te empuja a retroceder.", value: 1},
                    {title: "La noche te traga entre susurros", description: "Corres, y a tu alrededor, el silencio se quiebra como cristal. Algo quedó atrás… y no sabes si era tu valor o tu alma.", value: 1},
                    {title: "Tu instinto grita: huye", description: "La presencia enemiga es abrumadora. Escapar es tu única opción… si es que puedes.", value: 1},
                ],
                "imposible": [
                    {title: "Te paralizas...", description: "Tus pies no se mueven, ni siquiera lo intentan.", value: 1},
                ],
            }

            const listaMensajes = messages[dificultad.rangoEstandar]
            const indexAleatorio = listaMensajes[Math.floor(Math.random() * listaMensajes.length)]
            const gifs = [
                "https://c.tenor.com/MMA6_WvqS60AAAAd/tenor.gif",
                "https://c.tenor.com/am4tzoTsnRoAAAAd/tenor.gif",
                "https://c.tenor.com/mUIXigPWPuYAAAAd/tenor.gif",
                "https://c.tenor.com/XbfdY2Lx-zwAAAAd/tenor.gif",
                "https://c.tenor.com/vR_UG67oFQgAAAAd/tenor.gif",
                "https://c.tenor.com/DkH7lr8ysZcAAAAd/tenor.gif",
            ]
            const gifrunSelect = gifs[Math.floor(Math.random() * gifs.length)]

            const jsonEscape = [{
                "type": 10,
                "content": `# ${indexAleatorio.title}`
            },
            {
                "type": 10,
                "content": `-# **${indexAleatorio.description}**`
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": gifrunSelect
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            }]
            const runComponent = await generateMessage(soul, subzonaSelect[0], jsonEscape, true)
            
            message.edit({components: runComponent, flags: ["IsComponentsV2"]})

            await sleep(4000)

            if(isSuccess) {
                
                const gifsSuccess = [
                    "https://c.tenor.com/dCBeOkxsWdoAAAAd/tenor.gif",
                    "https://c.tenor.com/VaBUk122gEcAAAAd/tenor.gif",
                    "https://c.tenor.com/fT_gwZ3_Y7EAAAAd/tenor.gif",
                    "https://c.tenor.com/Ad1pri3DFaoAAAAd/tenor.gif",
                    "https://c.tenor.com/o0ygxwGlEx4AAAAd/tenor.gif"
                ]

                const gifSuccessSelect = gifsSuccess[Math.floor(Math.random() * gifsSuccess.length)]

                const jsonSuccess = [{
                "type": 10,
                "content": `# Has escapado con exito`
            },
            {
                "type": 10,
                "content": "-# **El enemigo no pudo alcanzarte...**\nAl parecer tienes una buena velocidad (¿O quizás suerte?)\n-# " + `${explorarModulo2.barrasDeEnergia(soul.energy, configServer.maxEnergy)}`
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": gifSuccessSelect
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            },
                        {
                            "type": 14,
                            "divider": true,
                            "spacing": 2
                        },
                        {
                            "type": 1,
                            "components": [
                                {
                                    "type": 3,
                                    "custom_id": `selectExplorar-${interaction.user.id}`,
                                    "options": [
                                        {
                                            "label": `Seguir explorando [ ⚡${subzona.energiaNecesaria} ]`,
                                            "value": `continue*${subzonaSelect.ID}`,
                                            "description": `Continuaras explorando en ${subzonaSelect.nombre}`,
                                            "emoji": {
                                                name: "CirnoFumoWalking1",
                                                id: "1350682005691699220"
                                            },
                                            "default": false
                                        },
                                        {
                                            "label": `Dejar de explorar`,
                                            "value": `surrend*${subzonaSelect.ID}`,
                                            "description": `Siempre es bueno saber hasta donde soltar las cosas`,
                                            "emoji": {
                                                name: "TuxedoSamTired",
                                                id: "1350682023370555454"
                                            }
                                        }
                                    ],
                                    "placeholder": "",
                                    "min_values": 1,
                                    "max_values": 1,
                                    "disabled": false
                                }
                            ]
                        }
                ]

                const isSuccessComponents = await generateMessage(soul, subzonaSelect[0], jsonSuccess, true)

                await message.edit({components: isSuccessComponents, flags: ["IsComponentsV2"]})
            }else {
                const gifsFailed = [
                    "https://c.tenor.com/tpSxlupzrQkAAAAd/tenor.gif",
                    "https://c.tenor.com/AGVSBDlf7l4AAAAd/tenor.gif",
                    "https://c.tenor.com/MAgW4Cy4qcQAAAAd/tenor.gif",
                    "https://c.tenor.com/ruosy_4AkbAAAAAd/tenor.gif",
                    "https://c.tenor.com/-1r_Sf5Swc8AAAAd/tenor.gif"
                ]

                const messages = {
                "debil": 
                [
                    {title: "No has podido escapar...", description: "*El enemigo interceptó tu huida antes de que pudieras tomar impulso.*\n **Iniciando el duelo...**", value: 1},
                    {title: "Fallaste en el intento de huida.", description: "Algo —¿el destino, quizá?— te ha atado al campo de batalla.\n **Iniciando el duelo...**", value: 1},
                    {title: "Lo intentaste... pero fue en vano.", description: "El suelo tiembla con cada paso de tu adversario que se acerca.\n **El duelo comenzara pronto...**", value: 1},
                    {title: "Te faltó velocidad, o quizá valentía...", description: "De cualquier forma, el duelo comenzará.\n **El duelo comenzara pronto...**", value: 1},
                    {title: "Un mal cálculo te ha costado la salida.", description: "No hay vuelta atrás, **¡prepárate!**.\n **El duelo comenzara pronto...**", value: 1},
                    {title: "¿Huir? Buena idea", description: "Lástima que no salió bien.\n **El duelo comenzara pronto...**", value: 1},
                ]
            }

            const lMensajes = messages["debil"]
            const IndAlt = lMensajes[Math.floor(Math.random() * lMensajes.length)]
            const gifSelect = gifsFailed[Math.floor(Math.random() * gifsFailed.length)]


                const JSONFailed = [{
                "type": 10,
                "content": `# ${IndAlt.title}`
            },
            {
                "type": 10,
                "content": `${IndAlt.description}`
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": gifSelect
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            },
            ]


                const character = await characters.findOne({_id: interaction.user.id})

                const messagesFailed = await generateMessage(soul, subzonaSelect[0], JSONFailed, true)

                message.edit({components: messagesFailed, flags: ["IsComponentsV2"]})

                const data = {
                    messageTitle: IndAlt.title,
                    messageFailed: IndAlt.description,
                    messageGif: gifSelect,
                    MdAuthor: MdAuthor,

                }

                await sleep(3000)
                explorarModulo2.startBattle(client, interaction, character, soul, enemy, data, cache?.explorarID, true)
            }



        }

        if(action === "acceptDuel") {

            const jsonAccept = [{
                "type": 10,
                "content": `# Has aceptado el duelo`
            },
            {
                "type": 10,
                "content": `-# Preparando el duelo...`
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": "https://c.tenor.com/4_zEp4wugDoAAAAC/tenor.gif"
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            },
            ]

            const character = await characters.findOne({_id: interaction.user.id})

            if(!character || !soul) {
                console.log("Personaje no encontrado [explorarSelect.js]")
                return interaction.reply({content: "No se ha podido obtener tu personaje. Quizás se trate de un error\n Contacta a soporta con una captura de este mensaje... 〒▽〒", ephemeral: true})
            }

            const messageDuel = await generateMessage(soul, subzonaSelect[0], jsonAccept, true)

            await message.edit({components: messageDuel, flags: ["IsComponentsV2"]})

             const data = {
                    messageGif: "https://c.tenor.com/4_zEp4wugDoAAAAC/tenor.gif",
                    MdAuthor: MdAuthor,
            }

            explorarModulo2.startBattle(client, interaction, character, soul, enemy, data, cache?.explorarID)
        }
    },

    barrasDeEnergia: function(currentEnergy, maxEnergy) {
        const porcentaje = (currentEnergy / maxEnergy) * 100
        const maxbar = 5;

        let filledBars  = Math.round(((currentEnergy > maxEnergy ? maxEnergy : currentEnergy) / maxEnergy) * maxbar)
        const emptyBars = maxbar - filledBars;

        let energyBars = "⚡".repeat(filledBars)
        let energyEmpty = ".".repeat(emptyBars)

        return "`"+ `[${energyBars}${energyEmpty}]` + "`" + ` **(${currentEnergy}/${maxEnergy})**`

    },

    startBattle: async function(client, interaction, character, soul, enemy, data, cacheId, isFailed = false) {
        const { calcularAmenaza, generateMessage } = require("../../selectMenus/Rol/ExplorarOptions")
            const channelDuel = await client.channels.fetch("1345239393786527784")
            const exploracionCache = transaccionCache.get(cacheId)

            exploracionCache.enemy = enemy
            exploracionCache.MdAuthor = data.MdAuthor
            exploracionCache.interaction = interaction

            let message;

            try {
                message = await interaction.channel.messages.fetch(`${exploracionCache.message.id}`)            } catch (error) {
                return interaction.followUp({content: "Error al iniciar el duelo [Mensaje no encontrado]", ephemeral: true})
            }

            try {

                const messages = isFailed ? `${data.messageFailed}\n\n-# El duelo ha comenzado, ${interaction.user} revisa tus mensajes privados` :
                `-# El duelo ha comenzado, ${interaction.user} revisa tus mensajes privados`
                const playerSoul = {
                    ...character,
                    ...soul,
                }

                const dataCharacter = {
                    Player: playerSoul,
                    Rival: enemy,
                    channel: channelDuel,
                    Mdauthor: data.MdAuthor,
                    MdRival: null,
                }
    
                await sleep(2000)
                await duelSystem.createDuel(client, true, "exploration", dataCharacter)

                const jsonDuelEdited = [{
                "type": 10,
                "content": `# ${data?.messageTitle ? data.messageTitle : "Has aceptado el duelo"}`
            },
            {
                "type": 10,
                "content": `${messages}`
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 1
            },
            {
                "type": 12,
                "items": [
                    {
                        "media": {
                            "url": data.messageGif
                        },
                        "description": null,
                        "spoiler": false
                    }
                ]
            },
            ]



            const messageEdit = await generateMessage(soul, exploracionCache.actualName, jsonDuelEdited, true)

            await message.edit({components: messageEdit})

                duelEmitter.once(`duelEnded-${character.ID}`, async (dataDuel) => {

                    return;
                    const uuidCache = transaccionCache.getUser(interaction.user.id)

                    const explorationCache = transaccionCache.get(uuidCache?.explorarID)

                    console.log("UserInteract", interaction.user.id)
                    console.log(uuidCache)
                    console.log(explorationCache)

                    if(!explorationCache?.enemy) {
                            return interaction.channel.send({content: "`Ha ocurrido un error al acabar esta batalla, vuelve a usar el comando de exploración`\n-# Seguro tardaste mucho en terminar esta batalla que no quedó ningun testigo ＞﹏＜ "})     
                    }

                    

                    if(dataDuel.isAFK || dataDuel.winnerId.ID !== character.ID) {
                        resumeExploration(explorationCache, null, false, uuidCache)
                    }else if(dataDuel.winnerId.ID === character.ID) {
                        const rewards = await getRewards(explorationCache.enemy, interaction.user.id)    
                        resumeExploration(explorationCache, rewards, true, uuidCache)
                    }
                })

            } catch (error) {

                if(error.code === 50007) {
                    interaction.channel.send({content: `Los duelos solo se pueden iniciar si tienes Mds Abiertos.\n-# El bot no pudo enviarte el mensaje (Se restauro la energia gastada: ${areaSelectEnergy} )`})
                }else {
                    interaction.reply({content: "Ocurrio un error al intentar iniciar el duelo...", flags: ["Ephemeral"]})
                }

                transaccionCache.delete(cacheId)
                transaccionCache.deleteUser(interaction.user.id)

                console.log(error)
            }


    },

    getEscapeP: function(base, agilidad, inteligencia) {
        const A = agilidad   / 20;   // agilidad 0–20 → 0.0–1.0
        const I = inteligencia    / 20;   // sabiduría 0–20 → 0.0–1.0
        const E = base / 100;  // base enemigo 0–100 → 0.0–1.0
      
        // pesos (suman 1.0)
        const weightA = 0.3;   // agilidad aporta 30% del total
        const weightI = 0.1;   // sabiduría aporta 10%
        const weightE = 0.6;   // la dificultad enemiga resta hasta 60%

        let p = (A * weightA) + (I * weightI) + ((1 - E) * weightE);
 
        return {value: p, porcentaje: Math.round(Math.max(0, Math.min(1, p)) * 100) }     
    }
}

module.exports = explorarModulo2