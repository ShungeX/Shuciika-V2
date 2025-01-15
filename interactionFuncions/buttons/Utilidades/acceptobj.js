const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")
const transaccionCache = require("../../../utils/cache")

module.exports = {
    customId: "acceptobj",
    buttonAuthor: true,

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, characterId, extras) => {
        const objinfo = transaccionCache.get(extras)
        const personaje = await character.findOne({ID: characterId})

        if(!objinfo) {
            return interaction.reply({content: "La transaccion ha expirado. vuelve a usar el comando", ephemeral: true})
        }

        const objfind = personaje.Inventario.find(obj => obj.ID === objinfo.objId)

        if(objfind) {
            await character.updateOne({
                ID: characterId,
                "Inventario.ID": objinfo.objId
            }, {
                $inc: {
                    "Inventario.$.Cantidad": objinfo.cantidad
                }
            })
        }else {
            await character.updateOne({ID: characterId}, {
                $push: {
                    Inventario: {
                        ID: objinfo.objId,
                        Nombre: `${objinfo.objname}`,
                        Cantidad: objinfo.cantidad,
                        Fecha: objinfo.fecha
                    }
                }
            })
        }
        interaction.update({content: `Se ha agregado el objeto correctamente al inventario de ${personaje.Nombre}`, embeds: [], components: []})
        transaccionCache.delete(extras)
        
    }
}