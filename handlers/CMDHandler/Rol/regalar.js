const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction, ApplicationCommandOptionType, Client} = require(`discord.js`)
const clientdb = require("../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const characters = db2.collection("Personajes")
const souls = db2.collection("Soul")
const version = require("../../../config")
const { duelSystem } = require("../../../functions/duelManager")
const transaccionCache = require("../../../utils/cache")
const { v4: uuidv4} = require('uuid')

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

    ejecutar: async(client, interaction, { character, soul}) => {
    const objetoId = interaction.options.getString("item")
    const pjID = interaction.options.getNumber("personaje")
    const cantidad = interaction.options.getNumber("cantidad")
    const [region, ID] = objetoId.split("_")
    let cantidadInventario 
    const cacheExist = transaccionCache.getUser(interaction.user.id)

    if(cacheExist && transaccionCache.get(cacheExist)) {
        const messages = transaccionCache.get(cacheExist).message

            return interaction.reply({content: "Ya tienes una interacción de regalo activa.\n-# " + 
                `[Haz click aqui para ir al mensaje](https://discord.com/channels/${messages.guildId}/${messages.channelId}/${messages.id})\n-# Por seguridad el cache se almacena durante 3 horas, si por error eliminaste el mensaje, tendras que esperar ese tiempo. Disculpa las molestias ＞﹏＜`, ephemeral: true})
    }

    if(typeof ID !== "undefined") {
        cantidadInventario = character.Inventario.find(obj => obj.instanciaID === ID && obj.Region === region)
    }

    if(!cantidadInventario) {
        cantidadInventario = character.Inventario.find(obj => obj.ID === Number(ID) && obj.Region === region)
    }
    

    if(character.ID === pjID) return interaction.reply({content: "Ehm... no puedes regalarte a ti mismo un objeto 〒▽〒\n-# Menciona otro personaje que no seas tu mismo", ephemeral: true})

    const pjFriend = await characters.findOne({ID: pjID})

    if(!pjFriend) return interaction.reply({content: "No se pudo encontrar el personaje con la siguiente ID: `" + pjID + "`", ephemeral: true})

    console.log(cantidadInventario)
    if(cantidadInventario?.Cantidad < cantidad || !cantidadInventario) return interaction.reply({content: "No tienes la cantidad suficiente para dar este objeto 〒▽〒\n-# Tienes: **`" + 
        cantidadInventario?.Cantidad + "`**, y quieres enviar: **`" + cantidad + "`**", ephemeral: true 
    })

    const soulFriend = await souls.findOne({ID: pjFriend.ID})

    if(!soulFriend) return interaction.reply({content: "Este personaje aun no puede recibir objetos... 〒▽〒", flags: "Ephemeral"})


    const objeto = await duelSystem.getObjetInfo(region, cantidadInventario.ID)

    if(!objeto) return interaction.reply({content: "No se ha podido encontrar ese objeto. ＞﹏＜\n-# Probablemente no sea la ID correcta o el objeto ya no exista", ephemeral: true})
        
    if(!objeto.intercambiable || cantidadInventario?.Metadata?.restricciones?.intercambiable === false) {
        return interaction.reply({content: "**`" + objeto.Nombre + "`** No se puede regalar 〒▽〒\n-# Este objeto no es intercambiable", ephemeral: true})
    }


    const restricciones = {
        ...objeto.restricciones,
        ...cantidadInventario?.Metadata?.restricciones
    }




    const validarRestricciones = async (usuario, soul, item) => {
        const restricciones = item;
        console.log(restricciones)
        const errores = [];

        const validadores = [
            {
                condicion: restricciones.nivel_minimo > 0,
                validador: soul.nivelMagico >= restricciones.nivel_minimo,
                mensaje: "**`" + `${usuario.Nombre}` + "`** Necesita el nivel minimo del objeto **`" + `(lv: ${restricciones.nivel_minimo})` + "`**"
            },
            {
                condicion: restricciones.nivel_maximo > 0,
                validador:  soul.nivelMagico <= restricciones.nivel_maximo,
                mensaje: "**`" + `**${usuario.Nombre}` + "`** Necesita ser más bajo que el nivel maximo **`" + `(lv: ${restricciones.nivel_maximo})` + "`**"
            },
            {
                condicion: restricciones.clase,
                validador:  soul?.Clase === restricciones.clase,
                mensaje: "**`" + `**${usuario.Nombre}` + "`** Necesita ser de una clase especifica **`" + `(clase: ${restricciones.clase})` + "`**"
            },
            {
                condicion: restricciones.reputacion,
                validador: usuario.Reputacion >= restricciones.reputacion,
                mensaje: "**`" + `${usuario.Nombre}` + "`** Necesita una reputacion superior **`" + `(Rep: ${restricciones.Reputacion})` + "`**"
            }
        ];

        validadores.forEach(({ condicion, validador, mensaje}) => {
            if(condicion && !validador) {
                errores.push(mensaje)
            }
        });

        return {
            valido: errores.length === 0,
            errores
        }
    }

    const resultadoValidacion = await validarRestricciones(pjFriend, soulFriend, restricciones);

    if(!resultadoValidacion.valido) {
        return interaction.reply({content: `No se puede regalar el siguiente objeto porque no se cumplen una o más de los siguientes requisitos:\n
            ${resultadoValidacion.errores.join("\n")}`, ephemeral: true})
    }

    const embed = new EmbedBuilder()
    .setTitle("Verifica la informacion antes de enviar el objeto")
    .setDescription("Este regalo sera enviado al buzón de **`" + pjFriend.Nombre + "`**.\n **¡Esta acción es irreversible!**")
    .addFields(
        {name: "Nombre del objeto", value: objeto.Nombre, inline: true},
        {name: "Rareza", value: objeto.Rareza, inline: true},
        {name: "Cantidad a dar", value: `${cantidad}`, inline: true},
    )
    .setThumbnail(pjFriend.avatarURL)
    .setTimestamp()
    .setColor("Red")

    let objFinal = objeto

    if(cantidadInventario?.Metadata) {
        objFinal = {
            ...cantidadInventario,
            bagData: objeto?.BagData
        }
        const metadata = cantidadInventario.Metadata
        embed.addFields( 
            {name: "Titulo?", value: `${metadata.Titulo ? metadata.Titulo : "No"}`, inline: true},
            {name: "Mensaje?", value: `${metadata?.Mensaje ? metadata.Mensaje.substring(0, 100) + "..." : "No"}`, inline: true},
            {name: "Contenido?", 
                value: metadata.items?.length > 0
                ? metadata.items?.map(item => `• ${item.Nombre} x${item.Cantidad}`).join('\n')
                : 'Sin contenido'
            }
        )
    }



    const transacciónId = uuidv4().replace(/-/g, "")
    const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder().setCustomId(`regalar-${interaction.user.id}-aceptar-${transacciónId}`).setLabel("Aceptar").setStyle(ButtonStyle.Secondary).setEmoji("✅"),
        new ButtonBuilder().setCustomId(`regalar-${interaction.user.id}-rechazar-${transacciónId}`).setLabel("Rechazar").setStyle(ButtonStyle.Secondary).setEmoji("❌"),
    )



     await interaction.reply({embeds: [embed], components: [row], withResponse: true, flags: "Ephemeral"}) 

    const obj = {
        objData: objFinal,
        message: interaction,
        IDcharacter: pjID,
        characterName: pjFriend.Nombre,
        cantidad: cantidad
    }

    await transaccionCache.set(transacciónId, obj)
    await transaccionCache.setUser(interaction.user.id, transacciónId)
    },
}
