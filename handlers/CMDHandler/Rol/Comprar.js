const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)

const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const version = require("../../../config")
const updateInventario = require("../../../functions/updateInventario")

const bdobjeto = db2.collection("Objetos_globales")

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const objetoSelect = interaction.options.getString("objeto")
    const cantidad = interaction.options.getNumber("cantidad")
    const [region, idob] = objetoSelect.split("_")
    const objetoID = Number(idob)

    const personaje = await character.findOne({_id: interaction.user.id})    
    const objeto = await bdobjeto.findOne({_id: region, "Objetos.ID": objetoID}, {projection: {_id: 0,"Objetos.$": 1}}).then(obj => obj.Objetos[0])

    if(!personaje) {
        return interaction.reply({content: "No tienes un personaje registrado (╥﹏╥).\n-# Puedes crear una ficha usando el comando `/rol crear_ficha`", ephemeral: true})
    }

    if(!objeto) {
        return interaction.reply({content: `El objeto con la ID: ${objetoSelect} no existe (╥﹏╥)`, ephemeral: true})
    }

    console.log(objeto)
    const newLumens = (objeto.precio * cantidad)

    if(objeto?.inStore === false) {
        return interaction.reply({content: `El objeto **${objeto.Nombre}** no esta disponible para la compra`, ephemeral: true})
    } 

    if(personaje.Dinero < (objeto.precio * cantidad)) {
        return interaction.reply({content: "No tienes suficiente **`Lumens`** para comprar **``" + `${objeto.Nombre} x ${cantidad}` + "``** \n" +
        "-# Te hacen falta **``" + `${Math.max(0, newLumens - personaje.Dinero)}` + " Lumens``** ", ephemeral: true})
    }

    if(objeto.Cantidad < cantidad && objeto.Cantidad !== null) {
        return interaction.reply({content: `No hay suficiente stock de **${objeto.Nombre}** para comprar **${cantidad}** unidades`, ephemeral: true})
    }

    if(cantidad >= objeto?.maxStock) {
        return interaction.reply({content: `No puedes comprar mas de **${objeto.maxStock}** unidades de **${objeto.Nombre}**`, ephemeral: true})
    }

   

    comprarObjeto()
    

    async function comprarObjeto() {
        await character.updateOne({_id: interaction.user.id}, {
            $inc: {
                Dinero: -newLumens
            }
        })

        if(objeto.Cantidad) {
            await bdobjeto.updateOne({_id: region, "Objetos.ID": objetoID}, {
                $inc: {
                    "Objetos.$.Cantidad": -cantidad
                }
            })
        }

        await updateInventario(interaction,interaction.user.id, personaje.ID, objetoID, region, cantidad)

        const embed = new EmbedBuilder() 
        .setTitle("Muchas gracias por tu compra")
        .setDescription(`Has comprado **${objeto.Nombre} x ${cantidad}** por **${newLumens} Lumens**`)
        .setColor("Green")

        interaction.reply({embeds: [embed]})

        
    }
}