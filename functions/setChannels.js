const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../Server")
const cloudinary = require("cloudinary").v2
const Discord = require("discord.js")
const db = clientdb.db("rol_db")
const path = require('path');
const util = require("util")
const sleep = util.promisify(setTimeout)

     /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction, category, valueSet) => {
    const fileName = path.basename(__filename)


    const everuser = interaction.guild.roles.cache.find(aus => aus.name === '@everyone');
    const audiochannel = interaction.guild.channels.cache.get("976719553943965726")
    const sendcerrado = interaction.guild.channels.cache.get("717140034834268162")
    const entradas = ["1197248829288894495", "1197248899467976884", "1340430809710203012"] //Pasillo y canal de entrada
    const ciudadAC = client.channels.cache.get("976971589109309450")
    const logsChannel = client.channels.cache.get("716518718947065868")



    const inreceso = [
        "1197249012756131870", //SalonB1
        "1197249036508467200", //SalonB2
        "838796633356501053", //SalonA1
        "1197249241505075291", //Biblioteca
        ]
    const outreceso = [
        "813862405163581521", //SalonProfesores
        "1197249316461477989", //Azotea 1
        "1197249269795659866", //Patio
        "995113872971268206", //Gimnacio
        "1319809705996189807", //Comedor
        ]

    const arrayChannelCt = [
            "1197249820067373146", //Parque
            "1197249723820671027", //Centro
            "1197249862127865907", //E. Policia
            "1197249937537241239", //Cafeteria
            "1197249970143768576" //Restaurante Iny
            ]




    try {

        if(category === 1) {
            for(const ChannelId of [...inreceso, ...outreceso]) {
                const channel = await interaction.guild.channels.cache.get(ChannelId)

                if(!channel) {
                    console.log("No se encontro el canal con la ID", ChannelId)

                }

                await channel.permissionOverwrites.edit(everuser, {
                    SendMessages: valueSet
                  })
            }

            if(valueSet) {
                console.log("Abierto")
                audiochannel.edit({name: "[🔓] Escuela Abierta"})
            }else {
                console.log("Cerrado")
                audiochannel.edit({name: "[🔐] Escuela Cerrada"})
            }

        }else if(category === 2) {
            for(const ChannelId of arrayChannelCt) {
                const channel = await interaction.guild.channels.cache.get(ChannelId)

                if(!channel) {
                    console.log("No se encontro el canal con la ID", ChannelId)
                    await channel.permissionOverwrites.edit(everuser, {
                        SendMessages: valueSet
                      })
                }

            }
            if(valueSet) {
                ciudadAC.edit({
                    name: "[🔓] Ciudad Abierta"
                    })
            }else {
                ciudadAC.edit({
                    name: "[🔐] Ciudad Cerrada"
                    })
            }

        }else if(category === 3) {
            for(const ChannelId of [...inreceso, ...outreceso, ...arrayChannelCt]) {
                const channel = await interaction.guild.channels.cache.get(ChannelId)

                if(!channel) {
                    console.log("No se encontro el canal con la ID", ChannelId)
                    await channel.permissionOverwrites.edit(everuser, {
                        SendMessages: valueSet
                      })
                }
            }

            if(valueSet) {
                    audiochannel.edit({name: "[🔓] Escuela Abierta"})
                    await sleep(6000)
                    ciudadAC.edit({name: "[🔓] Ciudad Abierta"})
            }else {
                    audiochannel.edit({name: "[🔐] Escuela Cerrada"})
                    await sleep(6000)
                     ciudadAC.edit({name: "[🔐] Ciudad Cerrada"})
            }

        }else {
            throw new Error("Esa categoria no existe")
            return false
        }
    } catch (e) {
        const embed = new EmbedBuilder()
        .setTitle("Ocurrio un error en una funcion.")
        .setDescription("```" + e + "```")
        .addFields(
            {name: "[📂] Archivo/Funcion", value: `**${fileName}**`},
            {name: "[🍶] Comando", value: `**/${interaction?.commandName || "Desconocido"}**`},
        )
        .setTimestamp();
        logsChannel.send({embeds: [embed], content: `${interaction.user}`})
        throw new Error("ocurrio un error al intentar actualizar los canales")
    }

        

}