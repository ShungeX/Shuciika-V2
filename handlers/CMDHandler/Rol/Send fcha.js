const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType} = require(`discord.js`)
const {SlashCommandBuilder} = require("@discordjs/builders")
const clientdb = require("../../../Server")
const { Client } = require("discord.js")
const util = require("util")
const sleep = util.promisify(setTimeout)
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const characterCache = db2.collection("CachePJ")
    const user = interaction.user
    const characterPj = db2.collection("Personajes")
    const userdb = db.collection("usuarios_server")
    const userfind = await userdb.findOne({_id: interaction.user.id})
    const pj = await characterPj?.findOne({_id: interaction.user.id})
    const ficha = await characterCache?.findOne({_id: interaction.user.id})
    const img = ficha.avatarURL
    const unknownImg = "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png"
    const apodo = ficha.apodo ?? "Sin apodo"

    if(pj) {
        return interaction.reply({content: "¡Ya tienes registrado a un personaje!. ☆⌒(>。<) " + `**(${pj.Nombre})**` + "\nUsa `/rol perfil` para verlo \n", ephemeral: true})
    }else if(!ficha) {
        return interaction.reply({content: "Primero debes hacer tu ficha. ☆⌒(>。<) \n" + "Usa **`/rol crear_ficha`**", ephemeral: true})
    }else if(ficha.waiting) {
        return interaction.reply({content: "Ya has enviado tu ficha. ¡Se paciente y espera a que un administrador verifique tu ficha! ☆⌒(>。<)", ephemeral: true})
    }else {

        const embed = new EmbedBuilder()
        .setAuthor({name: user.username, iconURL: user.displayAvatarURL()})
        .setTitle(ficha.name)
        .setDescription(ficha.historia ? historia: "Sin Historia (¿In rol?)")
        .addFields(
                {name: "Informacion", value: "`📑` **Apodo: ** " + apodo + "\n`🎎` **Sexo: **" + ficha.sexo + "\n`🍭` **Edad: **" + ficha.edad + "\n`🛫` **C/Org: **" + ficha.ciudadOrg, inline: true}, 
                    {name: "Extra", value: "`🎂` **Cumple **" + ficha.cumpleaños + "\n`👑` **Familia: **" + ficha.familia + "\n`❔`** Estado:** No verificado", inline: true}, 
                    {name: "🎭 Personalidad", value: ficha.personalidad, inline: false}, 
                    {name: "🎮 Especialidad", value: ficha.especialidad, inline: false}, 
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