const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../../config")
const transaccionCache = require("../../../../utils/cache")
const { v4: uuidv4 } = require('uuid')
const  {duelSystem} = require("../../../../functions/duelManager")



module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("duelo")
        .setDescription("Invita a un personaje a un duelo.")
        .addIntegerOption(o =>
            o
                .setName("personaje")
                .setDescription("Ingresa la ID del personaje a retar")
                .setAutocomplete(true)
                .setRequired(true)
        ),
    requirements: {
        character: { obtener: true, required: false },
        soul: { obtener: true, required: true },
        cachepj: { obtener: false},
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction, { character, soul }) => {
        const rivalID = interaction.options.getInteger("personaje")
        const rival = await characters.findOne({ _id: rivalID })
        const userData = await userdb.findOne({_id: interaction.user.id})

        


        if (await duelSystem.personajeEnDuelo(character._id)) {
            return interaction.reply({ content: "No puedes iniciar un duelo si tu personaje ya esta en otro ＞﹏＜", flags: ["Ephemeral"] })
        }

        if (!rival) return interaction.reply({ content: `Parece ser que no existe ningun personaje con la ID: **${rivalID}**`, flags: ["Ephemeral"] });

        if (character._id === rival._id) return interaction.reply({ content: `No puedes tener un duelo contigo mismo... ¿O si? (¬_¬")`, flags: ["Ephemeral"] });

        if (userData.nix.personajes.some(p => p.id === rival._id)) {
            return interaction.reply({ content: `No puedes retar a un personaje que te pertenece. (¬_¬")`, flags: ["Ephemeral"] });
        }

        const soulRival = await souls.findOne({ _id: rivalID })

        if (!soulRival) return interaction.reply({ content: `**${rival.Nombre}** aun no puede combatir... ＞﹏＜`, flags: ["Ephemeral"] });

        if (soul.nucleo.HP === 0) {
            return interaction.reply({ content: "Tu personaje esta fuera de combate. Necesita recuperar vida... ＞﹏＜\n-# Usa un objeto con `/rol usar_objeto`", flags: ["Ephemeral"] })
        }

        if (soulRival.nucleo.HP === 0) {
            return interaction.reply({ content: "No puedes retar a un personaje que esta debilitado ＞﹏＜", flags: ["Ephemeral"] })
        }

        if (await duelSystem.personajeEnDuelo(rival._id)) {
            return interaction.reply({ content: "No puedes retar a este personaje porque esta en un duelo ＞﹏＜", flags: ["Ephemeral"] })

        }

        const rivalUser = client.users.cache.get(rival.ownerID)

        const MD = await interaction.user.createDM()
        const rivalMD = await rivalUser.createDM()


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
            .setDescription(`**${character.perfil.Nombre} (LV: ${soul.nucleo.nivelMagico})** te esta retando a un duelo`)
            .setThumbnail(`${character.perfil.avatarURL}`)
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

        const message = await interaction.reply({ content: `${rivalUser}`, embeds: [embed], components: [row], withResponse: true })



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

    }
}