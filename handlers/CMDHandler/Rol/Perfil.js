const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const version = require("../../../config")
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const Idfind = interaction.options.getInteger("personaje")
    var user = interaction.options.getUser("usuario") 
    const fichasf = await Cachedb.findOne({_id: interaction.user.id})
    var estado = ""





if(Idfind || user) {
    const personaje = await character.findOne({$or: [
        {ID: Idfind},
        {_id: user?.id},
    ]})



    if(!personaje) {
        return interaction.reply({content: "El usuario que mencionaste no tiene un personaje registrado (╥﹏╥)\n-# ¿O quizás fue la ID?", ephemeral: true})
        
    }
    user = interaction.guild.members.resolve(personaje._id)
    perfil(personaje)
    }else if(fichasf) {
        if(fichasf.waiting) {
            estado = "En espera"
        }else {
            estado = "No enviada"
        }

        if(fichasf.isFinish) {
            return interaction.reply({content: "Aun no puedes usar este comando. Debes terminar los dos formularios de tu ficha .·´¯`(>▂<)´¯`·. ", ephemeral: true})
        }
        
        const noverif = new EmbedBuilder()
        .setAuthor({name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL({dynamic: true})})
        .setTitle(fichasf.name)
        .setDescription(fichasf.historia ? fichasf.historia: "Sin Historia (¿In rol?)")
        .addFields(
          {name: "Informacion", value: "`📑` **Apodo: ** " + fichasf.apodo + "\n`🎎` **Sexo: **" + fichasf.sexo + "\n`🍭` **Edad: **" + fichasf.edad + "\n`🛫` **C/Org: **" + fichasf.ciudadOrg, inline: true},
          {name: "Extra", value: "`🎂` **Cumple **" + fichasf.cumpleaños + "\n`👑` **Linaje Familiar **" + fichasf.familia + "\n`❔`** Estado:** " + estado, inline: true},
          {name: "🎭 Personalidad", value: fichasf.personalidad, inline: false},
          {name: "🎮 Especialidad", value: fichasf.especialidad, inline: false}
        )
        .setThumbnail(`${fichasf.avatarURL ? fichasf.avatarURL: "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"}`)
        .setColor(`Red`)
        return interaction.reply({content: '**Vista previa de tu personaje.** Para enviar tu ficha debes usar el comando: `' + `/rol enviar_ficha` + "`", embeds: [noverif]})
    }else {
        const ownpj = await character.findOne({_id: interaction.user.id})

        if(!ownpj) {
            interaction.reply({content: `No tienes un **personaje** o **ficha** para usar esto. ╮(￣～￣)╭ \n
                Puedes usar el comando **/Rol crear_ficha para crear una ficha
                \nTambien puedes mencionar a un usuario o buscar su **ID** de personaje (⌒‿⌒)`})
            return;
        }

        perfil(ownpj)


    }

    async function perfil(pjuser) {

        const row = new ActionRowBuilder()

        const histbutton = new ButtonBuilder()
        .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-1`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(`➡️`)

        const regButton = new ButtonBuilder()
        .setCustomId(`null`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(`⬅️`)
        .setDisabled(true)

        row.addComponents(regButton, histbutton)

        const descripcion = pjuser.Descripcion ? pjuser.Descripcion: "Sin descripcion"
        const reputacion = pjuser?.Reputacion ? pjuser.Reputacion: "0"
        const grado = pjuser?.DesmpAcademico?.Grado ? pjuser.DesmpAcademico.Grado: "Aun no calculado"

        const urlavatar = pjuser.avatarURL.replace('/upload/', '/upload/q_auto,f_auto,w_480,h_480,c_fill/')

        console.log(urlavatar)

        
        const embed = new EmbedBuilder()
        .setTitle(pjuser.Nombre + ` [${pjuser.Apodo}]`)
        .setDescription("`Reputacion:` " + reputacion + "\n`Grado:` "+ grado +"\n\n" + descripcion)
        .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
        .addFields(
          {name: "Informacion 1/2", value: "`🎎` **Sexo: **" + pjuser.Sexo + "\n`🍭` **Edad: **" + pjuser.Edad + "\n`🎂` **Cumple: **" + pjuser.Cumpleaños + "\n`🛫` **C/Org: **" + pjuser.CiudadOrg, inline: true},
          {name: "Informacion 2/2", value: "`👑` **Linaje familiar: **" + pjuser.Familia +"\n`🎭` **Personalidad: **" + pjuser.Personalidad + "\n `🏈` **Especialidad: **" + pjuser.Especialidad, inline: true},
          {name: "Extra", value: "`🔮` **Rol: **" + pjuser.Rol + "\n`💳` **ID: **" + pjuser.ID + "\n `🎉` **Fecha de creacion: **" + pjuser.FechaS, inline: false}
        )
        .setThumbnail(urlavatar)
        .setColor(`Random`)
        .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
        await interaction.reply({embeds: [embed], components: [row], fetchReply: true})

        return pjuser
    }
}