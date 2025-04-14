const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders")
const clientdb = require("../../../Server")
const { Client } = require("discord.js")
const util = require("util")
const sleep = util.promisify(setTimeout)
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")


module.exports = {
    requireCharacter: true,
    requireSoul: false,
    requireCharacterCache: true,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: false,
        Cachepj: true
    },

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, { character, cachepj }) => {
    const user = interaction.user
    const userdb = db.collection("usuarios_server")
    const img = cachepj.avatarURL
    const unknownImg = "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"
    const apodo = cachepj.apodo ?? "Sin apodo"

    if(character) {
        return interaction.reply({content: "¡Ya tienes registrado a un personaje!. ☆⌒(>。<) " + `**(${character.Nombre})**` + "\nUsa `/rol perfil` para verlo \n", ephemeral: true})
    }else if(!cachepj) {
        return interaction.reply({content: "Primero debes hacer tu ficha. ☆⌒(>。<) \n" + "Usa **`/rol crear_ficha`**", ephemeral: true})
    }else if(cachepj.waiting) {
        return interaction.reply({content: "Ya has enviado tu ficha. ¡Se paciente y espera a que un administrador verifique tu ficha! ☆⌒(>。<)", ephemeral: true})
    }else {

        const embed = new EmbedBuilder()
        .setAuthor({name: user.username, iconURL: user.displayAvatarURL()})
        .setTitle(cachepj.name)
        .setDescription(cachepj?.historia ? cachepj.historia.substring() : "Sin Historia (¿In rol?)")
        .addFields(
                {name: "Informacion", value: "`📑` **Apodo: ** " + apodo + "\n`🎎` **Sexo: **" + cachepj.sexo + "\n`🍭` **Edad: **" + cachepj.edad + "\n`🛫` **C/Org: **" + cachepj.ciudadOrg, inline: true}, 
                    {name: "Extra", value: "`🎂` **Cumple **" + cachepj.cumpleaños + "\n`👑` **Familia: **" + cachepj.familia + "\n`❔`** Estado:** No verificado", inline: true}, 
                    {name: "🎭 Personalidad", value: cachepj.personalidad, inline: false}, 
                    {name: "🎮 Especialidad", value: cachepj.especialidad, inline: false}, 
                )
        .setThumbnail(`${ img || "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"}`)
        .setColor(`Red`)
       const msg =  await interaction.reply({content: "**Vista previa de tu personaje**", embeds: [embed], fetchReply: true})

        if(unknownImg.includes(img)) {
            interaction.followUp({content: "-# Parece que tu personaje aun no tiene una **Foto de perfil**\n-# puedes asignar una usando el comando **`/rol configuracion_personaje`**", ephemeral: true})
        }

       await sleep(3000)

        const Row = new ActionRowBuilder()
        const accept = new ButtonBuilder()
        .setCustomId(`acceptverif-${interaction.user.id}`)
        .setStyle(ButtonStyle.Success)
        .setLabel("Aceptar")
        .setEmoji("✅")
        const denegado = new ButtonBuilder()
        .setCustomId(`denegverif-${interaction.user.id}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel("Cancelar")
        .setEmoji("🚫")

        Row.addComponents(accept, denegado)

        msg.edit({embeds: [embed], components: [Row]})

        userdb.updateOne({_id:user.id}, 
            {$set: {Temp: {
                fichatemp: msg.id
            }}}
        )
        
    }
    }

}