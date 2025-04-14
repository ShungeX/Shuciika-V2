const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, InteractionContextType, Embed, StringSelectMenuBuilder, Client} = require("discord.js")
const clientdb = require("../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const userdb = db.collection("usuarios_server")
const duelos = db2.collection("Duelos")
const objetos = db2.collection("Objetos_globales")
const hechizos = db2.collection("Hechizos_globales")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")
const version = require("../config")
const transaccionCache = require("../utils/cache")
const { v4: uuidv4} = require('uuid')
const getGifs = require("../functions/getGifs")
const util = require(`util`);
const sleep = util.promisify(setTimeout)

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Object} personaje 
     */


const { EventEmitter} = require("events")
class LevelsEmitter extends EventEmitter {}
const levelsEmitter = new LevelsEmitter();

levelsEmitter.setMaxListeners(10);

 


levelsEmitter.on('levelUp', async(client, interaction, personaje, levelUpEmbed) => {

    try {

        const channel = client.channels.cache.get("1351768577627394141")
        const dmChannel = await interaction.user.createDM().catch(() => false)

        if(dmChannel) {
            await dmChannel.send({embeds: [levelUpEmbed]}).catch(async (e) => {
                await channel.send({content: `${interaction.user}`,embeds: [levelUpEmbed]})
            })
        }


    } catch (e) {
        const channel = client.channels.cache.get("716518718947065868")
        console.log(e)

        const embedError = new EmbedBuilder()
        .setTitle("Error al enviar el mensaje de nivel")
        .setDescription("```" + e + "```")
        .addFields(
            {name: "Archivo", value: "emitterShuciika.js", inline: true}
        )
        .setColor("Red")
        .setTimestamp()

        return channel.send({embeds: [embedError]})
    }
});


module.exports = levelsEmitter