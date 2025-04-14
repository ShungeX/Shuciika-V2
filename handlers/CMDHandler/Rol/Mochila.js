const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../config")


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

    if(!character.Inventario) {
        await characters.updateOne({_id: interaction.user.id}, {
            $set: {Inventario: []}
        })
        console.log("Estableciendo inventario...")

        const embed = new EmbedBuilder()
        .setDescription("Tu mochila esta vacia\n-# ¿Porque no intentas comprar algo? ( •̀ ω •́ )✧")
        .setColor("Red")
        .setFooter({text: "-#¿Porque no intentas comprar algo? ( •̀ ω •́ )✧"})
        return interaction.reply({embeds: [embed], ephemeral: true})
    }

    if(character.Inventario.length === 0) {
        const embed = new EmbedBuilder()
        .setDescription("**Tu mochila esta vacia**\n-# ¿Porque no intentas comprar o llenarla? ( •̀ ω •́ )✧")
        .setColor("Red")
        return interaction.reply({embeds: [embed], ephemeral: true})
    }

    const objetos = character.Inventario.map(obj => 
        "`"+ `[${obj.ID}]` + "`" + `- **${obj.Nombre}** *x ${obj.Cantidad}*`
    ).slice(0, 15)


    const embed = new EmbedBuilder()
    .setTitle(`Mochila de ${character.Nombre}`)
    .setDescription("**Estos objetos te acompañan en tu aventura**\n\n" + objetos.join("\n"))
    .setColor("Green")
    .setFooter({text: `Tienes ${character.Inventario.length} objetos. Pagina 1 de 1`})
    return interaction.reply({embeds: [embed]})
    }

}