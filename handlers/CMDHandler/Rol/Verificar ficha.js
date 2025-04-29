const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')

     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

module.exports =  {
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

    ejecutar: async(client, interaction) => {
    const userverif = interaction.options.getString("personaje_cache")
    const comentario = interaction.options.getString("comentario")
    const cachepj = await Cachedb.findOne({name: userverif})
    
    const transacciónId = uuidv4().replace(/-/g, "")
    const roles = ["810198633705766962","745503889297637478","716851609509953560","734142447256469584", "922698145404698664"]
    
    

    const verifRoles = roles.some(role => interaction.member.roles.cache.has(role))

    if(!verifRoles) {
        return interaction.reply({content: "Lo siento, solo el **staff** y **verificadores de ficha** puede usar este comando (╥﹏╥)", ephemeral: true})
    }

    if(!cachepj) {
        return interaction.reply({content: "El usuario mencionado no tiene un personaje registrado. ＞﹏＜"})
    }
    const isFinish = cachepj?.isFinish || false

    if(!isFinish) {
        return interaction.reply({content: "El usuario aun no termina su ficha. Debes esperar a que minimo el usuario complete las dos partes obligatorias antes de verificar ( •̀ ω •́ )✧", ephemeral: true})
    }


    var waiting = cachepj.waiting
    const apodo = cachepj.apodo ?? "Sin apodo"


    if(waiting) {
        waiting = "En espera"
    }else {
        waiting = "No enviada"
    }

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
    .setAuthor({name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({dynamic: true})})
    .setTitle(cachepj.name)
    .setDescription(cachepj?.historia ? cachepj.historia: "Sin Historia (¿In rol?)")
    .addFields(
            {name: `Informacion`, value: "`📑` **Apodo: ** " + apodo + "\n`🎎` **Sexo: **" + cachepj.sexo + "\n`🍭` **Edad: **" + cachepj.edad + "\n`🛫` **C/Org: **" + cachepj.ciudadOrg, inline: true },
            {name: `Extra`, value: "`🎂` **Cumple **" + cachepj.cumpleaños + "\n`👑` **Familia: **" + cachepj.familia + "\n`❔`**  Estado:** " + waiting , inline: true},
            {name: "🎭 Personalidad", value: cachepj.personalidad, inline: false},
            {name: `🎮 Especialidad`, value: cachepj.especialidad, inline: false}

          )
    .setThumbnail(cachepj.avatarURL)
    .setColor(`Red`)

    const message = await interaction.reply({content: '**[Vista previa del personaje]** ¿Este esta es la ficha a verificar?', embeds: [embed], components: [Row], withResponse: true})

    const obj = {
        comentario: comentario,
        fichaverif: cachepj._id,
        message: message
    }

    transaccionCache.set(transacciónId, obj)


  }
}