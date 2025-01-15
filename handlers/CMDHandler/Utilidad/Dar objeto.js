const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const version = require("../../../config")
const { v4: uuidv4} = require('uuid')
const transaccionCache = require("../../../utils/cache")


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


module.exports = async(client, interaction) => {
    const { DateTime } = require('luxon')
    const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)
    const bdobjeto = db2.collection("Objetos_globales")
    const personaje = db2.collection("Personajes")
    const Idfind = interaction.options.getInteger("personaje")
    const amount = interaction.options.getInteger("cantidad") || 1
    const uniqueID = interaction.options.getInteger("objeto")
    const pj = await personaje.findOne({ID: Idfind}) 

    const objeto = await bdobjeto.findOne({"Objetos.ID": uniqueID},
        {projection: {"Objetos": {$elemMatch: {ID: uniqueID}}}}
    )

    const objfind = objeto?.Objetos[0]

    if(!pj) {
        return interaction.reply({content: "El usuario no tiene un personaje registrado", ephemeral: true})
    }

    if(!objfind) {
        return interaction.reply({content: "El objeto con la ID `" + uniqueID + "` no existe", ephemeral: true})
    }

    const question = new EmbedBuilder()
    .setTitle("Verificacion")
    .setDescription("¿Estas seguro de agregar el objeto **`" + objfind.Nombre + "`** Al inventario de " + pj.Nombre + "?")
    .addFields({name: "Cantidad", value: `${amount}`, inline: true})
    .setThumbnail(pj.avatarURL)
    .setColor("Yellow")

    const transacciónId = uuidv4().replace(/-/g, "")
    const objinfo = {
        objname: objfind.Nombre,
        objId: objfind.ID,
        cantidad: amount,
        fecha: timeMXS,

    }
    console.log(objinfo.objname)

    transaccionCache.set(transacciónId, objinfo)

    const aceptar = new ButtonBuilder()
    .setCustomId(`acceptobj-${interaction.user.id}-${pj.ID}-${transacciónId}`)
    .setStyle(ButtonStyle.Success)
    .setEmoji(`✅`)
    .setDisabled(false)

    const denegar = new ButtonBuilder()
    .setCustomId(`denegobj-${interaction.user.id}-${pj.ID}`)
    .setStyle(ButtonStyle.Danger)
    .setEmoji(`❌`)
    .setDisabled(false)

    const row = new ActionRowBuilder()
    row.addComponents(aceptar, denegar)

    await interaction.reply({content: "Verifica la informacion...", embeds: [question], components: [row]})
}