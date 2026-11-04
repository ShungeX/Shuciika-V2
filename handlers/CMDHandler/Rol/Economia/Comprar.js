const { EmbedBuilder, ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } = require(`discord.js`)

const clientdb = require("../../../../Server")
const db = clientdb.db("Server_db")
const db2 = clientdb.db("Rol_db")
const Cachedb = db2.collection("CachePJ")
const characters = db2.collection("Personajes")
const version = require("../../../../config")
const { limitesDe, reservarCompra, liberarCompra, motivoLimite, excedeInventarioTrasEntrega } = require("../../../../functions/Tiendas/limitesCompra")
const { ErrorTienda, entregarObjeto, retirarObjeto } = require("../../../../functions/Tiendas/pedidos")
const { moverLumens } = require("../../../../functions/Economia/lumens")

const bdobjeto = db2.collection("Objetos_globales")


module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("comprar")
        .setDescription("Compra un objeto de la tienda.")
        .addStringOption(o =>
            o
                .setName("objeto")
                .setDescription("Ingresa la ID del objeto a comprar / Puedes filtrarlo por el nombre o ID.")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addNumberOption(o =>
            o
                .setName("cantidad")
                .setDescription("Ingresa la cantidad a comprar / Algunos objetos tienen limite de compra")
                .setRequired(true)
                .setMaxValue(20)
                .setMinValue(1)
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



    ejecutar: async (client, interaction, { character }) => {
        const objetoSelect = interaction.options.getString("objeto")
        const cantidad = interaction.options.getNumber("cantidad")
        const [region, idob] = objetoSelect.split("_")
        const objetoID = Number(idob)
        const responderError = (content) => interaction.reply({ content, flags: ["Ephemeral"] })

        const objeto = await bdobjeto.findOne({ _id: region, "Objetos.ID": objetoID }, { projection: { _id: 0, "Objetos.$": 1 } }).then(obj => obj?.Objetos?.[0])
        if (!objeto) return responderError(`El objeto con la ID: ${objetoSelect} no existe (╥﹏╥)`)
        if (objeto?.inStore === false) return responderError(`El objeto **${objeto.Nombre}** no esta disponible para la compra`)

        // Los mismos límites que el panel de tiendas: stock, por compra, por persona y en inventario
        const obj = { region, ID: objetoID, Nombre: objeto.Nombre || "Objeto", definicion: objeto, ...limitesDe(objeto) }
        const charId = character._id ?? character.ID
        const fresco = await characters.findOne({ _id: charId })
        if (!fresco) return responderError("No encuentro a tu personaje (╥﹏╥)")

        const motivo = motivoLimite(obj, cantidad, fresco)
        if (motivo) return responderError(motivo)

        const newLumens = (Math.max(0, Number(objeto.precio) || 0) * cantidad)
        const saldo = fresco.economia?.Lumens ?? 0
        if (saldo < newLumens) {
            return responderError("No tienes suficiente **`Lumens`** para comprar **``" + `${objeto.Nombre} x ${cantidad}` + "``** \n" +
                "-# Te hacen falta **``" + `${Math.max(0, newLumens - saldo)}` + " Lumens``** ")
        }

        // 1. Cobro atómico
        const ref = { itemId: objetoID, qty: cantidad, lugar: region }
        const cobro = await moverLumens({ personajeId: charId, userId: interaction.user.id, delta: -newLumens, motivo: "tienda", opId: `comprar:${interaction.id}`, ref })
        if (!cobro.ok) return responderError("No tienes suficiente **`Lumens`** para esta compra.")

        let compraContada = false, stockDescontado = false, entregado = false
        try {
            // 2. Máximo por persona: el contador solo sube si cabe
            if (obj.porPersona) {
                if (!(await reservarCompra(charId, obj, cantidad))) throw new ErrorTienda(`Ya llegaste al máximo de **${obj.Nombre}** por persona (${obj.porPersona}).`)
                compraContada = true
            }
            // 3. Existencias, descontadas solo si quedan
            if (obj.stock !== null) {
                const r = await bdobjeto.updateOne(
                    { _id: region, Objetos: { $elemMatch: { ID: objetoID, Cantidad: { $gte: cantidad } } } },
                    { $inc: { "Objetos.$.Cantidad": -cantidad } }
                )
                if (r.modifiedCount === 0) throw new ErrorTienda(`**${obj.Nombre}** se agotó justo ahora.`)
                stockDescontado = true
            }
            // 4. Entrega y recuento del inventario real
            await entregarObjeto(charId, obj, cantidad)
            entregado = true
            const excede = await excedeInventarioTrasEntrega(charId, obj)
            if (excede) throw new ErrorTienda(excede)
        } catch (err) {
            await moverLumens({ personajeId: charId, userId: interaction.user.id, delta: newLumens, motivo: "reembolso", opId: `reembolso:${interaction.id}`, ref })
                .catch(e => console.error("[Comprar] Reembolso fallido:", e))
            if (entregado) await retirarObjeto(charId, obj, cantidad).catch(() => null)
            if (stockDescontado) await bdobjeto.updateOne({ _id: region, "Objetos.ID": objetoID }, { $inc: { "Objetos.$.Cantidad": cantidad } }).catch(() => null)
            if (compraContada) await liberarCompra(charId, obj, cantidad).catch(() => null)
            if (!(err instanceof ErrorTienda)) console.error(`[Comprar] Error en la compra de ${interaction.user.id}:`, err)
            return responderError(err instanceof ErrorTienda ? err.message : "Algo salió mal al entregarte el objeto; te devolví los Lumens.")
        }

        bdobjeto.updateOne({ _id: region, "Objetos.ID": objetoID }, { $inc: { "Objetos.$.vendido": cantidad } }).catch(() => null)

        const embed = new EmbedBuilder()
            .setTitle("Muchas gracias por tu compra")
            .setDescription(`Has comprado **${objeto.Nombre} x ${cantidad}** por **${newLumens} Lumens**`)
            .setColor("Green")

        return interaction.reply({ embeds: [embed] })
    }

}
