const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)

const clientdb = require("../../../Server")
const db2 = clientdb.db("Rol_db")
const version = require("../../../config")

const bdobjeto = db2.collection("Objetos_globales")


module.exports =  {
  requireCharacter: false,
  requireSoul: false,
  requireCharacterCache: false,
  isDevOnly: false,
  enMantenimiento: false,
  requireEstrict: {
      Soul: false,
      Character: false,
      Cachepj: false
  },

  /**
   * 
   * @param {Client} client 
   * @param {ChatInputCommandInteraction} interaction 
   */


    ejecutar: async(client, interaction) => {
    const limite = 15;
    const objetos = await bdobjeto.aggregate([
        { $unwind: "$Objetos" },
        { $match: { "Objetos.inStore": true } },
        { $sort: { "Objetos.ID": 1 } },
        {
          $project: {
            _id: 0,
            ID: "$Objetos.ID",
            Nombre: "$Objetos.Nombre",
            Precio: "$Objetos.precio",
            Rareza: "$Objetos.Rareza",
            Cantidad: "$Objetos.Cantidad",
          }
        }
      ]).toArray();



      
      const lista = objetos.map(obj => 
        "`" +`[${obj.ID}]` + "`"  +` **${obj.Nombre}**` +` | **Precio:** ${obj.Precio} <a:Lumens:1335709991130103910>`
      ).join("\n\n");
      console.log(lista)
    const row = new ActionRowBuilder()
    const tienda = new EmbedBuilder()
    .setTitle("Tienda de objetos")
    .setDescription("Puedes comprar objetos usando el comando `/rol comprar <ID>`")
    .addFields(
        {name: "Objetos disponibles", value: `\n${lista}`}
    )
    .setThumbnail("https://res.cloudinary.com/dn1cubayf/image/upload/f_auto,q_auto/gvdOEEvE_nqgkr7")
    .setColor("Yellow")
    .setFooter({text: `Pagina 1`})

    interaction.reply({embeds: [tienda]})

    
    }
}
