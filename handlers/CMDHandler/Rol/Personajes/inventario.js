const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../../config")
const interfazCreate = require("../../../../functions/interfazCreate")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("inventario")
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
                .setDescription("**Aquí todavía no habita nada.**\n-# ¿Porque no intentas comprar o llenarla al explorar? </rol:1334751557375230033> ( •̀ ω •́ )✧")
                .setColor("Red")
            return interaction.reply({ embeds: [embed], flags: ["Ephemeral"] })
        }

        const JSON = interfazCreate.inventarioMensaje(interaction, character, 1, ["fullbag"])


        return interaction.reply({components: JSON, flags: ["IsComponentsV2", "SuppressNotifications"]})
    }

}