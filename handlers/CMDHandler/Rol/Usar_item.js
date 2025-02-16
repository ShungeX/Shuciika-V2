const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)

const clientdb = require("../../../Server")

const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const character = db2.collection("Personajes")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")



    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

module.exports = async(client, interaction) => {
    const value = interaction.options.getString("objeto_id")
    const [Region, idstring] = value.split("_")
    const idObjeto = Number(idstring) || value

    const personaje = await character.findOne({_id: interaction.user.id})
    const objinfoa = await dbobjetos.findOne({_id: Region, "Objetos.ID": idObjeto}, {projection: {_id: 0,"Objetos.$": 1}})


    if(!personaje){
        return interaction.reply({content: "No tienes un personaje registrado (╥﹏╥).\n-# Puedes crear una ficha usando el comando `/rol crear_ficha`", ephemeral: true})
    }

    if(!objinfoa){
        return interaction.reply({content: `El objeto con la ID **${idObjeto}** no existe (╥﹏╥)`, ephemeral: true})
    }
    const objinfo = objinfoa.Objetos[0]

    const objfind = personaje.Inventario.find(obj => obj.ID === objinfo.ID)


    if(!objfind) {
        return interaction.reply({content: `No tienes el objeto con la ID: ${objeto} en tu inventario (╥﹏╥)`, ephemeral: true})
    }

    try {
        await usarObjeto()
    } catch (error) {
        console.error(error)
        return interaction.reply({content: "Ha ocurrido un error al intentar usar el objeto (╥﹏╥)", ephemeral: true})
    }


    async function usarObjeto() {
        switch(objinfo.Tipo) {
            case "Consumible":
                await consumirObjeto()
                break;
            case "Equipable":
                await equiparObjeto()
                break;
            case "Mision":
                await usarMision()
                break;
            default:
                return interaction.reply({content: "El objeto no tiene un tipo definido (╥﹏╥)", ephemeral: true})
        }
    }

    async function consumirObjeto() {
        if(objinfo.ID === 320) {
            const objetos = [
                {id: 2, probabilidad: 80},
                {id: 741, probabilidad: 10},
                {id: 946, probabilidad: 8},
                {id: 336, probabilidad: 1.5},
                {id: 203, probabilidad: 0.5},
            ];
            
            

            const lumens = Math.floor(Math.random() * (60 - 40 + 1) + 40)
            const ids = await probabilidades(objetos)

            const objget = await dbobjetos.findOne({_id: Region, "Objetos.ID": ids}, {projection: {_id: 0,"Objetos.$": 1}})
            const objeto = objget.Objetos[0]

         

            try {
                if(!objget) {
                    throw new Error("El objeto que intentas agregar no existe. Es posible que se trate de un objeto eliminado")
                } 




                const objinventario = personaje.Inventario.find(obj => obj.ID === objeto.ID)

                if(objinventario) {
                    await character.updateOne({
                        _id: interaction.user.id,
                    }, {
                        $inc: {
                            "Inventario.$[objeto].Cantidad": 1,
                            Dinero: lumens,
                            "Inventario.$[lootbox].Cantidad": -1
                        }
                    }, {
                        arrayFilters: [
                            { "lootbox.ID": objfind.ID},
                            { "objeto.ID": objeto.ID}
                        ]
                    })
                }else {
                    await character.updateOne({_id: interaction.user.id}, {
                        $push: {
                            Inventario: {
                                ID: objeto.ID,
                                Region: objeto.Region,
                                Nombre: `${objeto.Nombre}`,
                                Cantidad: 1,
                                Fecha: new Date().toISOString()
                            }
                        }
                    })

                    await character.updateOne({_id: interaction.user.id}, {
                        $inc: {
                            "Inventario.$[lootbox].Cantidad": -1,
                        }
                    }, {
                        arrayFilters: [
                            { "lootbox.ID": objfind.ID}
                        ]
                    })
                }


                await character.updateOne(
                    { _id: interaction.user.id },
                    { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
                );
               

                const embed = new EmbedBuilder()
                .setTitle("¡Felicidades! ( •̀ ω •́ )✧")
                .setDescription(`Has obtenido los siguientes objetos: \n- **${objeto.Nombre}** x 1\n- **Lumens: ${lumens}** <a:Lumens:1335709991130103910>`)
                .setColor(`DarkGreen`)
                .setFooter({text: `Sistema de objetos / Version: ${version.versionRol}`})

                await interaction.reply({embeds: [embed]})
                console.log("Agregando objetos...", objfind.ID)
            } catch (error) {
                console.log(error)
            }
        }else {
            return interaction.reply({content: "El objeto aun no tiene una funcion definida (╥﹏╥)", ephemeral: true})
        }
    }

    async function probabilidades(objetos) {

        let numAleatorio = Math.random() * 100;

        for(const objeto of objetos) {
            numAleatorio -= objeto.probabilidad;
            if(numAleatorio < 0) {
                return objeto.id;
            }
        }
    return null;
    }
}