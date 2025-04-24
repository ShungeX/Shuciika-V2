const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder, SelectMenuBuilder, StringSelectMenuOptionBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const NPCs = db2.collection("NPCs")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const { duelSystem } = require("../../../functions/duelManager")
const util = require(`util`);
const getGifs = require("../../../functions/getGifs")
const updateInventario = require("../../../functions/updateInventario")
const sleep = util.promisify(setTimeout)


module.exports = {
    customId: "selectRegion",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction, character, cacheId, nan2, nan3, valueOptions) => {
        const [interact, areaSelect] = valueOptions.split("*")
        const regiones = transaccionCache.get(cacheId)

        const soul = await souls.findOne({_id: interaction.user.id})
        const message = interaction.channel.messages.cache.get(regiones?.message?.id)
        var levelMessage;
        
        if(!regiones || !message) {
            return interaction.reply({content: "No puedes interactuar con esta opcion porque ya ha caducado ＞﹏＜", ephemeral: true})
        }

        if(interact === "surrend") {
            const messages = ["La sabiduría no está solo en buscar, sino en saber cuándo descansar.", "Usa `/rol explorar` cuando estés listo para otra aventura", "El aire vibra con un susurro ancestral...\n Has decidido regresar"]
            const messageSelect = messages[Math.floor(Math.random() * messages.length)]
            const gifSelect = await getGifs("sleep") 

            const embedSurrend = new EmbedBuilder()
            .setTitle("¡Bien hecho!")
            .setDescription(`${messageSelect}\n-# Energia restante: ${getEnergy(soul.energy, (soul?.maxEnergy || 60))}`)
            .setImage(gifSelect.url)
            .setFooter({text: `Anime: ${gifSelect.anime_name}`})
            .setTimestamp();

            transaccionCache.delete(cacheId)
            transaccionCache.deleteUser(interaction.user.id)

            return message.edit({embeds: [embedSurrend], components: []})
        }


        const region = regiones.areas[areaSelect]



        try {
            if(soul.energy < region.energiaNecesaria) {
                return interaction.reply({content: "Tu personaje se encuentra cansado para poder explorar esa área (¬_¬')\n-# Necesitas recuperar energia antes de explorar esta área", ephemeral: true})
            }

            const eventSelect = await selectEvent(region.eventos)

            let eventMessage;
            let Embed;
            let components;


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
            let embedExploration;

            if(interact === "continue") {
                embedExploration = new EmbedBuilder()
                .setDescription(`Vuelves a tomar tus cosas y sigues explorando en **${region.Nombre}...**`)
                .setImage(gifSelect)
                .setColor("Random")
            }else {
                embedExploration = new EmbedBuilder()
                .setDescription(`Tomas tus cosas y te preparas para explorar **${region.Nombre}**\n ¿Que cosas encontraras hoy?`)
                .setImage(gifSelect)
                .setColor("Random")
            }


            interaction.reply({content: "Has comenzado a explorar ( •̀ ω •́ )✧", ephemeral: true})
            message.edit({embeds: [embedExploration], components: []})


            switch(eventSelect.tipo) {
                case "battle": 
                    eventMessage = "Mientras explorabas, un rugido rompe el silencio"
                    const enemy = await selectEnemy(region.enemigos)
                    const itemfilter = enemy.loot.filter(item => item.typeLoot === "item")
                    const itemscoins = enemy.loot.find(item => item.typeLoot === "lumens")
                    const itemsxp = enemy.loot.find(item => item.typeLoot === "xp")
                    const items = await getObjInfo(itemfilter)
                    const messageRewards = []

                    Embed = new EmbedBuilder()
                    .setTitle("Se aproxima una batalla...")
                    .setDescription(`${enemy.Descripcion}`)
                    .addFields(
                        {name: `Enemigo`, value: `${enemy.Nombre}`, inline: true},
                        {name: `Salud`, value: "Desconocido", inline: true},
                    )
                    .setThumbnail(enemy.avatarURL)
                    .setColor("DarkPurple")

                    if(itemscoins) {
                           messageRewards.push(`<a:Lumens:1335709991130103910> **Lumens** (${itemscoins.quantity}) - Probabilidad: **${(itemscoins.dropRate * 100)}%**`)
                    }

                    if(itemsxp) {
                        messageRewards.push(`<:XP:1350575069113352265> **XP** (${itemsxp.quantity}) - Probabilidad: **${(itemsxp.dropRate * 100)}%**`)
                    }


                    items.forEach((item, index) => {
                     messageRewards.push("`" + `[${item.ID}]` + "`" + ` **${item.Nombre}** - Probabilidad: **${(item.dropRate * 100)}%**`)
                    })

                    Embed.addFields(
                        {name: "Posibles recompensas", value: messageRewards.join("\n")}
                    )

                    components = new ActionRowBuilder()

                    components.addComponents(
                        new ButtonBuilder()
                        .setCustomId(`exOp-${interaction.user.id}-${cacheId}-${enemy._id}-acceptDuel*${areaSelect}`)
                        .setLabel("Combatir")
                        .setEmoji("<a:KrisJojos:1350664814414004395>")
                        .setStyle(ButtonStyle.Secondary)
                    )
                    
                        components.addComponents(
                            new ButtonBuilder()
                            .setCustomId(`exOp-${interaction.user.id}-${cacheId}-${enemy._id}-runAway*${areaSelect}`)
                            .setLabel("Intentar huir")
                            .setEmoji("<a:EeveeRun:1350663840349687941>")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled((!enemy.restrictions.Run || false)),

                    )                 

                    break;             
                case "loot":
                    const recompensas = await getRewardsLoot(region.loot, interaction.user.id)
                    const gifs = await getGifs("happy")


                    Embed = new EmbedBuilder()
                    .setTitle("Has encontrado recompensas...")
                    .setDescription("Entre polvorientos estantes y una ardua busqueda, has encontrado cosas valiosas... ¿O quizás no?\n-# Energia restante:" + `${getEnergy((soul.energy - region.energiaNecesaria), (soul?.maxEnergy || 60))}`)
                    .addFields(
                        {name: "Has conseguido", value: `${recompensas}`}
                    )
                    .setImage(gifs.url || "https://tenor.com/es-MX/view/maomao-hearts-excited-wakuwaku-gif-994138680801832398")
                    .setTimestamp()
                    .setFooter({text: `Anime: ${gifs.anime_name}`})
                    .setColor("Random")

                    if(levelMessage) {
                        Embed.addFields({name: "Ademas...", value: `${levelMessage.message}`})
                    }


                    components = new StringSelectMenuBuilder()
                    .setCustomId(`selectRegion-${interaction.user.id}-${cacheId}`)
                    .setPlaceholder("¿Que quieres hacer? ♪(^∇^*)")
                    .setMaxValues(1)

                    components.addOptions(
                        {
                            label: `Seguir explorando [ ⚡${region.energiaNecesaria} ]`,
                            description: `Continuaras explorando en ${region.Nombre}`,
                            value: `continue*${areaSelect}`,
                            emoji: `<a:CirnoFumoWalking1:1350682005691699220>`
                        },
                        {
                            label: `Dejar de explorar`,
                            description: `Siempre es bueno saber hasta donde soltar las cosas`,
                            value: `surrend*${areaSelect}`,
                            emoji: "<:TuxedoSamTired:1350682023370555454>"
                        }
                    )    
                    
                    components = new ActionRowBuilder().addComponents(components)
                    
                    break;
                case "minigame":
                    eventMessage = "Evento de minijuego"
                    break;
                case "nothing": 
                    Embed = new EmbedBuilder()
                    .setTitle("No has obtenido nada...")
                    .setDescription("Estuviste recorriendo el corredor interminable...\nTardaste en darte cuenta que estabas en un bucle")
                    .addFields(
                        {name: "¿Recompensas?", value: "Ninguna, solo perdiste energia", inline: true}
                    )
                    .setTimestamp()
                    .setImage("https://c.tenor.com/urs-gwqkOV8AAAAd/tenor.gif")
                    .setFooter({text: "Intenta usar el comando de nuevo..."})

                    components = new StringSelectMenuBuilder()
                    .setCustomId(`selectRegion-${interaction.user.id}-${cacheId}`)
                    .setPlaceholder("¿Que quieres hacer? ♪(^∇^*)")
                    .setMaxValues(1)

                    components.addOptions(
                        {
                            label: `Seguir explorando [ ⚡${region.energiaNecesaria} ]`,
                            description: `Continuaras explorando en ${region.Nombre}`,
                            value: `continue*${areaSelect}`,
                            emoji: `<a:CirnoFumoWalking1:1350682005691699220>`
                        },
                        {
                            label: `Dejar de explorar`,
                            description: `Siempre es bueno saber hasta donde soltar las cosas`,
                            value: `surrend*${areaSelect}`,
                            emoji: "<:TuxedoSamTired:1350682023370555454>"
                        }
                    )    
                    
                    components = new ActionRowBuilder().addComponents(components)

                    break;
            }

            console.log("Evento seleccionado:", eventSelect.tipo)



            await sleep(6000)

            if(components) {
                message.edit({embeds: [Embed], components: [components]})
            }else {
                message.edit({embeds: [Embed]})
            }

            await souls.updateOne({_id: interaction.user.id}, {
                $inc: {
                    "energy": -region.energiaNecesaria
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
            }).join("\n")


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

        function getEnergy(currentEnergy, maxEnergy) {
            const porcentaje = (currentEnergy / maxEnergy) * 100
            const maxbar = 5;
    
            let filledBars  = Math.round((currentEnergy / maxEnergy) * maxbar)
            const emptyBars = maxbar - filledBars;
    
            let energyBars = "⚡".repeat(filledBars)
            let energyEmpty = ".".repeat(emptyBars)
    
            return "`"+ `[${energyBars}${energyEmpty}]` + "`" + ` **(${currentEnergy}/${maxEnergy})**`
    
        }
    }
}