const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client, StringSelectMenuBuilder} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const { mailSystem }  = require("../../../functions/mailManager")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')

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
    ejecutar: async(client, interaction, {character}) => {
        const cartaEspecific = interaction.options.getString("correo")
        const characterId = interaction.options.getNumber("remitente") || null;
        const tipoFiltro = interaction.options.getString("tipo") || 'todos';
        const mostrarLeidos = interaction.options.getBoolean("leidos");
        const existCache = transaccionCache.getUser(interaction.user.id)

        await interaction.deferReply({flags: ["Ephemeral"]})

        console.log(existCache)

        if(existCache) {
            transaccionCache.delete(existCache)
            transaccionCache.deleteUser(interaction.user.id)
        }


        if(cartaEspecific) {
            return CartaSeleccionada()
        }

        const filters = {
            tipo: tipoFiltro !== 'todos' ? tipoFiltro : null,
            leido: mostrarLeidos ? undefined : false,
            remitente: characterId ? characterId : false,
        };

        const {buzon, total} = await mailSystem.getMail(character.ID, filters, {
            page: 1,
            limit: 5,
        })

        if(buzon.length === 0) {
            return interaction.editReply({ content: 'Tu buzón está vacío 〒▽〒', ephemeral: true});
        }

        const embed = new EmbedBuilder()
        .setTitle(`📬 Buzón de ${character.Nombre}`)
        .setDescription("-# Para seleccionar una carta tienes ")
        .setColor("Purple")
        .setFooter({text: `Mostrando ${buzon.length} de ${total} correos`})

        
        const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mailAction-${interaction.user.id}`)
        .setPlaceholder('Selecciona una acción')
        .setMaxValues(1)

        const transacciónId = uuidv4().replace(/-/g, "")

        buzon.forEach((correo, index) => {
            let estado = `${correo.leido ? '`📭 Leído`' : '`📪 No leído`'}`;
            if(correo.reclamado !== undefined) estado += ` • ${correo.reclamado ? '`🎁 Reclamado`' : '`❌ No reclamado`'}`
            const fecha =  `<t:${Math.floor(correo.fechaEnvio / 1000)}:R>`;

            embed.addFields({
                name: `${index + 1}. ${correo.tipo.toUpperCase()} ${correo.isEspecial ? '✨' : ''}`,
                value: [
                    `*De:* ${correo.remitente.Nombre}`,
                    `*Fecha:* ${fecha}`,
                    `*Estado:* ${estado}`,
                    `*Mensaje:* ${correo.mensaje.texto ? correo.mensaje.texto?.slice(0, 20) + "..." : 'Sin mensaje'}`,
                    `*Contenido:* ${correo.contenido.length} items`
                ].join('\n')
            })

            selectMenu.addOptions({
                label: `${index + 1}. ${correo.Nombre.substring(0,16)}... - ${correo.tipo} [${correo.remitente.Nombre}]`,
                description: `Estado: ${estado}`,
                value: `ver-${correo.ID}-${transacciónId}`,
            });
        });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed], components: [row]
    });

    transaccionCache.set(transacciónId, interaction)
    transaccionCache.setUser(interaction.user.id, transacciónId)

    async function CartaSeleccionada() {
        const carta = character.buzon.find(c => c.ID === cartaEspecific)
        console.log(cartaEspecific)

        if(!carta) return interaction.editReply({content: "No se ha podido encontrar la carta seleccionada. 〒▽〒\n-# Vuelve a intentarlo", ephemeral: true})

        let estado = `${carta.leido ? '`📭 Leído`' : '`📪 No leído`'}`;
        let contenido;

        if(carta.reclamado !== undefined) {
        estado += ` • ${carta.reclamado ? '`🎁 Reclamado`' : '`❌ No reclamado`'}`

        contenido = carta.contenido.map(item => `${item.cantidad} x ID: ${item.ID} (${item.Region})`)
        .join(", ")
        }

        const embed = new EmbedBuilder()
        .setTitle(`${carta.Nombre}`)
        .setDescription(`-# Esto solo es una vista previa de la carta, para leer y reclamar el contenido tienes que abrirla.
        \n**De:** ${carta.remitente.Nombre}\n**Enviado:** <t:${Math.floor(carta.fechaEnvio / 1000)}:R>\n**Estado:** ${estado}\n**Mensaje:** ${carta.mensaje?.texto ? "Contiene mensaje" : "Sin mensaje"}`)
        .setColor("Random")
        .setTimestamp()
        .addFields(
            {name: "Contenido", value:  "```" + `${contenido ? contenido : "Sin contenido..."}` + "```"}
        )

        const transacciónId = uuidv4().replace(/-/g, "")

        const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mailAction-${interaction.user.id}`)
        .setPlaceholder('Selecciona una acción')
        .setMaxValues(1)
        .addOptions(
            {
                label: 'Abrir carta',
                value: `ver-${carta.ID}-${transacciónId}`,
                emoji: '<a:OpenLetter:1353961653099696200>'
            },
            {
                label: 'Borrar carta',
                value: `borrar-${carta.ID}-${transacciónId}`,
                emoji: '<a:Trash:1353962378785722438>'
            },
            {
                label: 'Marcar como especial',
                value: `especial-${carta.ID}-${transacciónId}`,
                emoji: '<a:LumensAlone:1335710044549021729>'
            }
        );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.editReply({embeds: [embed], components: [row]})

       transaccionCache.set(transacciónId, interaction)


        
    }
    },

    getMails: async(interaction, filters2 = {}, character, customId) => {
        const filters = {
            tipo: null !== 'todos' ? null : null,
            leido: null ? undefined : false,
            remitente: false ? character.ID : false,
        };

        const {buzon, total} = await mailSystem.getMail(character.ID, filters, {
            page: 1,
            limit: 5,
        })

        if(buzon.length === 0) {
            return interaction.editReply({ content: 'Tu buzón está vacío 〒▽〒', ephemeral: true});
        }

        const embed = new EmbedBuilder()
        .setTitle(`📬 Buzón de ${character.Nombre}`)
        .setDescription("-# Para seleccionar una carta tienes ")
        .setColor("Purple")
        .setFooter({text: `Mostrando ${buzon.length} de ${total} correos`})

        
        const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mailAction-${interaction.user.id}`)
        .setPlaceholder('Selecciona una acción')
        .setMaxValues(1)

        buzon.forEach((correo, index) => {
            let estado = `${correo.leido ? '`📭 Leído`' : '`📪 No leído`'}`;
            if(correo.reclamado !== undefined) estado += ` • ${correo.reclamado ? '`🎁 Reclamado`' : '`❌ No reclamado`'}`
            const fecha =  `<t:${Math.floor(correo.fechaEnvio / 1000)}:R>`;

            embed.addFields({
                name: `${index + 1}. ${correo.tipo.toUpperCase()} ${correo.isEspecial ? '✨' : ''}`,
                value: [
                    `*De:* ${correo.remitente.Nombre}`,
                    `*Fecha:* ${fecha}`,
                    `*Estado:* ${estado}`,
                    `*Mensaje:* ${correo.mensaje.texto ? correo.mensaje.texto?.slice(0, 20) + "..." : 'Sin mensaje'}`,
                    `*Contenido:* ${correo.contenido.length} items`
                ].join('\n')
            })

            selectMenu.addOptions({
                label: `${index + 1}. ${correo.Nombre} - ${correo.tipo} [${correo.remitente.Nombre}]`,
                description: `Estado: ${estado}`,
                value: `ver-${correo.ID}-${customId}`,
            });
        });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed], components: [row]
    });
    }


}