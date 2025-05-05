const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../config")


module.exports = {
    requireCharacter: true,
    requireSoul: true,
    requireCharacterCache: true,
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

    ejecutar: async(client, interaction, { character, soul, cachepj}) => {
            const Idfind = interaction.options.getInteger("personaje")
            var user = interaction.options.getUser("usuario") 
            var estado = ""

            if(Idfind || user) {
            const personaje = await characters.findOne({$or: [
            {ID: Idfind},
            {_id: user?.id},
            ]})

            if(!personaje) {
            return interaction.reply({content: "El usuario que mencionaste no tiene un personaje registrado (╥﹏╥)\n-# ¿O quizás fue la ID?", ephemeral: true})
            }

            user = interaction.guild.members.resolve(personaje._id)
            perfil(personaje)
            }else if(cachepj) {
            if(cachepj?.waiting) {
            estado = "En espera"
            }else {
            estado = "No enviada"
            }

        const noverif = new EmbedBuilder()
        .setAuthor({name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL({dynamic: true})})
        .setTitle(`${cachepj?.nombre} ${cachepj?.apodo ? `[${cachepj?.apodo}]` : ''}`)
        .setDescription(cachepj.historia ? cachepj.historia: "Sin Historia (¿In rol?)")
        .addFields(
          {name: "Informacion", value: "`📑` **Apodo: ** " + cachepj?.apodo + "\n`🎎` **Sexo: **" + cachepj?.sexo + "\n`🍭` **Edad: **" + cachepj?.edad + "\n`🛫` **C/Org: **" + cachepj?.ciudadOrg, inline: true},
          {name: "Extra", value: "`🎂` **Cumple **" + cachepj?.cumpleaños + "\n`👑` **Linaje Familiar **" + cachepj?.familia + "\n`❔`** Estado:** " + estado, inline: true},
          {name: "🎭 Personalidad", value: cachepj?.personalidad, inline: false},
          {name: "🎮 Especialidad", value: cachepj?.especialidad, inline: false}
        )
        .setThumbnail(`${cachepj.avatarURL ? cachepj.avatarURL: "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"}`)
        .setColor(`Red`)
        return interaction.reply({content: '**Vista previa de tu personaje.**\n-# esto significa que aun no ha sido verificada. espera pacientemente  	(∪｡∪)｡｡｡zzZ', embeds: [noverif]})
            }else {
        if(!character) {
            interaction.reply({content: `No tienes un **personaje** o **ficha** para usar esto. ╮(￣～￣)╭ \n
                Puedes usar el comando **/rol crear_ficha para crear una ficha**
                \nTambien puedes mencionar a un usuario o buscar su **ID** de personaje (⌒‿⌒)`})
            return;
        }

        perfil(character)


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
        await interaction.reply({embeds: [embed], components: [createSelectMenu(pjuser)], fetchReply: true})

        return pjuser
            }

         function createSelectMenu(personaje) {
                let components = new StringSelectMenuBuilder()
                .setCustomId(`selectPerfil-${interaction.user.id}-${personaje.ID}`)
                .setPlaceholder("¿Que quieres revisar? ( •̀ ω •́ )✧")
                .setMaxValues(1)

                components.addOptions(
                    {
                        label: `Perfil principal`,
                        value: `perfil`,
                        emoji: `<:d9056043c1e148e38efd10e4515e33d2:1356111301859868823>`,
                        default: true
                    },
                    {
                        label: `Historia [Lore]`,
                        value: `historia`,
                        emoji: "<a:BunnyBook:1356111194997395496>"
                    },
                    {
                        label: `Alma [Nucleo arcano]`,
                        value: `alma`,
                        emoji: "<a:KrisJojos:1350664814414004395>"
                    },
                    {
                        label: `Mascota [Pets]`,
                        value: `mascota`,
                        emoji: "<:pets:1356111134758932510>"
                    },
                    
                )    
                
                return new ActionRowBuilder().addComponents(components)                           
    }
    }
}