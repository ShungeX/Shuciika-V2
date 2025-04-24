const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const npcs = db2.collection("NPCs")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const getXp = require("../../../functions/getXP")
const { duelSystem, duelEmitter } = require("../../../functions/duelManager")
const util = require(`util`);
const updateInventario = require("../../../functions/updateInventario")
const sleep = util.promisify(setTimeout)

module.exports = {
    customId: "exOp",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, messageId, enemyId1, enemyId2, actions, areaSelect) => {


        const cache = transaccionCache.get(messageId)

        if(!cache) return interaction.reply({content: "No puedes interactuar con esta opcion porque ya ha caducado ＞﹏＜", ephemeral: true})

        const enemy = await npcs.findOne({_id: `${enemyId1}-${enemyId2}`})
        const channelDuel = client.channels.cache.get("1345239393786527784")
        const MdAuthor = await interaction.user.createDM()
        const message = await interaction.channel.messages.cache.get(`${cache.message.id}`)
        const region = cache.areas[areaSelect]
        const soul = await souls.findOne({_id: interaction.user.id})
        let embedDuel;
        let levelUp;

        if(!MdAuthor) return interaction.reply({content: "No puedes iniciar un duelo si tienes los **mensajes directos** desactivados.\n-# Intenta activar 'Mensajes directos de otros' o pide ayuda en el foro <#1064054917662265404>", ephemeral: true})
        if(!message) return interaction.reply({content: "Esta interaccion ya no es valida o el mensaje ya no existe. Vuelve a usar el comando... ＞﹏＜", ephemeral: true})

        if(actions === "runAway") {
            const probabilidad = enemy.restrictions.probabilidadEscape || 1;
            const isSuccess = Math.random() < probabilidad;
            const gifs = [
                "https://c.tenor.com/MMA6_WvqS60AAAAd/tenor.gif",
                "https://c.tenor.com/am4tzoTsnRoAAAAd/tenor.gif",
                "https://c.tenor.com/mUIXigPWPuYAAAAd/tenor.gif",
                "https://c.tenor.com/XbfdY2Lx-zwAAAAd/tenor.gif",
                "https://c.tenor.com/vR_UG67oFQgAAAAd/tenor.gif",
                "https://c.tenor.com/DkH7lr8ysZcAAAAd/tenor.gif",
            ]
            const gifrunSelect = gifs[Math.floor(Math.random() * gifs.length)]

            let embed = new EmbedBuilder()
            .setTitle("Estas intentando escapar...")
            .setDescription("Corres con todas tus fuerzas para intentar huir")
            .setColor("Purple")
            .setImage(gifrunSelect)
            
            message.edit({embeds: [embed], components: []})

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

                embed
                .setTitle("Has escapado con exito")
                .setDescription("**El enemigo no pudo alcanzarte...**\nAl parecer tienes una buena velocidad (¿O quizás suerte?)\n-# " + `${getEnergy(soul.energy, (soul?.maxEnergy || 60))}`)
                .setColor("Green")
                .setTimestamp()
                .setImage(gifSuccessSelect);

                 let components = new StringSelectMenuBuilder()
                                    .setCustomId(`selectRegion-${interaction.user.id}-${messageId}`)
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
                message.edit({embeds: [embed], components: [components]})
            }else {
                const gifsFailed = [
                    "https://c.tenor.com/tpSxlupzrQkAAAAd/tenor.gif",
                    "https://c.tenor.com/AGVSBDlf7l4AAAAd/tenor.gif",
                    "https://c.tenor.com/MAgW4Cy4qcQAAAAd/tenor.gif",
                    "https://c.tenor.com/ruosy_4AkbAAAAAd/tenor.gif",
                    "https://c.tenor.com/-1r_Sf5Swc8AAAAd/tenor.gif"
                ]

                const gifSelect = gifsFailed[Math.floor(Math.random() * gifsFailed.length)]
                embedDuel = new EmbedBuilder()
                .setTitle("No has podido escapar...")
                .setDescription("Lo intentaste, pero el enemigo fue más rapido o quizás tu fuiste muy lento\n\n **El duelo comenzara pronto...**")
                .setColor("Red")
                .setImage(gifSelect)
                .setTimestamp()

                const character = await characters.findOne({_id: interaction.user.id})
                const soul = await souls.findOne({_id: interaction.user.id})

                message.edit({embeds: [embedDuel]})

                await sleep(4000)
                startBattle(character, soul, true)
            }



        }else if(actions === "acceptDuel") {
            if(!enemy) {
                console.log("Enemigo no encontrado [explorarSelect.js]")
                return interaction.reply({content: "Hubo un error al cargar el duelo. [Enemigo no encontrado]\n-# Intenta cancelar el encuentro o contacta a soporte con una captura de este mensaje... 〒▽〒", ephemeral: true})
            }

            const character = await characters.findOne({_id: interaction.user.id})
            const soul = await souls.findOne({_id: interaction.user.id})

            if(!character || !soul) {
                console.log("Personaje no encontrado [explorarSelect.js]")
                return interaction.reply({content: "No se ha podido obtener tu personaje. Quizás se trate de un error\n Contacta a soporta con una captura de este mensaje... 〒▽〒", ephemeral: true})
            }

            embedDuel = new EmbedBuilder()
            .setTitle("Has aceptado el duelo")
            .setDescription(`Preparando el duelo...`)
            .setImage("https://c.tenor.com/4_zEp4wugDoAAAAC/tenor.giff")
            .setColor("Random")

            await message.edit({embeds: [embedDuel], components: []})

            startBattle(character, soul)

        }else {
            console.log("Interaccion no encontrada. [explorarSelect.js]")
            return interaction.reply({content: "No se ha encontrado la interacción correspondiente. Contacta a soporte con una captura de este mensaje... 〒▽〒", ephemeral: true})
        }


        async function startBattle(character, soul, isFailed = false) {
            const explorationState = {
                enemy: enemy,
                areaSelect: areaSelect,
                MdAuthor,
                ...cache
            }



            try {

                const messages = isFailed ? `Lo intentaste, pero el enemigo fue más rapido o quizás tu fuiste muy lento\n\n-# El duelo ha comenzado, ${interaction.user} revisa tus mensajes privados` :
                `-# El duelo ha comenzado, ${interaction.user} revisa tus mensajes privados`
    
                transaccionCache.delete(messageId)
                transaccionCache.deleteUser(interaction.user.id)

                const transacciónId = uuidv4().replace(/-/g, "")
                transaccionCache.set(transacciónId, explorationState)
                transaccionCache.setUser(interaction.user.id, transacciónId)


    
                await sleep(2000)
                await duelSystem.createDuel(client, character, soul, enemy, null, channelDuel, MdAuthor, null, true)
                embedDuel.setDescription(messages)
                await message.edit({content: `${interaction.user}`, embeds: [embedDuel]})

                duelEmitter.once(`duelEnded-${character.ID}`, async (dataDuel) => {
                    const uuidCache = transaccionCache.getUser(interaction.user.id)

                    const explorationCache = transaccionCache.get(uuidCache)

                    if(!explorationCache) return interaction.reply({content: "`Ha ocurrido un error al acabar esta batalla, vuelve a usar el comando de exploración`\n-# Seguro tardaste mucho en terminar esta batalla que no quedó ningun testigo ＞﹏＜ ", ephemeral: true})

                    

                    if(dataDuel.isAFK || dataDuel.winnerId.ID !== character.ID) {
                        resumeExploration(explorationCache, null, false, uuidCache)
                    }else if(dataDuel.winnerId.ID === character.ID) {
                        const rewards = await getRewards(explorationCache.enemy, interaction.user.id)    
                        resumeExploration(explorationCache, rewards, true, uuidCache)
                    }
                })

            } catch (error) {

                if(error.code === 50007) {
                    const areaSelectEnergy = explorationState.areas[explorationState.areaSelect].energiaNecesaria
                    await souls.updateOne({_id: interaction.user.id},
                        {
                            $inc: {
                                energy: areaSelectEnergy
                            }
                        }
                    )

                    interaction.channel.send({content: `Los duelos solo se pueden iniciar si tienes Mds Abiertos.\n-# El bot no pudo enviarte el mensaje (Se restauro la energia gastada: ${areaSelectEnergy} )`})
                }else {
                    message.edit({content: "Ocurrio un error al intentar iniciar el duelo..."})
                }

                transaccionCache.delete(messageId)
                transaccionCache.deleteUser(interaction.user.id)

                console.log(error)
            }


        }

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
    
            let filledBars  = Math.round((currentEnergy / maxEnergy) * maxbar)
            const emptyBars = maxbar - filledBars;
    
            let energyBars = "⚡".repeat(filledBars)
            let energyEmpty = ".".repeat(emptyBars)
    
            return "`"+ `[${energyBars}${energyEmpty}]` + "`" + ` **(${currentEnergy}/${maxEnergy})**`
    
        }

        
    }
}