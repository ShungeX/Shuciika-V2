const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, time} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const userdb = db.collection("usuarios_server")
const updateInventario = require("../../../functions/updateInventario")
const versionEcon = require("../../../config")


module.exports = {
    requireCharacter: true,
    requireSoul: false,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: false,
        Character: true,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, { character }) => {
    const user = await userdb.findOne({_id: interaction.user.id})
    const timeSeconds = Math.floor(Date.now() / 1000)
    const lastTrabajo = user?.Trabajo?.last || 0
    const enfriamiento = Math.floor(Date.now() / 1000) + ( 4 * 60 *60)


    if(lastTrabajo >= timeSeconds ) {
        return interaction.reply({content: `Tu personaje debe descansar antes de volver a trabajar. Debes esperar <t:${lastTrabajo}:R>`, ephemeral: true})
    }


    const lumensRand = Math.floor(Math.random() * (50 - 30 + 1) + 40)

    const embed = new EmbedBuilder()
    .setTitle("Has trabajado arduamente en papeleria")
    .setDescription("Te han pagado un total de **`" + lumensRand + "`** <a:Lumens:1335709991130103910> por tu arduo trabajo")
    .setColor("Random")
    .setFooter({text: `Sistema de economia: ${versionEcon.versionEc}`})

   await characters.updateOne({_id: interaction.user.id}, {
        $inc: {
            "Dinero": lumensRand
        }
    })

   await userdb.updateOne({_id: interaction.user.id}, {
        $set: {
            "Trabajo.last": enfriamiento
        }
    })

    interaction.reply({embeds: [embed]})


    }
}