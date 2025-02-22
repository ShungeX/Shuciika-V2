const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const userdb = db.collection("usuarios_server")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characterPj = db2.collection("Personajes")
const { DateTime } = require('luxon')
const timeMXF = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)


     /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

module.exports = async(client, interaction) => {
    const userverif = interaction.options.getString("personaje_cache")
    const comentario = interaction.options.getString("comentario")
    const cachepj = await Cachedb.findOne({name: userverif})
    const rol = interaction.guild.roles.cache.find((r) => r.id === "745503889297637478")
    const roles = ["810198633705766962","745503889297637478","716851609509953560","734142447256469584"]
    
    

    const verifRoles = roles.some(role => interaction.member.roles.cache.has(role))

    if(!verifRoles) {
        return interaction.reply({content: "Lo siento, solo el **staff** puede usar este comando (╥﹏╥)", ephemeral: true})
    }

    if(!cachepj) {
        return interaction.reply({content: "El usuario mencionado no tiene un personaje registrado. ＞﹏＜"})
    }
    const isFinish = cachepj?.isFinish ?? false

    if(!isFinish) {
        return interaction.reply({content: "El usuario aun no termina su ficha. Debes esperar a que minimo el usuario complete las dos partes obligatorias antes de verificar ( •̀ ω •́ )✧", ephemeral: true})
    }


    var waiting = cachepj.waiting
    const apodo = cachepj.apodo??"Sin apodo"


    if(waiting) {
        waiting = "En espera"
    }else {
        waiting = "No enviada"
    }

    const button1 = 
        new ButtonBuilder()
        .setCustomId(`vfpj_false-${interaction.user.id}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel("Cancelar")
        .setEmoji("🚫")
      

    const Row = new ActionRowBuilder()
    Row.addComponents([
      new ButtonBuilder()
      .setCustomId(`vfpj_true-${interaction.user.id}`)
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
    await interaction.reply({content: '**[Vista previa del personaje]** ¿Este esta es la ficha a verificar?', embeds: [embed], components: [Row]})

    if(comentario) {
        Cachedb.updateOne({_id: cachepj._id}, 
            {$set: {comentario: comentario}}
        )
    }

userdb.updateOne({_id: interaction.user.id}, {
    $setOnInsert: {_id: interaction.user.id},
    $set: {fichaverif: cachepj._id}
}, {upsert: true})
}