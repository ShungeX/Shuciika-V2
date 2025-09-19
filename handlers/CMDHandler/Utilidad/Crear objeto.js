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
    const { DateTime } = require('luxon')
    const timeMXS = DateTime.now().setZone('UTC-6').setLocale('es').toLocaleString(DateTime.DATE_SHORT)
    const bdobjeto = db2.collection("Objetos_globales")
    const personaje = db2.collection("Personajes")
    const name = interaction.options.getString("nombre") || "Desconocido"
    const desc = interaction.options.getString("descripcion") || "Sin descripcion"
    const rare = interaction.options.getString("rareza") || "Indefinido"
    const tipo = interaction.options.getString("tipo") || "Indefinido"
    const region = interaction.options.getString("region") || "TOB-01"
    const amount = interaction.options.getInteger("cantidad") || 0
    const roles = ["810198633705766962","745503889297637478","716851609509953560","734142447256469584"]
    const verifRoles = roles.some(role => interaction.member.roles.cache.has(role))


    if(!verifRoles) {
        return interaction.reply({content: "No tienes permisos para usar este comando", ephemeral: true})
    }

    await generateID()
    await saveObjet()

    const objeto = await bdobjeto.findOne({"Objetos.ID": uniqueID},
        {projection: {"Objetos": {$elemMatch: {ID: uniqueID}}}}
    )

    const objfind = objeto.Objetos[0]

    console.log("BD", objeto.Objetos[0].Nombre, "ID:", uniqueID)

    if(!objeto) {
        return interaction.reply({content: "No pude guardar el objeto <( _ _ )>", ephemeral: true})
    }

    const embed = new EmbedBuilder()
    .setTitle(objfind.Nombre)
    .setDescription(objfind.Descripcion)
    .setThumbnail(objfind.imagenURL || "https://cdn.discordapp.com/attachments/665423320765693982/905282026133938206/unknown.png")
    .addFields(
        {name: "Rareza", value: objfind.Rareza, inline: true},
        {name: "Tipo", value: objfind.Tipo, inline: true},
        {name: "Objeto limitado", value:`${amount === 0 ? "No" : `${amount}`}`, inline: true},
        {name: "ID", value: "`" + uniqueID + "`", inline: true},
        {name: "Region", value: region, inline: true},
        {name: "Evento de origen", value: objfind.evento_origen || "No es de evento", inline: true}
    )
    .setColor("Green")
    .setFooter({text: `Objeto creado por ${interaction.user.username}`, iconURL: interaction.user.avatarURL()})
    .setTimestamp()

    interaction.reply({embeds: [embed]})

    async function generateID() {
        while(true) {
            uniqueID = Math.floor(Math.random() * 999) + 1;
            const verify = await bdobjeto.findOne({"Objetos.ID": uniqueID},
                {projection: {"Objetos": {$elemMatch: {ID: uniqueID}}}}
            )
            
            if(!verify) break
        }
    return uniqueID
    }

    async function saveObjet() {
        console.log("Guardando objeto...")
        if(!await bdobjeto.findOne({_id: `${region}`})) {
            await bdobjeto.insertOne({
                _id: `${region}`,
                Descripcion: "Descripcion detallada sobre la región",
                Objetos: [],           
            })
        } 


        const newObjeto = {
            ID: uniqueID,
            ID_Autocomplete: `${region}${uniqueID}`, 
            Region: region,
            Nombre: name,
            Descripcion: desc,
            Rareza: rare,
            Tipo: tipo,
            Cantidad: amount >= 1 ? amount : null,
            atributos: {},
            inStore: false,
            precio: 0,
            vendido: 0,
            fecha: timeMXS,
            evento_origen: null,
            imagenURL: null,
            intercambiable: false,
            tiempo_limite: null,
            restricciones: {
                "nivel_minimo": 0,
                "nivel_maximo": 0,
                "clase": null,
                "region": null,
                "reputacion": null,
            },

        }

        await bdobjeto.updateOne({_id: `${region}`}, {
                $push: {Objetos: newObjeto}
            })
        console.log(`Objeto ${name} creado con la ID: ${uniqueID}`)    
    }
}