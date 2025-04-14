const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const { duelSystem } = require("../../../functions/duelManager")



module.exports = {
    requireCharacter: true,
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

    ejecutar: async(client, interaction, { character, soul}) => {
    const rivalID = interaction.options.getInteger("personaje")
    const rival = await characters.findOne({ID: rivalID})


    if(await charactersinDuel(character.ID)) {
        return interaction.reply({content: "No puedes iniciar un duelo si tu personaje ya esta en otro ＞﹏＜", ephemeral: true})
    }

    if(!rival) return interaction.reply({content: `Parece ser que no existe ningun personaje con la ID: **${rivalID}**`, ephemeral: true});
    if(character.ID === rival.ID) return interaction.reply({content: `No puedes tener un duelo contigo mismo... ¿O si? (¬_¬")`, ephemeral: true})

    const soulRival = await souls.findOne({ID: rivalID})

    if(!soulRival) return interaction.reply({content: `**${rival.Nombre}** aun no puede combatir... ＞﹏＜`, ephemeral: true});

    if(soul.HP === 0) {
        return interaction.reply({content: "Tu personaje esta fuera de combate. Necesita recuperar vida... ＞﹏＜\n-# Usa un objeto con `/rol usar_objeto`", ephemeral: true})
    }

    if(soulRival.HP === 0) {
        return interaction.reply({content: "No puedes retar a un personaje que esta debilitado ＞﹏＜"})
    }

    if(await charactersinDuel(rival.ID)) {
            return interaction.reply({content: "No puedes retar a este personaje porque esta en un duelo ＞﹏＜s", ephemeral: true})
        
    }

    const rivalUser = client.users.cache.get(rival._id)

    const MD = await interaction.user.createDM()
    const rivalMD = await rivalUser.createDM()

    if(!MD || !rivalMD) {
        return interaction.reply("No se puede iniciar el duelo si alguno de los dos usuarios tiene bloqueado los MD =.=")
    }

    const gifsDuelo = [
        "https://c.tenor.com/OFsN3R89BIEAAAAd/tenor.gif",
        "https://c.tenor.com/cYSjqD3730UAAAAd/tenor.gif",
        "https://c.tenor.com/dpyPyzrwXzYAAAAd/tenor.gif",
        "https://c.tenor.com/jCA_9r3vL6EAAAAC/tenor.gif",
        "https://i.pinimg.com/originals/e9/fc/84/e9fc840e4200187bc4aa96d76e8c7692.gif"
    ]

    const gifSelect = gifsDuelo[Math.floor(Math.random() * gifsDuelo.length)]

    const embed = new EmbedBuilder()
    .setTitle(`Se aproxima un duelo...`)
    .setDescription(`**${character.Nombre} (LV: ${soul.nivelMagico})** te esta retando a un duelo`)
    .setThumbnail(`${character.avatarURL}`)
    .setImage(gifSelect)
    .setColor("Red")
    .setTimestamp()

    const transacciónId = uuidv4().replace(/-/g, "")

    const button = new ButtonBuilder()
    .setCustomId(`preDuel-${rivalUser.id}-NaN-${transacciónId}-accept`)
    .setEmoji(`✅`)
    .setLabel("Aceptar")
    .setStyle(ButtonStyle.Secondary)

    const button2 = new ButtonBuilder()
    .setCustomId(`preDuel-${rivalUser.id}-NaN-${transacciónId}-decline`)
    .setEmoji(`❌`)
    .setLabel("Rechazar")
    .setStyle(ButtonStyle.Secondary)

    const row = new ActionRowBuilder().addComponents(button, button2)

    const message = await interaction.reply({content: `${rivalUser}`,embeds: [embed], components: [row], fetchReply: true})



    const obj = {
        characterAuthor: character,
        authorSoul: soul,
        characterRival: rival,
        rivalSoul: soulRival,
        Message: message,
        MdAuthor: MD,
        MdRival: rivalMD,
    }

    await transaccionCache.set(transacciónId, obj)


    async function charactersinDuel(characterId) {

        return Array.from(duelSystem.activeduels.values()).some(duel => {
            return duel.personajes.some(p => p.ID === characterId)
        })
    }
    
    }
}