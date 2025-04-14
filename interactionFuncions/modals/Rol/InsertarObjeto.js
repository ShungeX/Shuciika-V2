const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const objetos = db2.collection("Objetos_globales")
const transaccionCache = require("../../../utils/cache")
const { duelSystem } = require("../../../functions/duelManager")
const { v4: uuidv4} = require('uuid')
const { crearInventario } = require("../../selectMenus/Rol/CraftMenu")
const { guardarBolsa, bagHome, actualizarRestricciones } = require("../../../handlers/CMDHandler/Rol/craftear")


module.exports = {
    customId: "CraftModals",

    ejecutar: async(client, interaction, cache, items, correct,{ character }) => {
        const getCache = transaccionCache.get(cache)

        if(!getCache) return interaction.reply({content: "Esta interacción ya expiró 〒▽〒\n-# Vuelve a usar el comando (Esto ocurre si usaste otra vez el comando o pasó más de 3h)", ephemeral: true})
        const [ID, reg] = items.split("*")
        const Region = `${reg}-${correct}`

        if(ID === "Titulo") {
            const titulo = interaction.fields.getTextInputValue("Titulo")
            getCache.bagContent.Titulo = titulo 
            await guardarBolsa(interaction, getCache, 0, null, character, null, titulo)
            await bagHome(interaction, cache)
            await interaction.reply({content: `-# Se agrego correctamente el titulo`, flags: "Ephemeral"})
            return;
        };

        if(ID === "Mensaje") {
            const message = interaction.fields.getTextInputValue("Mensaje")
            getCache.bagContent.mensaje = message 
            await guardarBolsa(interaction, getCache, 0, null, character, message)
            await bagHome(interaction, cache)
            await interaction.reply({content: `-# Se agrego correctamente el mensaje`, flags: "Ephemeral"})
            return;
        };


        const cantidadString = interaction.fields.getTextInputValue("Cantidad")
        const cantidad = Number(cantidadString)

        if(isNaN(cantidad)) return interaction.reply({content: "Debes responder esta opcion con un numero 〒▽〒\n-# Tu respuesta: **`" + cantidadString + "`**"})

        const cantidadS = character.Inventario.find((obj) => obj.ID == ID && obj.Region === Region)

        console.log("ItemData", getCache.bagContent)

        if(cantidadS?.Cantidad < cantidad || !cantidadS) return interaction.reply({content: "No tienes la cantidad suficiente para dar este objeto 〒▽〒\n-# Tienes: **`" + 
            cantidadS?.Cantidad + "`**, y quieres enviar: **`" + cantidad + "`**", ephemeral: true 
        })

        
        const item = await duelSystem.getObjetInfo(Region, ID)

        let pesoTotal =  getCache.bagContent.pesoTotal + ((item.atributos?.peso || 1) * cantidad)

        if(pesoTotal > getCache.bagContent.Capacidad) return interaction.reply({content: "**`" + getCache.bagContent.Nombre + "`** No tiene la capacidad suficiente para almacenar el peso de tantos objetos\n" + 
            `-# Los objetos que agregaste son muy pesados, verifica el peso y vuelve a intentarlo`, flags: "Ephemeral"})

        const index = getCache.bagContent.items.findIndex(i => i.ID === item.ID && i.Region === item.Region);


        if(index !== -1) {
            getCache.bagContent.items[index].Cantidad += cantidad;
        }else {
            const itemData = {
                Nombre: item.Nombre,
                ID: item.ID,
                Region: item.Region,
                Cantidad: cantidad
            }

            getCache.bagContent.items.push(itemData)
        }

        const getRestrictions =  actualizarRestricciones(getCache.bagContent.restricciones, item.restricciones)

        getCache.bagContent.restricciones = getRestrictions

        getCache.bagContent.pesoTotal = pesoTotal 
        

        await guardarBolsa(interaction, getCache, cantidad, item, character)
        await crearInventario(interaction, interaction.user.id, cache, character)
        await interaction.reply({content: `-# Se agregó **${item.Nombre} x ${cantidad}**`, flags: "Ephemeral"})
    }
}