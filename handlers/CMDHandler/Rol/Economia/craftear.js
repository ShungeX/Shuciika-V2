const { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, SlashCommandSubcommandBuilder } = require(`discord.js`)
const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const version = require("../../../../config")
const { duelSystem } = require("../../../../functions/duelManager")
const characters = db2.collection("Personajes")
const transaccionCache = require("../../../../utils/cache")
const { v4: uuidv4 } = require('uuid')


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("craftear")
        .setDescription("Agrega contenido a objetos disponibles o crea nuevos objetos [experimental]")
        .addStringOption(o =>
            o
                .setName("item_principal")
                .setDescription("ID del Item principal que se usara en la receta")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(o =>
            o
                .setName("item")
                .setDescription("ID del item a mezclar")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addNumberOption(o =>
            o
                .setName("cantidad")
                .setDescription("Cantidad del item secundario que se usara en la receta")
                .setMaxValue(10)
                .setMinValue(1)
                .setRequired(true)
        ),

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

    ejecutar: async function (client, interaction, { character }) {
        const objP = interaction.options.getString("item_principal")
        const objS = interaction.options.getString("item")
        const cantidadInt = interaction.options.getNumber("cantidad")
        const craftActive = transaccionCache.getUser(interaction.user.id)
        let objetoPrincipal;
        let self = this;

        if (craftActive) {
            const messages = transaccionCache.get(craftActive).message
            const isActive = messages.channel.messages.cache.get(messages.id)
            if (isActive) {
                return interaction.reply({
                    content: "Ya tienes un crafteo en proceso. ( •̀ ω •́ )✧\n-# " +
                        `[Haz click aqui para ir al mensaje](https://discord.com/channels/${messages.guildId}/${messages.channelId}/${messages.id})`, ephemeral: true
                })
            } else {
                transaccionCache.delete(craftActive)
                transaccionCache.deleteUser(interaction.user.id)
            }
        }


        const [regionP, IDP] = objP.split("_")
        const [regionS, IDS] = objS.split("_")

        const cantidadS = character.Inventario.find((obj) => obj.ID == IDS && obj.Region === regionS)
        const objPrincipal = character.Inventario.find((obj) => obj.instanciaID == IDP && obj.Region === regionP)
        const isFinish = objPrincipal?.Metadata?.cache?.isFinish === false


        if (objPrincipal?.Metadata?.restricciones?.crafteable === false && !isFinish) {
            return interaction.reply({ content: "Este objeto no se puede mezclar ni craftear 〒▽〒\n-# Los regalos y algunos objetos especificos no se pueden mezclar", flags: "Ephemeral" })
        }


        if (cantidadS?.Cantidad < cantidadInt || !cantidadS) return interaction.reply({
            content: "No tienes la cantidad suficiente para dar este objeto 〒▽〒\n-# Tienes: **`" +
                cantidadS?.Cantidad + "`**, y quieres enviar: **`" + cantidadInt + "`**", ephemeral: true
        })


        if (objPrincipal) {
            objetoPrincipal = await duelSystem.getObjetInfo(regionP, objPrincipal.ID)
        } else {
            objetoPrincipal = await duelSystem.getObjetInfo(regionP, IDP)
        }

        const objetoSecundario = await duelSystem.getObjetInfo(regionS, IDS)
        let tempDatal;
        let exist;

        if (objetoPrincipal?.isBag) {
            if (isFinish) {
                exist = true
                tempDatal = {
                    InstanciaID: objPrincipal.instanciaID,
                    Nombre: objPrincipal.Nombre,
                    ID: objPrincipal.ID,
                    Region: `${objPrincipal.Region}`,
                    Cantidad: 1,
                    Capacidad: objPrincipal.Metadata.cache.Capacidad,
                    items: objPrincipal.Metadata.items,
                    restricciones: { ...objPrincipal.restricciones },
                    pesoTotal: objPrincipal.Metadata.cache.pesoTotal,
                    Titulo: objPrincipal.Metadata?.Titulo || null,
                    mensaje: objPrincipal.Metadata?.Mensaje || null,

                }
            } else {
                tempDatal = {
                    items: [{
                        ID: objetoSecundario.ID,
                        Region: objetoSecundario.Region,
                        Nombre: objetoSecundario.Nombre,
                        Cantidad: cantidadInt,
                    }]
                }

            }





            bagSelect(objetoPrincipal, objetoSecundario, tempDatal, exist)
        } else {
            return interaction.reply({ content: "Solamente se admiten objetos para regalar.\n-# Espera pacientemente hasta que esta funcion este por completa", flags: "Ephemeral" })
        }


        if (!objetoPrincipal || !objetoSecundario) return interaction.reply({ content: "No se ha podido encontrar ese objeto. ＞﹏＜\n-# Probablemente no sea la ID correcta o el objeto ya no exista", ephemeral: true })

        if (!objetoSecundario.intercambiable) {

        }


        function getVisualCantidad(min, max) {
            const barLength = 10;
            const filled = Math.round((min / max) * barLength);
            const empty = barLength - filled;
            return "*Peso:*`" + `[${'🪨'.repeat(filled)}${'.'.repeat(empty)}]` + "`" + `*${min}/${max}*`;
        }


        async function bagSelect(bag, item, data, exist = false) {
            let pesoTotal = data?.pesoTotal || (item.atributos?.peso) * cantidadInt
            const transacciónId = uuidv4().replace(/-/g, "")


            if (!exist) {
                if (!item.intercambiable) return interaction.reply({ content: "**`" + item.Nombre + "`** No se puede agregar este objeto a la bolsa 〒▽〒\n-# Este objeto no es intercambiable", ephemeral: true })

                if ((data.Capacidad || bag.atributos.capacidad) < pesoTotal) return interaction.reply({
                    content: "**`" + bag.Nombre + "`** No tiene la capacidad suficiente para almacenar el peso de tantos objetos\n"
                        + `-# Los objetos que agregaste son muy pesados, verifica el peso y vuelve a intentarlo`, flags: "Ephemeral"
                })

                await characters.updateOne({ _id: interaction.user.id, Inventario: { $elemMatch: { ID: bag.ID, Region: bag.Region } } }, {
                    $inc: { "Inventario.$.Cantidad": -1 }
                })

                await characters.updateOne(
                    { ID: character.ID },
                    { $pull: { Inventario: { Cantidad: { $lte: 0 } } } }
                );
            }



            const embed = new EmbedBuilder()
                .setTitle("Creando un regalo... 🎀")
                .setDescription(`${getVisualCantidad(pesoTotal, (data.Capacidad || bag.atributos.capacidad))}\n${exist ? "-# El item seleccionado no se agrego porque el regalo ya existia, si quieres agregarlo tienes que volver a seleccionarlo desde el menu de abajo" : ''}
            \n${data.Titulo ? `-# **Titulo:** ${data.Titulo}` : ''}\n${data?.mensaje ? `-# **Mensaje**: ${data.mensaje}` : ''}`)
                .addFields({
                    name: 'Contenido Actual',
                    value: (data.items?.length > 0)
                        ? data?.items?.map(item => `• ${item.Nombre} x${item.Cantidad}`).join('\n')
                        : 'Vacía'
                })
                .setColor("DarkPurple")
                .setFooter({ text: 'Usa el menú para continuar.' });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`craftearMenu-${interaction.user.id}`)
                    .setPlaceholder('Selecciona una acción...')
                    .addOptions(
                        {
                            label: "Agregar Titulo",
                            description: "Agrega o edita el titulo del regalo/carta",
                            value: `Titulo/${transacciónId}`,
                            emoji: "<a:ExclamationMarkBubble:1355437226447732746>"
                        },
                        {
                            label: "Agregar mensaje",
                            description: "Agrega o edita el mensaje del regalo/carta",
                            value: `Mensaje/${transacciónId}`,
                            emoji: "<:CuteTextBubble:1355260195080769566>"
                        },
                        {
                            label: "Agregar Objetos",
                            description: "Se mostrara un listado con los objetos disponibles",
                            value: `Agregar/${transacciónId}`,
                            emoji: "<a:Recompensas:1350573234894147594>"
                        },
                        {
                            label: "Terminar Regalo",
                            description: "Una vez cerrado el regalo no se podra editar",
                            value: `Terminar/${transacciónId}`,
                            emoji: "✅"
                        }

                    )
            );

            await interaction.reply({ embeds: [embed], components: [row], withResponse: true })

            const message = await interaction.fetchReply()

            let obj = {

            }


            if (data.InstanciaID) {
                obj = {
                    message: message,
                    bagContent: {
                        ...data
                    }

                }
            } else {
                obj = {
                    message: message,
                    bagContent: {
                        InstanciaID: data.instanciaID || uuidv4().replace(/-/g, ""),
                        Nombre: `${bag.Nombre} ${item.isFinish ? ["[Crafteado]"] : ["[Crafteando]"]}`,
                        ID: bag.ID,
                        Region: bag.Region,
                        Cantidad: 1,
                        Capacidad: bag.atributos.capacidad,
                        items: [
                            {
                                Nombre: item.Nombre,
                                ID: item.ID,
                                Region: item.Region,
                                Cantidad: cantidadInt
                            }
                        ],
                        restricciones: self.actualizarRestricciones({}, item.restricciones),
                        pesoTotal: pesoTotal,
                        isFinish: false
                    }
                }
            }

            if (!exist) {
                await self.guardarBolsa(interaction, obj, cantidadInt, item, character)
            }

            transaccionCache.set(transacciónId, obj)
            transaccionCache.setUser(interaction.user.id, transacciónId)



        }

    },

    bagHome: async function (interaction, dataId) {
        const data = transaccionCache.get(dataId)

        if (!data) return interaction.reply({ content: "Esta interacción ya expiró 〒▽〒\n-# Vuelve a usar el comando (Esto ocurre si usaste otra vez el comando o pasó más de 3h)", flags: "Ephemeral" })

        let item = data.bagContent

        let pesoTotal = item.pesoTotal

        const embed = new EmbedBuilder()
            .setTitle("Creando un regalo... 🎀")
            .setDescription(`${getVisualCantidad(pesoTotal, item.Capacidad)}\n\n${item.Titulo ? `-# **Titulo:** ${item.Titulo}` : ''}\n${item.mensaje ? `-# **Mensaje:** ${item.mensaje}` : ''}`)
            .addFields({
                name: 'Contenido Actual',
                value: item.items?.length > 0
                    ? item.items?.map(item => `• ${item.Nombre} x${item.Cantidad}`).join('\n')
                    : 'Vacía'
            })
            .setColor("DarkPurple")
            .setFooter({ text: 'Usa el menú para continuar.' });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`craftearMenu-${interaction.user.id}`)
                .setPlaceholder('Selecciona una acción...')
                .addOptions(
                    {
                        label: "Agregar Titulo",
                        description: "Agrega o edita el titulo del regalo/carta",
                        value: `Titulo/${dataId}`,
                        emoji: "<a:ExclamationMarkBubble:1355437226447732746>"
                    },
                    {
                        label: "Agregar mensaje",
                        description: "Agrega o edita el mensaje del regalo/carta",
                        value: `Mensaje/${dataId}`,
                        emoji: "<:CuteTextBubble:1355260195080769566>"
                    },
                    {
                        label: "Agregar Objetos",
                        description: "Se mostrara un listado con los objetos disponibles",
                        value: `Agregar/${dataId}`,
                        emoji: "<a:Recompensas:1350573234894147594>"
                    },
                    {
                        label: "Terminar Regalo",
                        description: "Una vez cerrado el regalo no se podra editar",
                        value: `Terminar/${dataId}`,
                        emoji: "✅"
                    }
                )
        );

        await data.message.edit({ embeds: [embed], components: [row] })

        function getVisualCantidad(min, max) {
            const barLength = 10;
            const filled = Math.round((min / max) * barLength);
            const empty = barLength - filled;
            return "*Peso:*`" + `[${'🪨'.repeat(filled)}${'.'.repeat(empty)}]` + "`" + `*${min}/${max}*`;
        }

    },

    guardarBolsa: async function (interaction, data, cantidad = 0, itemSelect, character, message, titulo) {
        const item = data.bagContent
        const itemInfo = item.items

        const restriccionesObligatorias = {
            intercambiable: false,
            crafteable: false,
            apilable: false,
        }

        const objdata = {
            instanciaID: item.InstanciaID || uuidv4().replace(/-/g, ""),
            ID: item.ID,
            Region: `${item.Region}`,
            Nombre: `${item.Nombre}`,
            Cantidad: 1,
            Metadata: {
                Titulo: item?.Titulo ? item.Titulo : (titulo || null),
                Mensaje: item?.mensaje ? item.mensaje : (message || null),
                items: itemInfo,
                restricciones: {
                    ...restriccionesObligatorias,
                    ...item.restricciones
                },
                cache: {
                    Capacidad: item.Capacidad,
                    pesoTotal: item.pesoTotal,
                    isFinish: false
                }
            },
            Fecha: new Date().toISOString()
        }




        const session = clientdb.startSession()


        try {
            await session.withTransaction(async () => {

                if (cantidad > 0) {
                    await characters.updateOne({ ID: character.ID, Inventario: { $elemMatch: { ID: itemSelect.ID, Region: itemSelect.Region } } }, {
                        $inc: { "Inventario.$.Cantidad": -cantidad }
                    }, { session })
                }

                await characters.updateOne(
                    { ID: character.ID },
                    { $pull: { Inventario: { Cantidad: { $lte: 0 } } } },
                    { session }
                );

                const existingBag = await characters.findOne(
                    { ID: character.ID, "Inventario.instanciaID": objdata.instanciaID },
                    { session }
                );

                if (existingBag) {
                    await characters.updateOne(
                        { ID: character.ID, "Inventario.instanciaID": objdata.instanciaID },
                        { $set: { "Inventario.$.Metadata": objdata.Metadata } },
                        { session }
                    );
                } else {
                    await characters.updateOne(
                        { ID: character.ID },
                        { $push: { Inventario: objdata } },
                        { session }
                    );
                }

                console.log("Regalo guardado")
            })
        } catch (error) {
            console.error("Error al guardar la bolsa:", error);
            await interaction.followUp({ content: "Ocurrió un error al guardar la bolsa de regalo." });
        } finally {
            session.endSession()
        }
    },

    actualizarRestricciones: function (current, nuevo) {
        const exclusiones = ["InCombat"]

        const actualizadas = { ...current }

        console.log(actualizadas)

        for (const key in nuevo) {
            if (nuevo[key] == null || exclusiones.includes(key)) continue;

            if (typeof nuevo[key] === "number") {
                if (actualizadas[key] == null) {
                    actualizadas[key] = nuevo[key]
                } else {
                    actualizadas[key] = Math.max(actualizadas[key], nuevo[key]);
                }
            } else if (typeof nuevo[key] === "boolean") {
                if (actualizadas[key] !== true && nuevo[key] === true) {
                    actualizadas[key] = true
                }
            } else {
                if (!actualizadas.hasOwnProperty(key)) {
                    actualizadas[key] = nuevo[key];
                }
            }
        }

        return actualizadas
    }

};
