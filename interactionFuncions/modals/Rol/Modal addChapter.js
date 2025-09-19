const {ChatInputCommandInteraction, ModalBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Client, Embed} = require("discord.js")
const clientdb = require("../../../Server");
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const dbconfig = db.collection("usuarios_server")
const { v4: uuidv4} = require('uuid');
const updateInventario = require("../../../functions/updateInventario");
const cloudinary = require("cloudinary").v2

module.exports = {
    customId: "Creator_history",

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction) => {
        const title = interaction.fields.getTextInputValue("Title")
        const Historia = interaction.fields.getTextInputValue("Historia")
        const img = interaction.fields.getTextInputValue("Imagen")
        const personaje = await character.findOne({_id: interaction.user.id})
        const pincel = personaje.Inventario.find(i => i.ID === 120 && i.Region === "TOB-01")

        async function isValidImage(imgURL) {
            const xprsn = /^https?:\/\/.*\.(?:png|jpe?g|svg|webp|gif)(\?.*)?$/i;
  
            console.log(imgURL)
  
            if(!xprsn.test(imgURL)) {
              console.log("test:", xprsn.test(imgURL))
              return false;
            }
  
            try {
              const response = await fetch(imgURL, { method: 'HEAD'});
  
              const contentType = response.headers.get('content-type')
              return response.ok && contentType && contentType.startsWith('image/')
              
            } catch (e) {
              console.log(e)
              return false
          }
        }
  
        if(img) {
            if(await isValidImage(img) === false) {
              return interaction.editReply({ content: "Tu link parece no ser valido, verifica que contenga una imagen valida. Si tienes dudas revisa el foro <#1330769969428041822>", ephemeral: true})
            }
        }

        if(!pincel || pincel?.Cantidad < 1) return interaction.reply({content: "No se puede agregar un capitulo porque no tienes suficientes `Pincel Magico` ＞﹏＜", flags: "Ephemeral"})
        const totalHistorias = personaje?.Capitulos?.length || 0;

        // Asignar campos automáticos
        const total = totalHistorias + 1;

        const transacciónId = uuidv4().replace(/-/g, "")
        const data = {
            ID: transacciónId,
            NumeroCapitulo: total,
            Orden: null,
            Titulo: title,
            Historia: Historia,
            Imagen: img || null,
            Pin: false,
            Visibilidad: true,
            Etiquetas: [],
            FechaCreacion: new Date().toISOString(),
            UltimaEdicion: new Date().toISOString(),
        }


        await character.updateOne({_id: interaction.user.id}, 
            {
                $push: {"Capitulos": data},
            }
        )

        let objData = {
            ID: 120,
            Region: "TOB-01",
            cantidad: -1,
            isItem: true,
            typeLoot: null
        }

        await updateInventario(client, interaction, personaje.ID, objData)

        const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(Historia)
        .setThumbnail(img || null)
        .setFooter({text: "Para ver los cambios actualiza el embed"})
        .setColor("Green")
        .setTimestamp()

        return interaction.reply({content: "Se asigno correctamente el capitulo al perfil de tu personaje", embeds: [embed], flags: "Ephemeral"})



    }
}