const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const souls = db2.collection("Soul")
const version = require("../../../config")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')

module.exports = {
    requireCharacter: false,
    requireSoul: true,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: true,
        Character: true,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, { soul }) => {
    const areaExplorar = interaction.options.getNumber("region")
    const userCache = transaccionCache.getUser(interaction.user.id)

    if(userCache) {
        const message = transaccionCache.get(userCache)
        const getChannel = client.channels.cache.get(message.message.channelId)
        const getMessage = getChannel?.messages.cache.get(message.message.id)

        if(getMessage) {
            return interaction.reply({content: `Ya tienes una exploración activa ＞﹏＜\n-# [Haz click aqui para ir al mensaje](https://discord.com/channels/${message.message.guildId}/${message.message.channelId}/${message.message.id})`, ephemeral: true})
        }else {
            transaccionCache.delete(userCache)
            transaccionCache.deleteUser(interaction.user.id)
        }
        
    }

    if(!soul) {
        return interaction.reply({content: "Tu personaje aun es muy vulnerable para explorar... Necesita despertar su poder interior", ephemeral: true})
    }    

    const regionesData = {
        1: {
            Nombre: "Tobeya",
            areas: {
                "instituto_tobeya": {
                    Nombre: "Instituto Tobeya",
                    energiaNecesaria: 5,
                    emoji: "🏫",
                    enemigos: ["NPC-001", "NPC-002", "NPC-003", "NPC-004"],
                    loot: [
                        {tipo: "item", ID: ["TOB-01", 2], cantidad: "1-2", probabilidad: 0.3},
                        {tipo: "xp", cantidad: "5-12", probabilidad: 1},
                        {tipo: "lumens", cantidad: "5-15", probabilidad: 1},
                    ],
                    eventos: [
                        {tipo: "battle", probabilidad: 68, messages: [""]},
                        {tipo: "loot", probabilidad: 30},
                        {tipo: "minigame", probabilidad: 0},
                        {tipo: "nothing", probabilidad: 2}
                    ],
                    habilitado: true,
                },
                "bosque_encantado": {
                    Nombre: "Bosque de los murmullos",
                    energiaNecesaria: 5,
                    emoji: "🌳",
                    enemigos: ["NPC-002"],
                    loot: [
                        {tipo: "item", ID: ["TOB-01", 2], cantidad: "1-2", probabilidad: 0.3},
                        {tipo: "xp", cantidad: "7-15", probabilidad: 1},
                        {tipo: "lumens", cantidad: "7-15", probabilidad: 1},
                    ],
                    eventos: [
                        {tipo: "battle", probabilidad: 55},
                        {tipo: "loot", probabilidad: 40},
                        {tipo: "minigame", probabilidad: 0},
                        {tipo: "nothing", probabilidad: 5}
                    ],
                    habilitado: false,
                },
                "observatorio_eclipse": {
                    Nombre: "Observatorio del eclipse",
                    energiaNecesaria: 5,
                    emoji: "🌔",
                    enemigos: ["NPC-002"],
                    loot: [
                        {tipo: "item", ID: ["TOB-01", 2], cantidad: "1-2", probabilidad: 0.3},
                        {tipo: "xp", cantidad: "7-16", probabilidad: 1},
                        {tipo: "Lumenes", cantidad: "7-17", probabilidad: 1},
                    ],
                    eventos: [
                        {tipo: "battle", probabilidad: 20},
                        {tipo: "loot", probabilidad: 60,},
                        {tipo: "minigame", probabilidad: 0},
                        {tipo: "nothing", probabilidad: 10}
                    ],
                    habilitado: false,
                },


            }
        }
    }

    if(soul.HP === 0) return interaction.reply({content: "Te sientes muy debil para ir a explorar. =.=\n-# Recupera algo de **`HP`** usando `/rol usar_objeto [id]`", ephemeral: true}) 

    const region = regionesData[areaExplorar]

    if(!region) {
        return interaction.reply({content: "Al parecer ese lugar ya no aparece en el mapa...", ephemeral: true})
    }

    let energy = soul?.energy === undefined  
    
    let characterEnergy = soul.energy

    if(!energy) {
        characterEnergy = await updateEnergy(soul.energy, 60, soul)
    }


    const embed = new EmbedBuilder()
    .setTitle(`Exploracion en ${region.Nombre}`)
    .setDescription("*¿Que área vamos a explorar hoy? ( •̀ ω •́ )y*\n\n" + `Energia: ${getEnergy((!energy ? characterEnergy : 60), 60)}` + "\n-# Para seleccionar una área, interactua con el menu de abajo")
    .setColor("Purple")
    .setFooter({text: "Tu energia se actualiza antes de iniciar una exploración. 10 min > 1 punto de energia"})
    .setImage("https://c.tenor.com/OJ6jmNtTflcAAAAd/tenor.gif")

    Object.keys(region.areas).forEach(key => {
        const area = region.areas[key]
        const isHabilitado = area.habilitado ? `(${area.energiaNecesaria} de energía)` : "[Deshabilitado]"
        embed.addFields({
            name: `${area.Nombre} ${isHabilitado}`,
            value: `${area.Descripcion || "Sin descripción"}`,
            inline: true,
        });
    });

    const transacciónId = uuidv4().replace(/-/g, "")

    const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`selectRegion-${interaction.user.id}-${transacciónId}`)
    .setPlaceholder(`Selecciona el área a explorar`)
    .setMaxValues(1)

    Object.keys(region.areas).forEach(areaKey => {
        const area = region.areas[areaKey]

        if(!area.habilitado) return

        selectMenu.addOptions(
            {
                label: `${area.Nombre} (${area.energiaNecesaria} de energía)`,
                description: `${area.Descripcion || "Sin descripción"}`,
                value: `select*${areaKey}`,
                emoji: `${area.emoji || "🌳"}`
            }
        )
    })

    const selectRow = new ActionRowBuilder().addComponents(selectMenu)

    const message = await interaction.reply({embeds: [embed], components: [selectRow], fetchReply: true})

    if(energy) {
        await souls.updateOne({_id: interaction.user.id}, 
            {
                $set: {
                    energy: 30
                }
            }
        )
        interaction.followUp({content: "Parece que es la primera vez que vas a explorar, ¿ansioso?. Ten **30 de energía** para comenzar tu aventura", ephemeral: true})
    }

    const obj = {
        ...region,
        message: message
        }
    
    await transaccionCache.set(transacciónId, obj)
    await transaccionCache.setUser(interaction.user.id, transacciónId)

    function getEnergy(currentEnergy, maxEnergy) {
        const porcentaje = (currentEnergy / maxEnergy) * 100
        const maxbar = 5;

        let filledBars  = Math.round((currentEnergy / maxEnergy) * maxbar)
        const emptyBars = maxbar - filledBars;

        let energyBars = "⚡".repeat(filledBars)
        let energyEmpty = ".".repeat(emptyBars)

        return "`"+ `[${energyBars}${energyEmpty}]` + "`" + ` **(${currentEnergy}/${maxEnergy})**`

    }

    async function updateEnergy(currentEnergy, maxEnergy = 60, soul) {
        const ahora = Date.now();
        const regeneracionTime = 10 // Esto en minutos

        const lastUpdate = soul?.lastEnergyUpdate || ahora;
        

        const diferenciaMinutos = (ahora - lastUpdate) / (1000 * 60 );

        const puntosRegenerados = Math.floor(diferenciaMinutos / regeneracionTime);

        const nuevaEnergia = Math.min(currentEnergy + puntosRegenerados, maxEnergy);

        const newLastUpdate = puntosRegenerados > 0 ? lastUpdate + (puntosRegenerados * 1000 * 60 * regeneracionTime) : lastUpdate;

        await souls.updateOne({_id: interaction.user.id}, 
            {
                $set: {
                    energy: nuevaEnergia, lastEnergyUpdate: newLastUpdate
                }
            }
        );

        return nuevaEnergia;
    }
    }
}