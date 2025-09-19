const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder, SelectMenuBuilder, StringSelectMenuOptionBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const NPCs = db2.collection("NPCs")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const configServer = require("../../../config")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const { duelSystem } = require("../../../functions/duelManager")
const util = require(`util`);
const getGifs = require("../../../functions/getGifs")
const updateInventario = require("../../../functions/updateInventario")
const explorarModulo2 = require("../../buttons/Rol/explorarSelect")
const sleep = util.promisify(setTimeout)
const regiones = db2.collection("Regiones")


const explorarModulo = {
    customId: "selectExplorar",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async function(client, interaction, character, cacheId, nan2, nan3, valueOptions)  {
        const [interact, areaSelect] = valueOptions.split("*")
        const userCache = transaccionCache.getUser(interaction.user.id)
        const exploracionCache = transaccionCache.get(userCache?.explorarID)

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
                subzona: `$areas.${exploracionCache.zona}.subzonas.${areaSelect}` 
              }
            },
            {
              $replaceRoot: {
                newRoot: "$subzona"
              }
            }
          ]).toArray();

        subzonaSelect = subzonaSelect[0]

        exploracionCache.subzona = areaSelect

        const soul = await souls.findOne({_id: interaction.user.id})

        var levelMessage;      
        
        const message = await interaction.channel.messages.fetch(exploracionCache.message.id)
        
        if(interact === "surrend") {


            const messages = ["La sabiduría no está solo en buscar, sino en saber cuándo descansar.", "Usa `/rol explorar` cuando estés listo para otra aventura", "El aire vibra con un susurro ancestral...\n Has decidido regresar"]
            const messageSelect = messages[Math.floor(Math.random() * messages.length)]
            const gifSelect = await getGifs("sleep") 

            const sleepMessage = [          
                        {
                            "type": 10,
                            "content": "# Has decidido descansar..."
                        },
                        {
                            "type": 10,
                            "content": `${messageSelect}`
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
                                        "url": gifSelect.url
                                    },
                                    "description": null,
                                    "spoiler": false
                                }
                            ]
                        },
                        {
                            "type": 10,
                            "content": `-# Anime: ${gifSelect.anime_name}`
                        }
                    ]
            

            const messageFinish = await this.generateMessage(soul, subzonaSelect, sleepMessage, true)

            transaccionCache.delete(cacheId)
            transaccionCache.deleteUser(interaction.user.id)

            return message.edit({components: messageFinish, flags: ["IsComponentsV2"]})
        }

        
        if(interact === "cambiarZona") {
           return explorarModulo2.zonaMessage(client, interaction, exploracionCache.zona, soul)
        }


        try {
            if(soul.energy < subzonaSelect.energiaNecesaria) {
                return interaction.reply({content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energia antes de explorar esta área", ephemeral: true})
            }

            const eventSelect = await selectEvent(subzonaSelect.eventos)

            const components = []

            const gifsWalking = [
                "https://c.tenor.com/2CjD23b-uaoAAAAd/tenor.gif",
                "https://c.tenor.com/_T647uuuA-IAAAAd/tenor.gif",
                "https://c.tenor.com/-w46p_udURUAAAAd/tenor.gif",
                "https://c.tenor.com/5lskg5Utj1QAAAAd/tenor.gif",
                "https://c.tenor.com/kXniRU4h1AMAAAAd/tenor.gif",
                "https://c.tenor.com/mPCZyTJgrkAAAAAd/tenor.gif",
                "https://c.tenor.com/Bvm6RAQnf2wAAAAd/tenor.gif"
            ]

            const gifSelect = gifsWalking[Math.floor(Math.random() * gifsWalking.length)]
            const messageIntermedio = interact === "continue" ? 
            `Vuelves a tomar tus cosas y sigues explorando en **${subzonaSelect.nombre}...**` : 
            `Tomas tus cosas y te preparas para explorar **${subzonaSelect.nombre}**\n ¿Que cosas encontraras hoy?`


            const messIntermedio = [
            {
                "type": 10,
                "content": messageIntermedio
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
            }
            ]

            soul.energy -= subzonaSelect.energiaNecesaria

            let eventMessage = await this.generateMessage(soul, subzonaSelect, messIntermedio, true)

            interaction.deferUpdate()
            message.edit({components: eventMessage, flags: ["IsComponentsV2"]})

            switch(eventSelect.tipo) {
                case "battle": 
                    const enemy = await selectEnemy(subzonaSelect.enemigos)
                    const itemfilter = enemy.loot.filter(item => item.typeLoot === "item")
                    const itemscoins = enemy.loot.find(item => item.typeLoot === "lumens")
                    const itemsxp = enemy.loot.find(item => item.typeLoot === "xp")
                    const items = await getObjInfo(itemfilter)
                    const messageRewards = []
                    const enemyDefeat = soul?.npcDefeated?.[enemy._id]
                    const mostrarHp = enemyDefeat ? `*${enemy.stats.hpMax}*` : "*Desconocido*"

                    const amenazaLevel = this.calcularAmenaza(soul, enemy)

                    if(itemscoins) {
                           messageRewards.push(`-# <a:Lumens:1335709991130103910> **Lumens** *(${itemscoins.quantity})* - **${(itemscoins.dropRate * 100)}%**`)
                    }

                    if(itemsxp) {
                        messageRewards.push(`-# <:XP:1350575069113352265> **XP** *(${itemsxp.quantity})* - **${(itemsxp.dropRate * 100)}%**`)
                    }


                    items.forEach((item, index) => {
                     messageRewards.push("-# `" + `[${item.ID}]` + "`" + ` **${item.Nombre}** - **${(item.dropRate * 100)}%**`)
                    })

                    console.log(enemyDefeat)

                    components.push(
                    {

                        "type": 9,
                        "accessory": {
                            "type": 11,
                            "media": {
                                "url": enemy.avatarURL
                            },
                            "description": null,
                            "spoiler": false
                        },
                        "components": [
                            {
                                "type": 10,
                                "content": "**Los hilos del destino se tensan… ¡una batalla se aproxima!**\n\n" + "**Enemigo:** " +  `${enemy.Nombre}` + `\n- **Salud:** ${mostrarHp}\n- **Aura de amenaza:** ${amenazaLevel.nombre} *(LV: ${enemy.nivelMagico})*\n-# *${enemy.Descripcion}*\n** ** `
                            }
                        ]
                    },
                    {
                        "type": 10,
                        "content": "`[🎁]` ***Recompensas posibles:***" + `\n${messageRewards.join("\n")}`
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
                                "type": 2,
                                "style": 2,
                                "label": "Combatir",
                                "emoji": {
                                    "name": "KrisJojos",
                                    "id": "1350664814414004395"
                                },
                                "disabled": false,
                                "custom_id": `exOp-${interaction.user.id}-battle-[${enemy._id}]-acceptDuel`
                            },
                            {
                                "type": 2,
                                "style": 2,
                                "label": `Huir (${explorarModulo2.getEscapeP(enemy.restrictions?.probabilidadEscape || 100, soul.stats.agilidad, soul.stats.inteligencia).porcentaje} %)`,
                                "emoji": {
                                    "name": "EeveeRun",
                                    "id": "1350663840349687941"
                                },
                                "disabled": (!enemy.restrictions.Run || false),
                                "custom_id": `exOp-${interaction.user.id}-battle-[${enemy._id}]-runAway`
                            }
                        ]
                    })

                    eventMessage = await this.generateMessage(soul, subzonaSelect, components, true)

                    break;             
                case "loot":
                    const recompensas = await getRewardsLoot(subzonaSelect.loot, interaction.user.id)
                    const gifs = await getGifs("happy")
                    const TitleMessages = [
                        "Botín descubierto...",
                        "Tesoros hallados en la penumbra...",
                        "Resultados de tu búsqueda...",
                        "Un hallazgo inesperado...",
                        "Recompensas del destino..."

                    ]
                    const descripciones = [
                        "Bajo el eco del silencio, algo reluce entre las sombras...",
                        "Entre telarañas y fragmentos olvidados, recoges lo que el mundo dejó atrás.",
                        "Tu búsqueda ha dado frutos... aunque algunos sean más brillantes que útiles.",
                        "El destino ha decidido recompensarte... o probar tu suerte."
                    ]


                    const lootJSON = [
                        {
                            "type": 10,
                            "content": `# ${this.getRandomMessage(TitleMessages).message} \n\n-# ${this.getRandomMessage(descripciones).message}\n${levelMessage?.message ? levelMessage.message : ""}`
                        },
                        {
                            "type": 10,
                            "content": "`[📦]` **Has conseguido: **\n" + `\n- -# ${recompensas}` 
                        },
                        {
                            "type": 12,
                            "items": [
                                {
                                    "media": {
                                        "url": gifs.url
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
                                            "label": `Seguir explorando [ ⚡${subzonaSelect.energiaNecesaria} ]`,
                                            "value": `continue*${areaSelect}`,
                                            "description": `Continuaras explorando en ${subzonaSelect.Nombre}`,
                                            "emoji": {
                                                name: "CirnoFumoWalking1",
                                                id: "1350682005691699220"
                                            },
                                            "default": false
                                        },
                                        {
                                            "label": "Elegir otra zona...",
                                            "value": `cambiarZona*${areaSelect}`,
                                            "description": "Cambia entre zonas",
                                            "emoji": null,
                                            "default": false,
                                            "disabled": true
                                        },
                                        {
                                            "label": `Dejar de explorar`,
                                            "value": `surrend*${areaSelect}`,
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

                    eventMessage = await this.generateMessage(soul, subzonaSelect, lootJSON, true)


                    
                    break;
                case "minigame":
                    eventMessage = "Evento de minijuego"
                    break;
                case "nothing": 
                const gifsNothing = [
                    "https://c.tenor.com/urs-gwqkOV8AAAAd/tenor.gif",
                    "https://c.tenor.com/6HLLZUWbBlEAAAAd/tenor.gif",
                    "https://c.tenor.com/hp-sK7KtgSUAAAAd/tenor.gif",
                    "https://c.tenor.com/os0XDwxqPqMAAAAd/tenor.gif",
                    "https://c.tenor.com/tyQ9H4slRDkAAAAd/tenor.gif",
                    "https://c.tenor.com/TtO7jwYA6VAAAAAd/tenor.gif",
                    "https://c.tenor.com/KmMC1WRWlhkAAAAd/tenor.gif",
                    "https://c.tenor.com/hLL_m_1_J3YAAAAd/tenor.gif",
                    "https://c.tenor.com/ccmEtEXYCH0AAAAd/tenor.gif"
                ]

                const titleNothing = [
                    "Las sombras ocultaron todo...",
                    "Silencio absoluto",
                    "Te estafaron~",
                    "Nada por aquí~",
                    "La trampa del eterno retorno",
                ]

                const desNothing = [
                    "Tus pasos resonaban sin respuesta en la oscuridad... y nada te esperaba al final del camino.",
                    "Buscaste entre ruinas y polvo... pero el destino fue cruel esta vez.",
                    "Exploraste durante horas... ¡y ni un misero lumen encontraste!",
                    "Tal vez el verdadero tesoro eran los puntos de energía que perdimos en el camino.",
                    "Exploraste una tierra muerta. Nada crece. Nada brilla. Nada queda.",
                    "Cada pasillo parecía igual al anterior. Cada rincón, una copia del anterior. Al final... nada."
                ]
                const extraNothing = [
                    "Ninguna. Solo confusión y fatiga.",
                    "Solo un poco menos de energía... y un poco más de desesperanza.",
                    "No todos los días se gana, ¡ánimo!",
                    "Solo cansancio y decepción.",
                    "La suerte decidió ignorarte.",
                    "Solo el eco de tus esperanzas."
                ]

                const nothingJSON = [
                    {
                        "type": 10,
                        "content": `# ${this.getRandomMessage(titleNothing).message} \n\n-# ${this.getRandomMessage(desNothing).message}`
                    },
                    {
                        "type": 10,
                        "content": "`[📦]` **Has conseguido: **\n\n" + `\n-# ${this.getRandomMessage(extraNothing).message}` 
                    },
                    {
                        "type": 12,
                        "items": [
                            {
                                "media": {
                                    "url": this.getRandomMessage(gifsNothing).message
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
                                        "label": `Seguir explorando [ ⚡${subzonaSelect.energiaNecesaria} ]`,
                                        "value": `continue*${areaSelect}`,
                                        "description": `Continuaras explorando en ${subzonaSelect.nombre}`,
                                        "emoji": {
                                            name: "CirnoFumoWalking1",
                                            id: "1350682005691699220"
                                        },
                                        "default": false
                                    },
                                    {
                                            "label": "Elegir otra zona...",
                                            "value": `cambiarZona*${areaSelect}`,
                                            "description": "Cambia entre zonas",
                                            "emoji": null,
                                            "default": false,
                                            "disabled": true
                                    },
                                    {
                                        "label": `Dejar de explorar`,
                                        "value": `surrend*${areaSelect}`,
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

                eventMessage = await this.generateMessage(soul, subzonaSelect, nothingJSON, true)

                    break;
            }

            console.log("Evento seleccionado:", eventSelect.tipo)

            await sleep(6000)
            message.edit({components: eventMessage, flags: ["IsComponentsV2"]})

            await souls.updateOne({_id: interaction.user.id}, {
                $inc: {
                    "energy": -subzonaSelect.energiaNecesaria
                }
            })


        } catch (error) {
            console.log(error)
        }


        async function selectEvent(eventos) {
            const total = eventos.reduce((sum, eventos) => sum + eventos.probabilidad, 0)

            let random  = Math.random() * total

            for(const evento of eventos) {
                if(random < evento.probabilidad) {
                    return evento
                }

                random -= evento.probabilidad
            }


        }

        async function getRewardsLoot(loot, characterId) {
            const recompensas = []

            for(const recompensa of loot) {
                const isItem = recompensa.tipo === "item"



                if(recompensa.probabilidad >= 1) {
                    const cantidad = getRandomCantidad(recompensa.cantidad)
                    let obj = {
                        ...recompensa,
                        cantidad: cantidad,

                    }

                    if(isItem) {
                        const objInfo = await duelSystem.getObjetInfo(recompensa.ID[0], recompensa.ID[1])

                        obj = {
                            ...recompensa,
                            Nombre: objInfo.Nombre,
                            ID: objInfo.ID,
                            cantidad: cantidad
                        }
                    }

                    let objData = {
                        ID: recompensa?.ID?.[1],
                        Region: recompensa?.ID?.[0],
                        cantidad: cantidad,
                        isItem: isItem,
                        typeLoot: recompensa.tipo
                    }

                    const isLevel = await updateInventario(client, interaction, characterId, objData)
                    if(isLevel?.message) {
                        levelMessage = isLevel
                    }
                    recompensas.push(obj)
                }else {
                    if(Math.random() < recompensa.probabilidad) {
                        const cantidad = getRandomCantidad(recompensa.cantidad)
                        let obj = {
                            ...recompensa,
                            cantidad: cantidad,
    
                        }

                        if(isItem) {
                            const objInfo = await duelSystem.getObjetInfo(recompensa.ID[0], recompensa.ID[1])
                            obj = {
                                ...recompensa,
                                Nombre: objInfo.Nombre,
                                ID: objInfo.ID,
                                cantidad: cantidad
                            }

                        }

                        
                       let objData = {
                        ID: recompensa?.ID?.[1],
                        Region: recompensa?.ID?.[0],
                        cantidad: cantidad,
                        isItem: isItem,
                        typeLoot: recompensa.tipo
                        }

                        const isLevel = await updateInventario(client, interaction, characterId, objData)
                        if(isLevel?.message) {
                            levelMessage = isLevel
                        }

                        recompensas.push(obj)

                    }
                }               
            }

        


            return recompensas.map(reward => {
                switch(reward.tipo) {
                    case "item" : 
                        return `${reward.cantidad} **${reward.Nombre}**`
                    case "xp": 
                        return `<:XP:1350575069113352265> **XP: ** ${reward.cantidad}`
                    case "lumens":
                        return `<a:Lumens:1335709991130103910> **Lumens:** ${reward.cantidad} `
                    default: 
                    return `${reward.cantidad} **${reward.Nombre}**`
                    
                }
            }).join("\n- -# ")


        }
        

        async function selectEnemy(enemies) {
            const enemy = enemies[Math.floor(Math.random() * enemies.length)]

            const npcfind = await NPCs.findOne({_id: `${enemy}`})

            if(!npcfind) return false

            return npcfind
        }

        async function getObjInfo(items) {
            const itemsArray = []

            for(const item of items) {
                
                const [region, id] = item.itemId
                const itemfullinfo = await duelSystem.getObjetInfo(region, id)

                if(itemfullinfo) {
                    const objeto = {
                        ...itemfullinfo,
                        dropRate: item.dropRate
                    }

                    itemsArray.push(objeto)
                }


            }

            return itemsArray
        }

        function getRandomCantidad(cantidad) {
            const [min, max] = cantidad.split('-').map(Number)

            return Math.floor(Math.random() * ((max || 1) - min + 1)) + min;
        }
    },

    calcularAmenaza: function(character, enemy) {
        const nombres = [
            "[] Brisa Nocturna",
            "[] Latido Tenso",
            "[] Presencia Devastadora",
            "[] Eclipse Inminente",
            "[] Quiebre Celestial"
        ]

        const rango = [
            "debil",
            "medio",
            "hard",
            "very hard",
            "imposible"
        ]

        const porcentaje = (character.HP * 100) / character.stats.hpMax

        const diferencia = enemy.nivelMagico- character.nivelMagico 
        const rangoExtra = enemy.isBoss ? 3 : enemy.Type === "elite" ? 2 : 0
        const rangoHP = porcentaje >= 50 ? 0 : porcentaje >= 25 ? 1 : porcentaje >= 10 ? 2 : 4
        
        const totalDiferencia = diferencia + (rangoExtra + rangoHP)

        if(totalDiferencia <= -1) return {nombre: nombres[0], rangoEstandar: rango[0]}
        if(totalDiferencia <= 1) return  {nombre: nombres[1], rangoEstandar: rango[1]}
        if(totalDiferencia <= 4) return {nombre: nombres[2], rangoEstandar: rango[2]}
        if(totalDiferencia <= 10) return {nombre: nombres[4], rangoEstandar: rango[4]}
        return {nombre: nombres[4], rangoEstandar: rango[4]}
        
    },


    getRandomMessage: function(array, isProbability = [false, 0]) {
        let message; 
        if(isProbability[0] && Math.random() < isProbability[1]) {
           return {message: array[Math.floor(Math.random() * array.length)], isSecret: true}    
        }

        message = array[Math.floor(Math.random() * array.length)]

        return {message: message, isSecret: false};
    },

    generateMessage: async function(soul, zona, data, showInfo, reset = false, onlyTop = false) {
        const components = []
        const ch = await character.findOne({_id: soul._id})

        if(!data) return []

        if(showInfo) components.push(
            {
                "type": 9,
                "accessory": {
                    "type": 11,
                    "media": {
                        "url": "https://cdn.discordapp.com/attachments/738874841783992351/1369868063633051668/Aya_Osawa.jpg?ex=681d6c8d&is=681c1b0d&hm=e05440b310bfc171f4a670032f5a3fe93033fed96da9c4ece7790ee4afea53b8&"
                    },
                    "description": null,
                    "spoiler": false
                },
                "components": [
                    {
                        "type": 10,
                        "content": `-# **Ubicación Actual:** ${zona?.nombre}\n\n-# **Aventurero:** *${ch.Nombre}*\n-# **HP:** ${explorarModulo.statusBarra(soul.HP, soul.stats.hpMax, 5, "❤︎ ", "♡")}` +
                        `\n-# **Mana:** ${explorarModulo.statusBarra(soul.Mana, soul.stats.manaMax, 5, "🔷")}\n-# **Energia: ${explorarModulo.statusBarra((soul.energy), configServer.maxEnergy, 5, "⚡")}** `
                    }
                ]
            },
            {
                "type": 14,
                "divider": true,
                "spacing": 2
            }
        )

        components.push(...data)

        if(onlyTop) {

        return components
        }else {
        const json = [ 
            {
                "type": 17,
                "accent_color": null,
                "spoiler": false,
                "components": components
            }
        ]

        return json
        }


    },

    statusBarra: function(minValue, maxValue, lengthBar, emoji, emojiEmpty = ".") {
        const porcentaje = (minValue / maxValue) * 100
        const maxbar = lengthBar;

        let filledBars  = Math.round(((minValue > maxValue ? maxValue : minValue) / maxValue) * maxbar)
        const emptyBars = maxbar - filledBars;

        let energyBars = `${emoji}`.repeat(filledBars)
        let energyEmpty = emojiEmpty.repeat(emptyBars)

        return "`"+ ` ${energyBars}${energyEmpty}` + "`" + ` *(${minValue}/${maxValue})*`

    }
}

module.exports = explorarModulo