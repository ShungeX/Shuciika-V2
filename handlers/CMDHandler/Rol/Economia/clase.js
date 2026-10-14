const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)

const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../../config")
const updateInventario = require("../../../../functions/updateInventario")

const bdobjeto = db2.collection("Objetos_globales")

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("menu_clases")
        .setDescription("visualiza el menu de clases del rol"),


    requireCharacter: true,
    requireSoul: true,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: true,
        Character: true,
        Cachepj: false
    },


    /**
 * 
 * @param {Client} client 
 * @param {ChatInputCommandInteraction} interaction 
 */

    ejecutar: async(client, interaction, { character}) => {
        const menuJSOn = []
    }


}