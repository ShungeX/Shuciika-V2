const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, channelLink} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const soul = db2.collection("Soul")

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


module.exports = async(client, interaction) => {
    const message = interaction.options.getString("mensaje")
    const idcharacter = interaction.options.getNumber("personaje")
    const personaje = await character.findOne({_id: interaction.user.id})
    const destinatario = await character.findOne({ID: idcharacter})
    const channel = await interaction.guild.channels.cache.get("717139454631870494")



    if(!personaje) {
        return interaction.reply({content: `Todavia no tienes un personaje. -# ¿Por qué no intentas crearte uno?, usa el comando /rol crear_ficha`, ephemeral: true})
    }

    if(!message) {
        return interaction.reply({content: "Parece que no has escrito nada. ¡No puedo enviar una carta vacia! （︶^︶）", ephemeral: true})
    }

    if(!channel) {
        return console.error("El canal de confesiones no existe o no es valido")
    }


    if(destinatario) {
        enviarbuzon()
    }else {
        enviarconfesion()
    }

    async function enviarconfesion() {
        const embed = new EmbedBuilder()
        .setTitle("Nueva confesion 💌")
        .setDescription(`${message}`)
        .setColor("Random")
        .setThumbnail("https://i.pinimg.com/736x/f2/79/47/f27947de21ace726318164fd6d63f75f.jpg")

        channel.send({embeds: [embed]})
        interaction.reply({content: "Envie tu confesion al canal <#717139454631870494>. (Recuerda esta confesión es anonima)", ephemeral: true})
    }

    async function enviarbuzon() {
        return interaction.reply("Comando en construcción")
        console.log("Enviando a buzon de personaje")

        await character.updateOne({ID: character}, {
            $push: {
                buzon: [
                    {
                        author: personaje.ID || "",
                        message: message,
                        fecha: "",
                        image: "",
                    }
                ]
            }
        })
    }

    
}