const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, } = require(`discord.js`)
const Discord = require("discord.js");
const clientdb = require("../Server")
const db2 = clientdb.db("Rol_db")
const personajes = db2.collection("Personajes")
const souls = db2.collection("Soul")
const transaccionCache = require("../utils/cache");
const getXPSoul = require("./getXPSoul.js");
const levelsEmitter = require("./emitterShuciika.js");
const dbobjetos = db2.collection("Objetos_globales")
            /**
             * 
             * @param {Client} client
             * @param {Discord.CommandInteraction} interaction
             * 
             * 
             */

/*  
"InteractionFriends": 1,
"InteractionCouple": 2,
"InteractionFriendly": 3,
"InteractionNeutral": 4
//** */



module.exports = async(client, interaction, characterId, data) => {
    const personaje = await personajes.findOne({$or: [
        { ID: characterId},
        {_id: characterId}
    ]})
    const objinfoa = await dbobjetos.findOne({_id: data.Region, "Objetos.ID": data.ID}, {projection: {_id: 0,"Objetos.$": 1}})
    const objinfo = objinfoa?.Objetos?.[0]



    if(!data.isItem) {
        if(data.typeLoot === "lumens") {
            if(isNaN(data.cantidad)) return `Hubo un error al asignar este valor: ${data.cantidad} - No es un numero`

            await personajes.updateOne({ID: personaje.ID}, {
                $inc: {
                    Dinero: data.cantidad
                }
            })
        }else if(data.typeLoot === "xp") {
            if(isNaN(data.cantidad)) return `Hubo un error al asignar este valor: ${data?.cantidad} - No es un numero`

            const messageXP = await getXPSoul(interaction, characterId, data.cantidad)

            
            if(messageXP) {

                levelsEmitter.emit('levelUp', client, interaction, personaje, messageXP)

                return {message: "`Felicidades, tu personaje ha subido de nivel`", embed: messageXP}
            } 


        }else {
            return `No se ha asignado ningun valor, parece ser que este objeto no corresponde a nada: ${typeLoot}`
        }

    return `Se ha asignado correctamente: ${data.typeLoot} - ${data.cantidad} - ${characterId}`
    }

    if(!objinfoa) {
        const channel = client.channels.cache.get("716518718947065868")

        const embedError = new EmbedBuilder()
        .setTitle("Error al agregar un objeto")
        .setDescription(`El objeto que intentas agregar no existe. Es posible que se trate de un objeto eliminado`)
        .addFields(
            {name: "Objeto?", value: `ID: ${data.ID}\nRegion: ${data.Region}\nEs un... ${data.isItem ? "Objeto" : data.typeLoot}`, inline: true},
            {name: "Cantidad", value: `${data.cantidad}`, inline: true},
            {name: "Personaje", value: `[${personaje.ID}] ${personaje.Nombre}`, inline: true},
            {name: "Resultado (objeto.Nombre)", value: `${objinfo?.Nombre}`, inline: true}
        )
        console.log("Objeto no encontrado", objinfoa)

        return channel.send({embeds: [embedError]})
    } 

    let objfind

    if(typeof data.instanciaID !== "undefined") {
        objfind = personaje.Inventario.find(obj => obj.instanciaID === data.instanciaID && obj.Region === data.Region)
    }else {
        objfind = personaje.Inventario.find(obj => obj.ID === data.ID && obj.Region === data.Region);
    }


    let IDdef = data.instanciaID ? data.instanciaID : data.ID
    let Select = data.instanciaID ? `instanciaID` : `ID`


    try {

        if(data?.isMailContent && data?.instanciaID) {
            await personajes.updateOne({ ID: personaje.ID}, {
                $push: {
                    Inventario: {
                        ...data.itemComplet
                    }
                }
            })

            return { success: true, messages: "Se ha agregado el regalo correctamente"}
        }


        if(objfind) {
            console.log(objfind, data.instanciaID)
            await personajes.updateOne({ ID: personaje.ID, Inventario: {$elemMatch: {[`${Select}`]: IDdef, Region: objfind.Region }}}, {
                $inc: {
                    "Inventario.$.Cantidad": data.cantidad
                }
            })
        }else{
            if(data.instanciaID) {
                console.log("InstanciaId")
                await personajes.updateOne({ID: personaje.ID}, {
                    $push: {
                        Inventario: {
                            ID: objinfo.ID,
                            Region: `${objinfo.Region}`,
                            Nombre: `${objinfo.Nombre}`,
                            Cantidad: data.cantidad,
                            Fecha: new Date().toISOString()
                        }
                    }
                })
            }else {
                
                await personajes.updateOne({ID: personaje.ID}, {
                    $push: {
                        Inventario: {
                            ID: objinfo.ID,
                            Region: `${objinfo.Region}`,
                            Nombre: `${objinfo.Nombre}`,
                            Cantidad: data.cantidad,
                            Fecha: new Date().toISOString()
                        }
                    }
                })
            }


        }

    await personajes.updateOne(
    { ID: personaje.ID },
    { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
    );

    console.log("Inventario actualizado")

    return {success: true, messages: "Inventario actualizado correctamente"}

    } catch (error) {

    console.error(error)
    const channel = client.channels.cache.get("716518718947065868")

    const embedError = new EmbedBuilder()
    .setTitle("Error al agregar un objeto")
    .setDescription("```" + error + "```")
    .addFields(
        {name: "Objeto?", value: `ID: ${data.ID}\nRegion: ${data.Region}\nEs un... ${data.isItem ? "Objeto" : data.typeLoot}`, inline: true},
        {name: "Cantidad", value: `${data.cantidad}`, inline: true},
        {name: "Personaje", value: `[${personaje.ID}] ${personaje.Nombre}`, inline: true},
        {name: "Resultado (objeto.Nombre)", value: `${objinfo?.Nombre}`, inline: true}
    )

    channel.send({embeds: [embedError]})

    return {success: false, messages: "No se pudo actualizar el inventario"}

    }




}
