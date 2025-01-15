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
    const personaje = await character.findOne({_id: interaction.user.id})
    const cachepj = await Cachedb.findOne({_id: interaction.user.id})

    if(cachepj) {
        return interaction.reply({ content: "Tu personaje aun no esta verificado, se paciente ＞﹏＜", ephemeral: true})
    }else if(!personaje && !cachepj) {
        return interaction.reply({ content: "¡Aun no tienes un personaje!. ☆⌒(>。<)\n-# ¿Porque no intentas crear una ficha usando /rol crear_ficha" , ephemeral: true})
    }

    if(!personaje.Inventario) {
        await character.updateOne({_id: interaction.user.id}, {
            $set: {Inventario: []}
        })
        console.log("Estableciendo inventario...")

        const embed = new EmbedBuilder()
        .setDescription("Tu mochila esta vacia\n-# ¿Porque no intentas comprar algo? ( •̀ ω •́ )✧")
        .setColor("Red")
        .setFooter({text: "-#¿Porque no intentas comprar algo? ( •̀ ω •́ )✧"})
        return interaction.reply({embeds: [embed], ephemeral: true})
    }

    if(personaje.Inventario.length === 0) {
        const embed = new EmbedBuilder()
        .setDescription("**Tu mochila esta vacia**\n-# ¿Porque no intentas comprar o llenarla? ( •̀ ω •́ )✧")
        .setColor("Red")
        return interaction.reply({embeds: [embed], ephemeral: true})
    }

    const objetos = personaje.Inventario.map(obj => 
        "`"+ `[${obj.ID}]` + "`" + `- **${obj.Nombre}** *x ${obj.Cantidad}*`
    ).slice(0, 15)


    const embed = new EmbedBuilder()
    .setTitle(`Mochila de ${personaje.Nombre}`)
    .setDescription("**Estos objetos te acompañan en tu aventura**\n\n" + objetos.join("\n"))
    .setColor("Green")
    .setFooter({text: `Tienes ${personaje.Inventario.length} objetos. Pagina 1 de 1`})
    return interaction.reply({embeds: [embed]})
}