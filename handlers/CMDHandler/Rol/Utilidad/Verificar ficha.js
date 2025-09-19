const { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, SlashCommandSubcommandBuilder } = require("discord.js")
const clientdb = require("../../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const transaccionCache = require("../../../../utils/cache")
const { v4: uuidv4 } = require('uuid')

/**
* @param {Client} client 
* @param {ChatInputCommandInteraction} interaction
*/

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("verificar_ficha")
        .setDescription("Verifica la ficha de un usuario / [Staff - Verificadores]")
        .addStringOption(o =>
            o
                .setName("personaje_cache")
                .setDescription("Selecciona el personaje a verificar de la lista")
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addStringOption(o =>
            o
                .setName("comentario")
                .setDescription("[Opcional] Deja un comentario constructivo, creativo o bonito al usuario de la ficha")
        ),

    requireCharacter: false,
    requireSoul: false,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: false,
        Cachepj: false
    },

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async (client, interaction) => {
        const userverif = interaction.options.getString("personaje_cache")
        const comentario = interaction.options.getString("comentario")
        const cachepj = await Cachedb.findOne({ _id: userverif })

        const transacciónId = uuidv4().replace(/-/g, "")
        const roles = ["810198633705766962", "745503889297637478", "716851609509953560", "734142447256469584", "922698145404698664"]



        const verifRoles = roles.some(role => interaction.member.roles.cache.has(role))

        if (!verifRoles) {
            return interaction.reply({ content: "Lo siento, solo el **staff** y **verificadores de ficha** puede usar este comando (╥﹏╥)", flags: ["Ephemeral"] })
        }

        if (!cachepj) {
            return interaction.reply({ content: "El usuario mencionado no tiene un personaje registrado. ＞﹏＜", flags: ["Ephemeral"] })
        }
        const waiting = cachepj?.waiting

        if (!waiting) {
            return interaction.reply({ content: "El usuario aun no termina su ficha. debes ser paciente y esperar a que el usuario envie su ficha ( •̀ ω •́ )✧", ephemeral: true })
        }

        const apodo = cachepj?.apodo || "Sin apodo"
        const familia = cachepj?.familia || "No especificado"
        const especialidad = cachepj?.especialidad || "No especificado"

        const button1 =
            new ButtonBuilder()
                .setCustomId(`vfpj_false-${interaction.user.id}-${transacciónId}`)
                .setStyle(ButtonStyle.Danger)
                .setLabel("Cancelar")
                .setEmoji("🚫")


        const Row = new ActionRowBuilder()
        Row.addComponents([
            new ButtonBuilder()
                .setCustomId(`vfpj_true-${interaction.user.id}-${transacciónId}`)
                .setStyle(ButtonStyle.Success)
                .setLabel("Verificar")
                .setEmoji("✅"),
            button1
        ])
        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle(cachepj.nombre)
            .setDescription(cachepj?.historia ? cachepj.historia : "Sin Historia (¿In rol?)")
            .addFields(
                { name: `Informacion`, value: "`📑` **Apodo: ** " + apodo + "\n`🎎` **Sexo: **" + cachepj.sexo + "\n`🍭` **Edad: **" + cachepj.edad + "\n`🛫` **C/Org: **" + cachepj.ciudadOrg, inline: true },
                { name: `Extra`, value: "`🎂` **Cumple **" + cachepj.cumpleaños + "\n`👑` **Familia: **" + familia + "\n`❔`**  Estado:** " + waiting, inline: true },
                { name: "🎭 Personalidad", value: cachepj.personalidad, inline: false },
                { name: `🎮 Especialidad`, value: especialidad, inline: false }

            )
            .setThumbnail(cachepj.avatarURL)
            .setColor(`Red`)

        const messages = await interaction.reply({ content: '**[Vista previa del personaje]** ¿Este esta es la ficha a verificar?', embeds: [embed], components: [Row], withResponse: true })

        const obj = {
            message: messages.id,
            comentario: comentario,
            fichaverif: cachepj._id
        }

        transaccionCache.set(transacciónId, obj)


    }
}