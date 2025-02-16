const Discord = require("discord.js");
const clientdb = require("../Server")
const db2 = clientdb.db("Rol_db")
const personajes = db2.collection("Personajes")
const transaccionCache = require("../utils/cache")
const dbobjetos = db2.collection("Objetos_globales")
            /**
             * 
             * @param {Discord.client} client
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



module.exports = async(interaction, user, characterId, objid, Region, cantidad) => {
    const personaje = await personajes.findOne({ID: characterId})
    const objinfoa = await dbobjetos.findOne({_id: Region, "Objetos.ID": objid}, {projection: {_id: 0,"Objetos.$": 1}})
    const objinfo = objinfoa.Objetos[0]



    if(!objinfoa) {
        throw new Error("El objeto que intentas agregar no existe. Es posible que se trate de un objeto eliminado")
    } 

    const objfind = personaje.Inventario.find(obj => obj.ID === objinfo.ID)


    if(objfind) {
                await personajes.updateOne({
                    ID: characterId,
                    "Inventario.ID": objinfo.ID
                }, {
                    $inc: {
                        "Inventario.$.Cantidad": cantidad
                    }
                })
            }else {
                await personajes.updateOne({ID: characterId}, {
                    $push: {
                        Inventario: {
                            ID: objinfo.ID,
                            Region: `${Region}`,
                            Nombre: `${objinfo.Nombre}`,
                            Cantidad: cantidad,
                            Fecha: new Date().toISOString()
                        }
                    }
                })
            }

        return "Completado";
}
