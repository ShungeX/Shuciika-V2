const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, time} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const userdb = db.collection("usuarios_server")
const updateInventario = require("../../../functions/updateInventario")


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
    const usuario = await userdb.findOne({_id: interaction.user.id}) 
    const getTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    const timeActual = usuario?.Recompensa_diaria?.Fecha || 0
    const timeReal = usuario?.Recompensa_diaria?.LastInteraction || Math.floor(Date.now() / 1000)
    const timeDay = Math.floor(Date.now() / 1000)
    const racha = usuario?.Recompensa_diaria?.Racha || 0
    const bonus = Math.floor((racha / 7) * 16) 
    const verifracha = timeDay - timeReal
    var message;
    var messageFooter;


    if(getTime - timeActual < 86400) {
        return interaction.reply({content: "Ya has reclamado tu recompensa diaria. Vuelve " + `<t:${timeActual}:R>`, ephemeral: true})
    }

    console.log(verifracha)

    if((verifracha >= (176400)) && (racha > 1)) {
        message = "Has recibido un `[320] Cofre del Aprendiz`\n-# Has perdido tu racha de recompensas diarias. ＞﹏＜"
        messageFooter = "No te preocupes, puedes volver a iniciar otra racha"
        await userdb.updateOne({_id: interaction.user.id}, {
            $set: {
                "Recompensa_diaria.Racha": 0
            }
        })
    } else {
        message = racha > 1 ? "Has recibido un `[320] Cofre del Aprendiz`\nAdemas por tu perseverancia has obtenido un extra de`" + bonus + "` lumens"  
        : "Has recibido un `[320] Cofre del Aprendiz`" 
        messageFooter = "¡Sigue asi! (✿◡‿◡)"
    }


    if(racha > 1) {
        characters.updateOne({_id: interaction.user.id}, {
            $inc: {
                Dinero: bonus
            }
        })
    }



    const embed = new EmbedBuilder()
    .setTitle("Recompensa diaria")
    .setDescription(message)
    .addFields(
        {name: "Racha actual", value: `${racha + 1}`, inline: true},
        {name: "Proxima recompensa", value: `<t:${getTime}:R>`, inline: true}
    )
    .setThumbnail("https://res.cloudinary.com/dn1cubayf/image/upload/v1738637289/Rol/Assets/snhze7wiigf85hsq1ikc.jpg")
    .setFooter({text: messageFooter})
    .setColor("DarkPurple")


    try {
        const objData = {
            ID: 320,
            Region: "TOB-01",
            cantidad: 1,
            isItem: true
        }

        await updateInventario(client, interaction, interaction.user.id, objData)

        await userdb.updateOne({_id: interaction.user.id}, {
            $set: {
                "Recompensa_diaria.Fecha": getTime,
                "Recompensa_diaria.LastInteraction": timeDay
            },
            $inc: {
                "Recompensa_diaria.Racha": 1,
            }
        }, {upsert: true});
    
        interaction.reply({embeds: [embed]})
    } catch (error) {
        console.log(error)
        interaction.reply({content: "No se ha podido reclamar la recompensa diaria. Contacta con un administrador" + error, ephemeral: true})
    }
    


    }
}