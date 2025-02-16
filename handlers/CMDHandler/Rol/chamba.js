const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, time} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const character = db2.collection("Personajes")
const userdb = db.collection("usuarios_server")
const updateInventario = require("../../../functions/updateInventario")
const versionEcon = require("../../../config")

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const personaje = await character.findOne({_id: interaction.user.id})
    const user = await userdb.findOne({_id: interaction.user.id})
    const timeSeconds = Math.floor(Date.now() / 1000)
    const lastTrabajo = user?.Trabajo?.last || 0
    const enfriamiento = Math.floor(Date.now() / 1000) + ( 4 * 60 *60)


    if(!personaje) return interaction.reply({content: "No tienes un personaje inscrito para usar este comando. ¿Porque no intentas crear uno?\n-# Puedes hacerlo usando el comando `/rol crear_ficha`", ephemeral: true})

    if(lastTrabajo >= timeSeconds ) {
        return interaction.reply({content: `Tu personaje debe descansar antes de volver a trabajar. Debes esperar <t:${lastTrabajo}:R>`, ephemeral: true})
    }


    const lumensRand = Math.floor(Math.random() * (50 - 30 + 1) + 40)

    const embed = new EmbedBuilder()
    .setTitle("Has trabajado arduamente")
    .setDescription("Te han pagado un total de **`" + lumensRand + "`** <a:Lumens:1335709991130103910> por tu arduo trabajo")
    .setColor("Random")
    .setFooter({text: `Sistema de economia: ${versionEcon.versionEc}`})

   await character.updateOne({_id: interaction.user.id}, {
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