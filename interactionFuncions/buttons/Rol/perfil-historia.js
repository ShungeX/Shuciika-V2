const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")



module.exports = {
    customId: "perfil_options",
    buttonAuthor: true,

        /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, characterId, page) => {
        const pjuser = await character.findOne({ID: characterId})
        const user = interaction.guild.members.resolve(pjuser._id)
        const soul = await souls.findOne({_id: pjuser._id})

        if(page === "0") {
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

            
        const descripcion = pjuser.Descripcion ? pjuser.Descripcion: "Sin descripcion"
        const reputacion = pjuser?.Reputacion ? pjuser.Reputacion: "0"
        const grado = pjuser?.DesmpAcademico?.Grado ? pjuser.DesmpAcademico.Grado: "Aun no calculado"
    
            row.addComponents(regButton, histbutton)
            const embed = new EmbedBuilder()
            .setTitle(pjuser.Nombre + ` [${pjuser.Apodo}]`)
            .setDescription("`Reputacion:` " + reputacion + "\n`Grado:` "+ grado +"\n\n" + descripcion)
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .addFields(
              {name: "Informacion 1/2", value: "`🎎` **Sexo: **" + pjuser.Sexo + "\n`🍭` **Edad: **" + pjuser.Edad + "\n`🎂` **Cumple: **" + pjuser.Cumpleaños + "\n`🛫` **C/Org: **" + pjuser.CiudadOrg, inline: true},
              {name: "Informacion 2/2", value: "`👑` **Origen: **" + pjuser.Familia +"\n`🎭` **Personalidad: **" + pjuser.Personalidad + "\n `🏈` **Especialidad: **" + pjuser.Especialidad, inline: true},
              {name: "Extra", value: "`🔮` **Rol: **" + pjuser.Rol + "\n`💳` **ID: **" + pjuser.ID + "\n `🎉` **Fecha de creacion: **" + pjuser.FechaS, inline: false}
            )
            .setThumbnail(pjuser.avatarURL)
            .setColor(`Random`)
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
            return interaction.update({embeds: [embed], components: [row]})


        }else if(page === "1") {

            const row = new ActionRowBuilder()
            if(!soul) {
                const regButton = new ButtonBuilder()
                .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-0`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(`⬅️`)
                .setDisabled(false)
                row.addComponents(regButton)
            }else {
                const regButton = new ButtonBuilder()
                .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-0`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(`⬅️`)
                .setDisabled(false)
                const histbutton = new ButtonBuilder()
                .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-2`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(`➡️`)
                row.addComponents(regButton, histbutton)
            }
    
            const embed = new EmbedBuilder()
            .setTitle(pjuser.Nombre + ` [${pjuser.Apodo}]`)
            .setDescription("**`Historia:`**\n" + pjuser.Historia || "In Rol")
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .setThumbnail(pjuser.avatarURL)
            .setColor(`Random`)
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
            return interaction.update({embeds: [embed], components: [row]})
        }else if(page === "2") { 
            const row = new ActionRowBuilder()

            if(interaction.user.id !== pjuser._id) {
                return interaction.reply({content: "No puedes revisar el alma de este personaje ＞﹏＜", ephemeral: true})
            }

            if(!soul) {
                return interaction.reply({content: "Parece ser que el alma de este personaje ya no existe, posiblemente se trate de un error.+ contacta con un administrador", ephemeral: true})
            }

            const histbutton = new ButtonBuilder()
            .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-3`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(`➡️`)
    
            const regButton = new ButtonBuilder()
            .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-1`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(`⬅️`)
            .setDisabled(false)
    
            row.addComponents(regButton, histbutton)

            const embed = new EmbedBuilder()
            .setTitle("Alma de " + pjuser.Nombre)
            .setDescription("<a:Lumens:1335709991130103910> " + pjuser.Dinero + " `Lumens`\n\n`[💜] HP:` " + soul.HP + "\n`[✨] Nivel:` " + soul.nivelMagico + "\n`[🍪] XP:` " + soul.XP 
                + "\n`[🌱] Elemento:` " + soul.Elemento + "\n`[💧] Max Mana:` " + soul?.stats?.manaMax  
            )
            .setFields(
                {name: "[🪄] Tipo de magia", value: soul.artefactoMagico === true ? "Contenedor Elemental" : "Magia Elemental", inline: true},
                {name: "[🥊] Equipamiento", value: `${await getequipamiento()}`}
            )
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .setThumbnail(soul.artefactoMagico === true ? "https://res.cloudinary.com/dn1cubayf/image/upload/v1737346961/idk_db3mmo.jpg" : "https://res.cloudinary.com/dn1cubayf/image/upload/v1737346978/idk3_v2s9hr.jpg")
            .setColor('DarkPurple')
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
            return interaction.update({embeds: [embed], components: [row]})
        }else if(page === "3") {
            const row = new ActionRowBuilder()

            const regButton = new ButtonBuilder()
            .setCustomId(`perfil_options-${interaction.user.id}-${pjuser.ID}-2`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(`⬅️`)
            .setDisabled(false)
    
    
            row.addComponents(regButton)

            const embed = new EmbedBuilder()
            .setTitle("Mascotas de " + pjuser.Nombre)
            .setDescription("Sin mascotas")
            .setAuthor({name: user?.displayName || interaction.member.displayName, iconURL: user?.displayAvatarURL({dynamic: true}) || interaction.member.displayAvatarURL({dynamic: true})})
            .setThumbnail(pjuser.avatarURL)
            .setColor(`Random`)
            .setFooter({ text: `Sistema de perfil  /  Version: ${version.versionRol}`});
            return interaction.update({embeds: [embed], components: [row]})
        }else if(page === "4") {

        }


    
        async function getequipamiento() {

            if(!soul.equipo || soul.equipo.length === 0) {
                return "Sin equipamiento."
            }

            const Regiones = {}

            soul.equipo.forEach(equip => {
                if(!Regiones[equip.Region]) Regiones[equip.Region] = [];
                Regiones[equip.Region].push(equip.ID)
            })

            const objetosEncontrados = [];

            for (const region in Regiones) {
                const documentoRegion = await dbobjetos.findOne({ _id: region });


                if (documentoRegion) {
                    // Filtrar los objetos que coincidan en ID
                    const nombres = documentoRegion.Objetos
                        .filter(obj => Regiones[region].includes(obj.ID))
                        .map(obj => obj.Nombre);
        
                    objetosEncontrados.push(...nombres);
                }
            }

            

            if(objetosEncontrados.length === 0) return "[Desconocido]"


            

            return `${objetosEncontrados.join(", ")}`


        }
    

    }



}
  




