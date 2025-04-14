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


module.exports = {
     customId: "regalar",
     buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

     ejecutar: async(client, interaction, actions, cacheId) => {
        const cacheObj = transaccionCache.get(cacheId)
        console.log(actions)

       await interaction.deferReply({flags: "Ephemeral"})

        if(!cacheObj) return interaction.editReply({content: "Esta interacción ya no es valida ＞﹏＜\n-# Vuelve a usar el comando", ephemeral: true})

        const character = await characters.findOne({_id: interaction.user.id})

        if(!character) return interaction.editReply({content: "No se ha podido encontrar este personaje, seguramente debido a un error... ＞﹏＜", ephemeral: true})

        let itemInventario;
        

        if(typeof cacheObj.objData.instanciaID !== "undefined") {
          itemInventario = character.Inventario.find(item => item.instanciaID = cacheObj.objData.instanciaID && item.Region === cacheObj.objData.Region)
        }else {
          itemInventario = character.Inventario.find((item) => item.ID === cacheObj.objData.ID && item.Region === cacheObj.objData.Region);
        }


        if(!itemInventario || itemInventario.Cantidad < cacheObj.cantidad) {
            interaction.editReply({content: 
            "El objeto que intentas regalar ya no esta en tu inventario o la cantidad es insuficiente\n-# Vuelve a usar el comando o verifica que no hayas usado antes el objeto", ephemeral: true
            })

            cacheObj.message.editReply({components: []}).catch(e => e)
            transaccionCache.delete(cacheId)
            transaccionCache.deleteUser(interaction.user.id)
            return
        }

        if(actions === "rechazar") {
            interaction.editReply({content: "Haz cancelado esta operación X﹏X\n-# Vuelve a usar el comando si cambias de opinion", ephemeral: true})
            cacheObj.message.editReply({components: []})
            transaccionCache.delete(cacheId)
           return transaccionCache.deleteUser(interaction.user.id)
        }

        try {
          let objetoData = null

          if(cacheObj.objData.instanciaID) {
            const nombreConUUID = cacheObj.objData.Nombre.replace(/\[Crafteado-\w+\]/, `[Regalo-${cacheObj.objData.instanciaID.substring(0, 5)}]`);

            objetoData = {
              instanciaID: cacheObj.objData.instanciaID,
              ID: cacheObj.objData.ID,
              Region: cacheObj.objData.Region,
              Nombre: nombreConUUID,
              Cantidad: 1,
              Metadata: {
                items: cacheObj.objData.Metadata.items,
                restricciones: {
                  ...cacheObj.objData.Metadata.restricciones,
                  intercambiable: false,
                }
              },
              Fecha: cacheObj.objData.Fecha,
            }
          }


          if(!objetoData?.instanciaID) {
            objetoData = {
              ID: cacheObj.objData.ID,
              Region: cacheObj.objData.Region,
              Cantidad: cacheObj.cantidad,
              Fecha: new Date().toISOString()
            } 
          }


            const data = {
                personaje: character,
                date: Date.now(),
                tipo: cacheObj.objData?.bagData?.type || "Otro",
                titulo: cacheObj.objData?.Metadata?.Titulo, 
                mensaje: {
                    texto: cacheObj.objData?.Metadata?.Mensaje || null,
                    adjuntos: cacheObj.objData?.Metadata?.Attachments || null,
                },
                contenido: [
                    {
                       ...(objetoData)
                    }
                ],
                fechaEnvio: Date.now(),
                expiracion: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
                personajeSend: cacheObj.IDcharacter
            }

            const Params = {
                instanciaID: cacheObj.objData.instanciaID,
                ID: cacheObj.objData.ID,
                Region: cacheObj.objData.Region,
                cantidad: -cacheObj.cantidad,
                isItem: true,
                typeLoot: null
            }

            await updateInventario(client, interaction, interaction.user.id, Params)

            await mailSystem.enviarCorreo(data)

    
            const embed = new EmbedBuilder()
            .setTitle("Se ha enviado correctamente el objeto")
            .setDescription("**`"+ `${cacheObj.objData.Nombre} x (${cacheObj.cantidad})` + "`** fue enviado correctamente al buzón de **`" + cacheObj.characterName + "`**")
            .setColor("Green")
            .setTimestamp()
            .setImage("https://c.tenor.com/PSgHvjUYpKgAAAAC/tenor.gif")

            transaccionCache.delete(cacheId)
            transaccionCache.deleteUser(interaction.user.id)
    
            cacheObj.message.editReply({embeds: [embed], components: []}).catch(e => {
                return interaction.editReply({embeds: [embed]})
            })

            interaction.editReply({content: "Se ha enviado correctamente el objeto"})



        } catch (error) {
            console.log(error)
            interaction.editReply({content: "Ocurrio un error al intentar enviar los objetos al personaje..."})
        }

     } 
}