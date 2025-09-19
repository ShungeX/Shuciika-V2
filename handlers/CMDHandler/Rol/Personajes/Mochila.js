const { EmbedBuilder,ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../../config")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("mochila")
        .setDescription("Muestra el contenido de tu inventario"),

    requirements: {
        character: { obtener: true, required: true },
        soul: { obtener: false, required: false },
        cachepj: { obtener: false, required: false },
    },
    isDevOnly: false,
    enMantenimiento: false,


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */


    ejecutar: async (client, interaction, { character }) => {

        if (character.economia.Inventario.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription("**Tu mochila esta vacia**\n-# ¿Porque no intentas comprar o llenarla al explorar? </rol:1334751557375230033> ( •̀ ω •́ )✧")
                .setColor("Red")
            return interaction.reply({ embeds: [embed], ephemeral: true })
        }

        const objetos = character.Inventario.map(obj =>
            "`" + `[${obj.ID}]` + "`" + `- **${obj.Nombre}** *x ${obj.Cantidad}*`
        ).slice(0, 15)


        const embed = new EmbedBuilder()
            .setTitle(`Mochila de ${character.Nombre}`)
            .setDescription("**Estos objetos te acompañan en tu aventura**\n\n" + objetos.join("\n"))
            .setColor("Green")
            .setFooter({ text: `Tienes ${character.Inventario.length} objetos. Pagina 1 de 1` })
        return interaction.reply({ embeds: [embed] })
    }

}