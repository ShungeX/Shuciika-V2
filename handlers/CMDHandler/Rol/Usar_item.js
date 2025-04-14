const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)

const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const souls = db2.collection("Soul")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../config")
const dbobjetos = db2.collection("Objetos_globales")

const { duelSystem, duelEmitter } = require("../../../functions/duelManager")

module.exports = {
    requireCharacter: true,
    requireSoul: true,
    requireCharacterCache: false,
    isDevOnly: false,
    enMantenimiento: false,
    requireEstrict: {
        Soul: true,
        Character: true,
        Cachepj: false
    },


    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */

    ejecutar: async(client, interaction, { character, soul }) => {
    const value = interaction.options.getString("item")
    const [Region, idstring] = value.split("_")
    let idObjeto = Number(idstring) || idstring
    let objfind;

    if(isNaN(idObjeto)) {
        objfind = character.Inventario.find(i => i.instanciaID === idObjeto)

        if(objfind) idObjeto = objfind.ID
    }


    const objinfoa = await dbobjetos.findOne({_id: Region, "Objetos.ID": idObjeto}, {projection: {_id: 0,"Objetos.$": 1}})

    if(!objinfoa){
        return interaction.reply({content: `El objeto con la ID **${idObjeto}** no existe (╥﹏╥)`, ephemeral: true})
    }
    const objinfo = objinfoa.Objetos[0]

    if(!objfind) {
        objfind = character.Inventario.find(obj => obj.ID === objinfo.ID)
    }


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


        if(objinfo.isBag){
            if(objfind?.Metadata?.cache?.isFinish === false) return interaction.reply({content: "Este objeto esta en proceso de crafteo. Para poder usarlo debes terminarlo (╥﹏╥)", flags: "Ephemeral"})

            await interaction.deferReply()
            return manejarContenido()
        }else if(Object.keys(objinfo?.atributos).length > 0) {
            if(!soul) return interaction.reply({content: "Este objeto requiere de Stats especificos que solamente se pueden obtener al despertar tu alma.\n" + 
                "-# Debes esperar a que el Director realice la ceremonia de iniciación", flags: "Ephemeral"
            })

            const result = await duelSystem.useItem(false, soul, null, objinfo)

            return interaction.reply({content: result.message, ephemeral: true})
        }

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




                const objinventario = character.Inventario.find(obj => obj.ID === objeto.ID)

                if(objinventario) {
                    await characters.updateOne({
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
                    await characters.updateOne({_id: interaction.user.id}, {
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

                    await characters.updateOne({_id: interaction.user.id}, {
                        $inc: {
                            "Inventario.$[lootbox].Cantidad": -1,
                        }
                    }, {
                        arrayFilters: [
                            { "lootbox.ID": objfind.ID}
                        ]
                    })
                }


                await characters.updateOne(
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

    async function manejarContenido() {

        const session = clientdb.startSession()

        try {
            await session.withTransaction(async ()=> {
                const itemBag = character.Inventario.find(i => i.ID === objfind.ID && i.instanciaID === objfind.instanciaID)
                const contenedor = itemBag?.Metadata

                const itemsObtenidos = []

                if(!contenedor?.items?.length) {
                    throw new Error("El contenedor esta vacío o no existe")
                }

                for(const item of contenedor.items) {
                    const objetoGlobal = await duelSystem.getObjetInfo(item.Region, item.ID)

                    if(!objetoGlobal) {
                        itemsObtenidos.push("`[❌]` Objeto desconocido" + `(${item.Nombre} - ${item.ID})`)
                        continue;
                    }


                    itemsObtenidos.push("- `[🎁]`" + `${item.Nombre} x${item.Cantidad}`)

                    const itemExist = character.Inventario.find(i => i.ID === item.ID && i.Region === item.Region && !i.instanciaID);
                    console.log("Item:", item)

                    if(itemExist) {
                        await characters.updateOne({_id: interaction.user.id, Inventario: {$elemMatch: {ID: item.ID, Region: item.Region, instanciaID:  { $exists: false }}} }, 
                            { $inc: { "Inventario.$.Cantidad": item.Cantidad}},
                            { session }
                        );
                    }else {
                        await characters.updateOne({_id: interaction.user.id}, 
                            { $push: {
                                Inventario: {
                                    ID: objetoGlobal.ID,
                                    Region: objetoGlobal.Region,
                                    Nombre: objetoGlobal.Nombre,
                                    Cantidad: item.Cantidad,
                                    Fecha: new Date().toISOString()
                                }
                            }},
                            { session }
                        );
                    }

                    console.log("Objetos agregados" + ` ${item.ID} - ${item.Nombre}`)
                };

                console.log("Termine de Iterar")

                await characters.updateOne({_id: interaction.user.id},
                    {
                        $pull: {
                            Inventario: {
                                instanciaID: itemBag.instanciaID
                            }
                        }
                    },
                    { session }
                );

                console.log("Termine de eliminar el objeto")

                const embed = new EmbedBuilder()
                .setTitle("Contenido de la bolsa")
                .setDescription([
                    "**Has obtenido:**\n",
                    ...itemsObtenidos
                ].join("\n"))
                .setColor("Random")

                console.log("Voy a enviar la respuesta")
                await interaction.editReply({embeds: [embed]})
            })
        } catch (error) {
            console.error("Error al intentar extraer el contenido de la Bolsa:", error)
            await interaction.editReply({content: "Ocurrio un error al intentar extraer el contenido de la Bolsa:\n" + "```" + error + "```"})
        } finally {
            session.endSession();
        }
    }
    }
}