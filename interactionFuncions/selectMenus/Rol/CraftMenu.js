const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const objetos = db2.collection("Objetos_globales")
const characters = db2.collection("Personajes")
const transaccionCache = require("../../../utils/cache")
const { duelSystem } = require("../../../functions/duelManager")
const { v4: uuidv4} = require('uuid')
const { guardarBolsa } = require("../../../handlers/CMDHandler/Rol/craftear")




module.exports = {
    customId: "craftearMenu",
    selectAutor: true, 

    /**
     * 
     * @param {Client} client 
     * @param {ChatInputCommandInteraction} interaction 
     */
    ejecutar: async function(client, interaction, character) {
        const [action, cacheId, items] = interaction.values[0].split("/")
        const data = transaccionCache.get(cacheId)

        if(!data) return interaction.reply({content: "Esta interacción ya expiró 〒▽〒\n-# Vuelve a usar el comando (Esto ocurre si usaste otra vez el comando o pasó más de 3h)", ephemeral: true})

        let inventoryPage = 0;
        let inventoryFilter = null;



        if(action === "selectItem") {
            const [ID, Region] = items.split("*")


            const modal = new ModalBuilder()
            .setTitle("Agregando objetos...")
            .setCustomId(`CraftModals-${cacheId}-${ID}*${Region}`)       
            
            const cantidad = new TextInputBuilder()
            .setCustomId(`Cantidad`)
            .setLabel(`Ingresa la Cantidad`)
            .setPlaceholder('Responde solamente en valores numericos')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2)
            .setRequired(true)

            const row = new ActionRowBuilder().addComponents(cantidad)
            modal.addComponents(row)

            return await interaction.showModal(modal)
        }

        if(action === "Titulo") {
            const modal = new ModalBuilder()
            .setTitle("Agregando detalles...")
            .setCustomId(`CraftModals-${cacheId}-Titulo`)       
            
            const cantidad = new TextInputBuilder()
            .setCustomId(`Titulo`)
            .setLabel(`Ingresa el Titulo`)
            .setPlaceholder('Evita contenido inapropiado o que infrinja las reglas (máx. 70 caracteres). Incumplir = sanción.')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(70)
            .setRequired(true)

            const row = new ActionRowBuilder().addComponents(cantidad)
            modal.addComponents(row)

            return await interaction.showModal(modal)
        }

        if(action === "Mensaje"){

            const modal = new ModalBuilder()
            .setTitle("Agregando detalles...")
            .setCustomId(`CraftModals-${cacheId}-Mensaje`)       
            
            const cantidad = new TextInputBuilder()
            .setCustomId(`Mensaje`)
            .setLabel(`Ingresa el mensaje`)
            .setPlaceholder('Evita contenido inapropiado o que infrinja las reglas (máx. 1000 caracteres). Incumplir = sanción.')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true)

            const row = new ActionRowBuilder().addComponents(cantidad)
            modal.addComponents(row)

            return await interaction.showModal(modal)

        }

        await interaction.reply({content: "Espera... ", flags: "Ephemeral", withResponse: true})

        if(action === "Agregar") {
            await this.crearInventario(interaction, interaction.user.id, cacheId, character)
            interaction.deleteReply()
        }

        if(action === "Terminar") {
            await endRegalo()
            interaction.deleteReply()
        }


        

        async function endRegalo() {
            const itemInfo = data.bagContent

            const nuevoNombre = `${itemInfo.Nombre.replace("[Crafteando]", `[Crafteado-${data.bagContent.InstanciaID.substring(0, 5)}]`)} `

   

            await characters.updateOne({_id: interaction.user.id, "Inventario.instanciaID": itemInfo.InstanciaID}, {
                $unset: {
                    "Inventario.$.Metadata.cache": ""
                },
                $set: {
                    "Inventario.$.Nombre": `${nuevoNombre}`,
                    "Inventario.$.Metadata.restricciones.intercambiable": true,
                    "Inventario.$.Metadata.restricciones.isRegalo": true
                }
            })

            const embed = new EmbedBuilder()
            .setTitle("Regalo Finalizado 🎀")
            .setDescription(`**Tu regalo fue agregado al inventario**`)
            .addFields({
                name: 'Contenido del regalo',
                value: itemInfo.items?.length > 0
                    ? itemInfo.items?.map(item => `• ${item.Nombre} x${item.Cantidad}`).join('\n')
                    : 'Vacía'
            })
            .setColor("Green")

            await data.message.edit({embeds: [embed], components: []})

            transaccionCache.delete(cacheId)
            transaccionCache.deleteUser(interaction.user.id)
        }
    },

    crearInventario: async function(interaction, userId, cacheId, characterI, page = 0, filter = "todos") {
        const data = transaccionCache.get(cacheId)
        const character = await characters.findOne({ID: characterI.ID})

        if(!data) return interaction.reply({content: "Esta interacción ya expiró 〒▽〒\n-# Vuelve a usar el comando (Esto ocurre si usaste otra vez el comando o pasó más de 3h)", ephemeral: true})

        
        const matchFilter = { _id: interaction.user.id}
        let projectionFilter = { 'Inventario': 1, 'sesionRegalo': 1}

        const pipeline = [
            { $match: matchFilter },
            { $project: projectionFilter },
            { $unwind: '$Inventario' }, // Desanidar el inventario
            { $match: { 'Inventario.cantidad': { $gt: 0 } } } // Solo items con cantidad > 0
        ];

        const characterInventory = character.Inventario

        const inventarioInfo = []

        for(const item of characterInventory) {
            const fullItemInfo = await duelSystem.getObjetInfo(item.Region, item.ID)

            if(fullItemInfo) {
                const completeItem = {
                    ...fullItemInfo,
                    cantidad: item.Cantidad
                }

                const isIntercambiable = item?.Metadata?.restricciones?.intercambiable !== false
                const isGift = item?.Metadata?.restricciones?.isRegalo !== true  

                if (fullItemInfo.intercambiable && isIntercambiable && isGift) {
                    inventarioInfo.push(completeItem)
                    
                }
            }
        }
        

        if(filter !== "todos") {
            inventarioInfo.filter((item => item.tipo === filter))
        }

        const itemPorPagina = 15;
        const totalPage = Math.ceil(inventarioInfo.length / itemPorPagina)
        const itemsPaginas = inventarioInfo.slice(page * itemPorPagina, (page + 1) * itemPorPagina)
        page = Math.max(0, Math.min(page, totalPage - 1));

        const inventoryEmbed = new EmbedBuilder()
        .setTitle(`Tu inventario (Página ${page + 1}/${totalPage})`)
        .setDescription(`${inventarioInfo.length > 0 ? 'Selecciona un objeto para agregar a la bolsa:' : 'No tienes más objetos intercambiables para agregar.'}\n` + 
           `-# Filtro actual: ${filter}`)
        .setFooter({ text: `(Página ${page + 1}/${totalPage})`})
        .setImage("https://i.pinimg.com/736x/42/b1/96/42b196ec6eec8aabb3e9d53efd6cb195.jpg")
        .setColor("Random");

    if (itemsPaginas.length > 0) {
        inventoryEmbed.addFields({
            name: 'Objetos Disponibles',
            value: itemsPaginas.map(item => `• ${item.Nombre} (x${item.cantidad})`).join('\n') || 'Ninguno'
        });
    } else {
         inventoryEmbed.addFields({ name: 'Objetos Disponibles', value: 'Ninguno en esta página o con este filtro.' });
    }

    const rows = []

    if(inventarioInfo.length > 0) {
        const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`craftearMenu-${userId}-${page}-${filter}`)
        .setPlaceholder('Selecciona un objeto...')
        .setMaxValues(1)

        itemsPaginas.forEach((item, index) => {
            itemSelect.addOptions({
                label: `${item.Nombre} (x${item.cantidad || 1})`,
                description: item?.Descripcion?.substring(0, 40) || "Sin descripción",
                value: `selectItem/${cacheId}/${item.ID}*${item.Region}`,
            });
        });
        rows.push(new ActionRowBuilder().addComponents(itemSelect));
    }

    const filtersSelect = new StringSelectMenuBuilder()
    .setCustomId(`creaftearMenu-${userId}-${page}`)
    .setPlaceholder("Filtrar por tipo...")
    .addOptions(
        {
            label: "Consumible",
            description: "Filtra los objetos por el tipo consumible",
            value: `setFilter-Consumible`,
            emoji: "<a:green_teacup:1354586666228256941>"
        },
        {
            label: "Material",
            description: "Filtra los objetos por el tipo Material",
            value: `setFilter-Material`,
            emoji: "<:bee_honey:1354588196398436462>"
        },
        {
            label: "Artefacto",
            description: "Filtra los objetos por el tipo Artefacto",
            value: `setFilter-Artefacto`,
            emoji: "<:sailormoon_crisismooncompact:1354588214202994820>"
        },
        {
            label: "Armadura",
            description: "Filtra los objetos por el tipo Armadura",
            value: `setFilter-Armadura`,
            emoji: "🤺"
        },
        {
            label: "Herramienta",
            description: "Filtra los objetos por el tipo Herramienta",
            value: `setFilter-Herramienta`,
            emoji: "⚔️"
        }
    )

    rows.push(new ActionRowBuilder().addComponents(filtersSelect));


    const buttonRow = new ActionRowBuilder();
    buttonRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`CraftMenu-${userId}-itemsPrev-${cacheId}-${page}-${filter}`)
            .setLabel('◀️ Regresar')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`CraftMenu-${userId}-itemsNext-${cacheId}-${page}-${filter}`)
            .setLabel('▶️ Siguiente')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPage - 1),
        new ButtonBuilder()
            .setCustomId(`CraftMenu-${userId}-itemsClose-${cacheId}`)
            .setLabel('Volver a la Bolsa')
            .setStyle(ButtonStyle.Secondary)
    );
    rows.push(buttonRow);


    await data.message.edit({embeds: [inventoryEmbed], components: rows})

    }
}