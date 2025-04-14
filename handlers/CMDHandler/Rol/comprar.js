const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)

const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../config")
const updateInventario = require("../../../functions/updateInventario")

const bdobjeto = db2.collection("Objetos_globales")


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
    const objetoSelect = interaction.options.getString("objeto")
    const cantidad = interaction.options.getNumber("cantidad")
    const [region, idob] = objetoSelect.split("_")
    const objetoID = Number(idob)

    const objeto = await bdobjeto.findOne({_id: region, "Objetos.ID": objetoID}, {projection: {_id: 0,"Objetos.$": 1}}).then(obj => obj.Objetos[0])


    if(!objeto) {
        return interaction.reply({content: `El objeto con la ID: ${objetoSelect} no existe (╥﹏╥)`, ephemeral: true})
    }
    const newLumens = (objeto.precio * cantidad)

    if(objeto?.inStore === false) {
        return interaction.reply({content: `El objeto **${objeto.Nombre}** no esta disponible para la compra`, ephemeral: true})
    } 

    if(character.Dinero < (objeto.precio * cantidad)) {
        return interaction.reply({content: "No tienes suficiente **`Lumens`** para comprar **``" + `${objeto.Nombre} x ${cantidad}` + "``** \n" +
        "-# Te hacen falta **``" + `${Math.max(0, newLumens - character.Dinero)}` + " Lumens``** ", ephemeral: true})
    }

    if(objeto.Cantidad < cantidad && objeto.Cantidad !== null) {
        return interaction.reply({content: `No hay suficiente stock de **${objeto.Nombre}** para comprar **${cantidad}** unidades`, ephemeral: true})
    }

    if(cantidad >= objeto?.maxStock) {
        return interaction.reply({content: `No puedes comprar mas de **${objeto.maxStock}** unidades de **${objeto.Nombre}**`, ephemeral: true})
    }

   

    comprarObjeto()
    

    async function comprarObjeto() {
        await characters.updateOne({_id: interaction.user.id}, {
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

        const objdata = {
            ID: objetoID,
            Region: region,
            cantidad: cantidad,
            isItem: true,
        }

        await updateInventario(interaction,interaction.user.id, character.ID, objdata)

        const embed = new EmbedBuilder() 
        .setTitle("Muchas gracias por tu compra")
        .setDescription(`Has comprado **${objeto.Nombre} x ${cantidad}** por **${newLumens} Lumens**`)
        .setColor("Green")

        interaction.reply({embeds: [embed]})

        
        }
    }

}