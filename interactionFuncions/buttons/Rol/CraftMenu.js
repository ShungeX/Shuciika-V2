const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const version = require("../../../config")
const { duelSystem } = require("../../../functions/duelManager")
const { mailSystem }  = require("../../../functions/mailManager")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const updateInventario = require("../../../functions/updateInventario")
const { bagHome } = require("../../../handlers/CMDHandler/Rol/craftear")

module.exports = {
    customId: "CraftMenu",
    buttonAuthor: true,

    ejecutar: async(client, interaction, actions, cacheId, page = 0, filter = "todos") => {
        const cacheObj = transaccionCache.get(cacheId)

        console.log(cacheId)
        console.log(actions)

        if(!cacheObj) return interaction.reply({content: "Esta interacción ya no es valida ＞﹏＜\n-# Vuelve a usar el comando", ephemeral: true})

        await interaction.reply({content: "Espera... ", flags: "Ephemeral", withResponse: true})


        if(actions === "itemsClose") {
            await bagHome(interaction, cacheId)
            interaction.deleteReply()
        }


    }
}