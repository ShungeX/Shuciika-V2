const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const { mailSystem }  = require("../../../functions/mailManager")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')
const { ejecutar, getMails } = require("../../../handlers/CMDHandler/Rol/buzon")
const updateInventario = require("../../../functions/updateInventario")
const getXP = require("../../../functions/getXP")
const newGetXP = require("../../../functions/newGetXP")


module.exports = {
    customId: "mailAction",
    selectAutor: true,

    /**
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction
     */

    ejecutar: async(client, interaction, character) => {
        const [action, interactId, cacheId, contentID] = interaction.values[0].split("-")
        const carta = character.buzon.find(c => c.ID === interactId)
        const message = transaccionCache.get(cacheId)

        if(!message) return interaction.reply({content: "Esta interacción ya expiró 〒▽〒\n-# Vuelve a usar el comando (Esto ocurre si usaste otra vez el comando o pasó más de 3h)", ephemeral: true})
  
            if(action === "regresar"){
                await interaction.reply({content: "Procesando... (∪｡∪)｡｡｡zzZ", flags: ["Ephemeral"]})
                await getMails(message, null, character, cacheId)
                return await interaction.deleteReply()
            }

        if(!carta) return interaction.reply({content: "No se ha podido realizar la accion a esta carta...", ephemeral: true})

        let contenido;
        let IDItem

        if(carta.reclamado !== undefined && carta.reclamado !== true) {
        contenido = carta.contenido.map(item => `( ${ item.Nombre || item.Cantidad} ) x ID: ${item.ID} (${item.Region})`)
        .join(", ")
        
        carta.contenido.forEach((item, index) => {
            IDItem = item.instanciaID || item.ID
        });

        } 

        await interaction.reply({content: "Procesando... (∪｡∪)｡｡｡zzZ", flags: ["Ephemeral"]})

        if(action === "ver") {
            
            const embed = new EmbedBuilder()
            .setTitle(`${carta.Nombre} ${carta.isEspecial ? " [✨]" : ''}`)
            .setDescription(`*De: ${carta.remitente.Nombre}*\n*Para: ${character.Nombre}*\n\n` + (carta.mensaje?.texto || "Sin mensaje"))
            .setColor(carta.mensaje?.color || "Purple")
            .setTimestamp()
            .setImage(carta.mensaje.adjuntos)
            .setThumbnail(carta.remitente?.avatarURL || null)
            .addFields(
                {name: "Contenido", value:  "```" + `${contenido ? contenido : "Sin contenido"}` + "```"}
            )

            const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`mailAction-${interaction.user.id}`)
            .setPlaceholder('Selecciona una acción')
            .addOptions(
                {
                    label: 'Borrar carta',
                    description: "Borra esta carta de tu buzón para liberar espacio",
                    value: `borrar-${carta.ID}-${cacheId}`,
                    emoji: '<a:Trash:1353962378785722438>'
                },
                {
                    label: carta.isEspecial ? "Desmarcar como especial" : 'Marcar como especial',
                    description: "Marcar una carta cómo especial evitara que expire (maximo 10)",
                    value: `especial-${carta.ID}-${cacheId}`,
                    emoji: '<a:LumensAlone:1335710044549021729>'
                },
            );

            
            if(contenido) {
                selectMenu.addOptions(
                    {
                        label: "Reclamar contenido",
                        description: "Reclama el contenido de la carta.",
                        value: `reclamar-${carta.ID}-${cacheId}-${IDItem}`,
                        emoji: "<a:Recompensas:1350573234894147594>"
                    }
                )
            }

            selectMenu.addOptions(
                {
                    label: 'Regresar al buzón',
                    description: "Regresa a la lista de cartas",
                    value: `regresar-${carta.ID}-${cacheId}`,
                    emoji: "<a:PinkMail:1353962700073603072>"
                }
            )

    
            const row = new ActionRowBuilder().addComponents(selectMenu);

            await characters.updateOne({_id: interaction.user.id, "buzon.ID": carta.ID}, {
                $set: { "buzon.$.leido": true}
            })

            await message.editReply({embeds: [embed], components: [row]})
            await interaction.deleteReply()

        }else if(action === "borrar") {
            const result = await characters.updateOne({_id: interaction.user.id}, 
                {
                    $pull: { buzon: {ID: carta.ID}}
                }
            )

            const embed = new EmbedBuilder()
            .setTitle("Se ha borrado correctamente la carta")
            .setDescription(`*De: ${carta.remitente.Nombre}*\n*Para: ${character.Nombre}*\n\n` + (carta.mensaje?.text || "Sin mensaje"))
            .setColor("Green")
            .setTimestamp()
            .setImage(carta.mensaje.adjuntos)
            .setThumbnail(carta.remitente?.avatarURL || null)

            const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`mailAction-${interaction.user.id}`)
            .setPlaceholder('Selecciona una acción')
            .addOptions(
                {
                    label: 'Regresar al buzón',
                    description: "Regresa a la lista de cartas",
                    value: `regresar-${carta.ID}-${cacheId}`,
                    emoji: "<a:PinkMail:1353962700073603072>"
                }
            );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.editReply({embeds: [embed], components: [row]})
            await interaction.deleteReply()
        }else if(action === "especial") {
            const value = carta.isEspecial ? false : true

            await characters.updateOne({_id: interaction.user.id, "buzon.ID": carta.ID}, {
                $set: { "buzon.$.isEspecial": value}
            })

            const embed = new EmbedBuilder()
            .setDescription(!carta.isEspecial ? "Se ha marcado esta carta cómo especial" : "Se ha desmarcado esta carta cómo especial")
            .setColor("Yellow")
            .setTimestamp()

            const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`mailAction-${interaction.user.id}`)
            .setPlaceholder('Selecciona una acción')
            .addOptions(
                {
                    label: 'Borrar carta',
                    description: "Borra esta carta de tu buzón para liberar espacio",
                    value: `borrar-${carta.ID}-${cacheId}`,
                    emoji: '<a:Trash:1353962378785722438>'
                },
                {
                    label: !carta.isEspecial ? "Desmarcar como especial" : 'Marcar como especial',
                    description: "Marcar una carta cómo especial evitara que expire (maximo 10)",
                    value: `especial-${carta.ID}-${cacheId}`,
                    emoji: '<a:LumensAlone:1335710044549021729>'
                },
            );

  
            
            if(contenido) {
                selectMenu.addOptions(
                    {
                        label: "Reclamar contenido",
                        description: "Reclama el contenido de la carta.",
                        value: `reclamar-${carta.ID}-${cacheId}-${IDItem}`,
                        emoji: "<a:Recompensas:1350573234894147594>"
                    }
                )
            }

            selectMenu.addOptions(
                {
                    label: 'Regresar al buzón',
                    description: "Regresa a la lista de cartas",
                    value: `regresar-${carta.ID}-${cacheId}`,
                    emoji: "<a:PinkMail:1353962700073603072>"
                }
            )

    
            const row = new ActionRowBuilder().addComponents(selectMenu);


            await interaction.editReply({content: "", embeds: [embed]})
            await message.editReply({components: [row]})
        }else if(action === "reclamar") {
                let Params;

                        contenido = character.buzon.find(i => i.contenido.some(item => 
                            item.instanciaID === contentID
                        ));

                        if(!contenido) {
                            contenido =  character.buzon.find((i) => i.contenido.some(item => 
                                item.ID === Number(contentID)
                            ));
                        }
                        
                        const autorRegalo = contenido.remitente.ID
                        contenido = contenido?.contenido[0]


                        if(!contenido) return interaction.editReply({content: "No se pudo encontrar el objeto... 〒▽〒\n-# Seguramente se trate de algun error o este ya fue reclamado", flags: "Ephemeral"})

                        if(contenido?.instanciaID) {                            


                        const result = await characters.updateOne({_id: interaction.user.id, "buzon": {$elemMatch: {"contenido.instanciaID": contentID}}}, 
                                {
                                    $unset: {
                                        "buzon.$[buzonElem].contenido.$[contElem].Metadata": ""
                                    },
                                    $set: { 
                                        "buzon.$[buzonElem].reclamado": true
                                    }
                                },
                                {
                                    arrayFilters: [
                                      { "buzonElem.contenido.instanciaID": contentID }, 
                                      { "contElem.instanciaID": contentID } 
                                    ]
                                }
                            )
                            console.log("Resultado actualizacion:", result)

                        }else {
                           const result = await characters.updateOne({_id: interaction.user.id, "buzon": {$elemMatch: {"contenido.ID": Number(contentID)}}}, 
                                {
                                    $set: { 
                                        "buzon.$[buzonElem].reclamado": true
                                    }
                                },
                                {
                                    arrayFilters: [
                                      { "buzonElem.contenido.ID": Number(contentID) } 
                                    ]
                                }
                            )
                            console.log("Resultado actualizacion:", result)
                        }
                        
                        Params = {
                                instanciaID: contenido?.instanciaID,
                                ID: contenido.ID,
                                Region: contenido.Region,
                                cantidad: contenido.Cantidad,
                                isItem: true,
                                typeLoot: null,
                                itemComplet: { ...contenido },
                                isMailContent: true
                            }
            

                        await updateInventario(client, interaction, interaction.user.id, Params)

                        const getXP = await newGetXP(client, interaction, interaction.user, autorRegalo, character.ID, 3)

                        mensaje = contenido.Nombre ? `${contenido?.Nombre} [${contenido.ID} | ${contenido.Region}])` : `( ${contenido.Cantidad} ) x ID: ${contenido.ID} (${contenido.Region} ) `


                        const embedReclamado = new EmbedBuilder()
                        .setTitle("Contenido reclamado")
                        .setDescription("Has reclamado el contenido del buzón, este se ha agregado a tu inventario\n Tambien has ganado puntos de amistad: `" + 
                            getXP.xp +  "`"
                        )
                        .addFields(
                            {name: "Contenido reclamado", value: "```" +  mensaje + "```"}
                        )
                        .setColor("Green")
                        .setTimestamp()

                        const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`mailAction-${interaction.user.id}`)
                        .setPlaceholder('Selecciona una acción')
                        .addOptions(
                            {
                                label: 'Borrar carta',
                                description: "Borra esta carta de tu buzón para liberar espacio",
                                value: `borrar-${carta.ID}-${cacheId}`,
                                emoji: '<a:Trash:1353962378785722438>'
                            },
                            {
                                label: carta.isEspecial ? "Desmarcar como especial" : 'Marcar como especial',
                                description: "Marcar una carta cómo especial evitara que expire (maximo 10)",
                                value: `especial-${carta.ID}-${cacheId}`,
                                emoji: '<a:LumensAlone:1335710044549021729>'
                            },
                        );


                        selectMenu.addOptions(
                            {
                                label: 'Regresar al buzón',
                                description: "Regresa a la lista de cartas",
                                value: `regresar-${carta.ID}-${cacheId}`,
                                emoji: "<a:PinkMail:1353962700073603072>"
                            }
                        )

                        const row = new ActionRowBuilder().addComponents(selectMenu);
                        await message.editReply({components: [row], content: ""})
                        
                        await interaction.editReply({embeds: [embedReclamado]})


        }
    }
}