// functions/Tiendas/pedidos.js
// Pedidos de las tiendas: lo que alguien va juntando antes de pagar en un mensaje efímero.
//
// El estado vive en memoria y es desechable: un Map con clave `userId*shopId` que solo guarda { clave: cantidad }.
// Precios, nombres y saldo se releen de la base de datos en cada render, así que lo que se ve es lo que se paga.
// Un reinicio del bot solo vacía los pedidos abiertos.

const clientdb = require("../../Server")
const dbRol = clientdb.db("Rol_db")
const dbServer = clientdb.db("Server_db")
const personajes = dbRol.collection("Personajes")
const objetosGlobales = dbRol.collection("Objetos_globales")
const { obtenerTienda } = require("../mensajesServidor")
const { sanitizarObjetoInventario } = require("../catalogoObjetos")
const menus = require("../../data/UI_ComponentsV2/menusTienda")
const { moverLumens } = require("../Economia/lumens")

const CADUCIDAD_MS = 15 * 60 * 1000
const MAX_CANTIDAD = 99
const MAX_LINEAS = 25   // el modal de quitar es un select de Discord

/** @type {Map<string, { characterId: number|string, items: Map<string, number>, expira: number }>} */
const pedidos = new Map()

// Limpia los pedidos caducados; unref para no mantener vivo el proceso por esto
setInterval(() => {
    const ahora = Date.now()
    for (const [clave, pedido] of pedidos) if (pedido.expira < ahora) pedidos.delete(clave)
}, 5 * 60 * 1000).unref()

class ErrorTienda extends Error {}

const claveDe = (region, id) => `${region}::${id}`

/**
 * Pedido vigente del usuario en esa tienda. Cada acceso renueva la caducidad.
 * Con `crear`, abre uno vacío si no hay (o si el que había era de otro personaje).
 */
function obtenerPedido(userId, shopId, characterId, { crear = false } = {}) {
    const clave = `${userId}*${shopId}`
    let pedido = pedidos.get(clave)
    if (pedido && (pedido.expira < Date.now() || String(pedido.characterId) !== String(characterId))) {
        pedidos.delete(clave)
        pedido = null
    }
    if (!pedido && crear) {
        pedido = { characterId, items: new Map(), expira: 0 }
        pedidos.set(clave, pedido)
    }
    if (pedido) pedido.expira = Date.now() + CADUCIDAD_MS
    return pedido || null
}

function cerrarPedido(userId, shopId) {
    pedidos.delete(`${userId}*${shopId}`)
}

/** Objetos que se venden ahora en ese lugar: `inStore` y el lugar en `en_tienda` (sin distinguir mayúsculas). */
async function objetosDeTienda(lugar) {
    const regexLugar = new RegExp(`^${String(lugar).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    const filas = await objetosGlobales.aggregate([
        { $unwind: "$Objetos" },
        { $match: { "Objetos.inStore": true, "Objetos.en_tienda": regexLugar } },
        { $sort: { "Objetos.Nombre": 1 } }
    ]).toArray()

    return filas.map(({ _id: region, Objetos: o }) => ({
        region,
        ID: Number(o.ID),
        clave: claveDe(region, Number(o.ID)),
        Nombre: o.Nombre || "Objeto",
        Rareza: o.Rareza || null,
        precio: Math.max(0, Number(o.precio) || 0),
        stock: o.Cantidad === null || o.Cantidad === undefined ? null : Number(o.Cantidad),
        // Límites: los nombres nuevos si existen; si no, los que ya usaba /rol comprar
        porCompra: o.max_por_compra ?? o.maxStock ?? null,
        porPersonaje: o.limite_por_personaje ?? (o.maximoUnoPorPersona ? 1 : null),
        definicion: o
    }))
}

/** Cuántas unidades de ese objeto tiene ya el personaje entre inventario y mochila. */
function unidadesPoseidas(character, obj) {
    const listas = [character?.economia?.Inventario || [], character?.economia?.Mochila || []]
    let total = 0
    for (const lista of listas) {
        for (const i of lista) {
            if (Number(i.ID) !== obj.ID) continue
            if (i.Region && i.Region !== obj.region) continue
            total += Number(i.Cantidad ?? i.cantidad ?? 1)
        }
    }
    return total
}

/** Comprueba si se pueden llevar `cantidad` unidades en total. Devuelve el motivo si no, en la voz de la tienda. */
function motivoLimite(obj, cantidad, character) {
    if (obj.stock !== null && cantidad > obj.stock) {
        return obj.stock <= 0 ? `**${obj.Nombre}** se agotó.` : `Solo quedan ${obj.stock} de **${obj.Nombre}**.`
    }
    if (obj.porCompra && cantidad > obj.porCompra) return `No puedes llevar más de ${obj.porCompra} de **${obj.Nombre}** por compra.`
    if (obj.porPersonaje) {
        const tiene = unidadesPoseidas(character, obj)
        if (tiene + cantidad > obj.porPersonaje) {
            return tiene >= obj.porPersonaje
                ? `Ya tienes **${obj.Nombre}**; solo se puede tener ${obj.porPersonaje}.`
                : `Solo puedes tener ${obj.porPersonaje} de **${obj.Nombre}** (ya tienes ${tiene}).`
        }
    }
    return null
}

/**
 * Cruza el pedido con la estantería actual. Quita lo que ya no se vende y avisa.
 * @returns {{ lineas: Array<{ clave, nombre, cantidad, subtotal, obj }>, total: number, avisos: string[] }}
 */
function resolverLineas(pedido, objetos) {
    const lineas = []
    const avisos = []
    let total = 0
    for (const [clave, cantidad] of [...(pedido?.items || [])]) {
        const obj = objetos.find(o => o.clave === clave)
        if (!obj) {
            pedido.items.delete(clave)
            avisos.push("Algo de tu pedido ya no está en la estantería, así que lo devolví a su sitio.")
            continue
        }
        const subtotal = obj.precio * cantidad
        total += subtotal
        lineas.push({ clave, nombre: obj.Nombre, cantidad, subtotal, obj })
    }
    return { lineas, total, avisos }
}

/** Datos de la tienda o un error amable si ya no existe o no vende. */
async function tiendaAbierta(shopId) {
    const tienda = await obtenerTienda(dbServer, shopId)
    if (!tienda) throw new ErrorTienda("Esta tienda ya cerró sus puertas.")
    if (!tienda.tienda.acciones.includes("comprar")) throw new ErrorTienda("Aquí ya no se vende nada por ahora.")
    return tienda
}

/**
 * Componentes del pedido tal como está ahora.
 * @param {{ userId: string, shopId: string, character: Object, avisos?: string[], bloqueado?: boolean }} p
 */
async function construirPedido({ userId, shopId, character, avisos = [], bloqueado = false }) {
    const ids = { userId, characterId: character._id }
    let tienda
    try {
        tienda = await tiendaAbierta(shopId)
    } catch (err) {
        if (err instanceof ErrorTienda) return menus.mensajeLugar(null, err.message)
        throw err
    }
    const pedido = obtenerPedido(userId, shopId, character._id, { crear: true })
    const objetos = await objetosDeTienda(tienda.tienda.lugar)
    const r = resolverLineas(pedido, objetos)
    return menus.pedidoTienda({
        tienda,
        lineas: r.lineas,
        saldo: Number(character.economia?.Lumens) || 0,
        total: r.total,
        hayEstanteria: objetos.length > 0,
        avisos: [...r.avisos, ...avisos],
        ids,
        bloqueado
    })
}

/** Modal de agregar con la estantería actual, o null si está vacía. */
async function modalAgregar({ userId, shopId, character }) {
    const tienda = await tiendaAbierta(shopId)
    const objetos = await objetosDeTienda(tienda.tienda.lugar)
    if (!objetos.length) return null
    return menus.modalAgregar({ tienda, ids: { userId, characterId: character._id }, objetos })
}

/** Modal de quitar con lo que hay en el pedido, o null si no hay pedido o está vacío. */
async function modalQuitar({ userId, shopId, character }) {
    const pedido = obtenerPedido(userId, shopId, character._id)
    if (!pedido?.items.size) return null
    const tienda = await tiendaAbierta(shopId)
    const { lineas } = resolverLineas(pedido, await objetosDeTienda(tienda.tienda.lugar))
    return lineas.length ? menus.modalQuitar({ tienda, ids: { userId, characterId: character._id }, lineas }) : null
}

function leerCantidad(texto) {
    const n = Number(String(texto ?? "").trim())
    if (!Number.isInteger(n) || n <= 0) throw new ErrorTienda("La cantidad tiene que ser un número entero mayor que 0.")
    if (n > MAX_CANTIDAD) throw new ErrorTienda(`Como mucho ${MAX_CANTIDAD} de una vez.`)
    return n
}

/** Suma al pedido revisando los límites ya aquí (y otra vez al pagar). */
async function agregarAlPedido({ userId, shopId, character, clave, cantidadTexto }) {
    const cantidad = leerCantidad(cantidadTexto)
    const tienda = await tiendaAbierta(shopId)
    const obj = (await objetosDeTienda(tienda.tienda.lugar)).find(o => o.clave === clave)
    if (!obj) throw new ErrorTienda("Ese objeto ya no está en la estantería.")

    const pedido = obtenerPedido(userId, shopId, character._id, { crear: true })
    if (!pedido.items.has(clave) && pedido.items.size >= MAX_LINEAS) throw new ErrorTienda(`No caben más de ${MAX_LINEAS} objetos distintos en un solo pedido.`)
    const nueva = (pedido.items.get(clave) || 0) + cantidad
    const motivo = motivoLimite(obj, nueva, character)
    if (motivo) throw new ErrorTienda(motivo)
    pedido.items.set(clave, nueva)
}

/** Resta del pedido; si se quita más de lo que hay, se quita la línea entera. */
function quitarDelPedido({ userId, shopId, character, clave, cantidadTexto }) {
    const pedido = obtenerPedido(userId, shopId, character._id)
    if (!pedido?.items.has(clave)) return false
    const cantidad = leerCantidad(cantidadTexto)
    const resto = pedido.items.get(clave) - cantidad
    if (resto > 0) pedido.items.set(clave, resto)
    else pedido.items.delete(clave)
    return true
}

function vaciarPedido({ userId, shopId, character }) {
    const pedido = obtenerPedido(userId, shopId, character._id)
    if (!pedido) return false
    pedido.items.clear()
    return true
}

/** Desactiva todos los botones y selects de un mensaje ya enviado (para el "procesando" inmediato). */
function desactivarComponentes(components) {
    return components.map(function recorrer(c) {
        const copia = { ...c }
        if (copia.type === 2 || copia.type === 3) copia.disabled = true
        if (Array.isArray(copia.components)) copia.components = copia.components.map(recorrer)
        if (copia.accessory) copia.accessory = recorrer(copia.accessory)
        return copia
    })
}

/** Suma unidades al inventario respetando la región (dos objetos de regiones distintas pueden compartir ID). */
async function entregarObjeto(characterId, obj, cantidad) {
    const r = await personajes.updateOne(
        { _id: characterId, "economia.Inventario": { $elemMatch: { ID: obj.ID, Region: obj.region } } },
        { $inc: { "economia.Inventario.$.Cantidad": cantidad } }
    )
    if (r.matchedCount > 0) return
    const def = obj.definicion
    const item = sanitizarObjetoInventario({ ...def, ID: obj.ID, Region: obj.region }, cantidad, {
        contaminable: Boolean(def.contaminable),
        purificable: Boolean(def.purificable)
    })
    await personajes.updateOne({ _id: characterId }, { $push: { "economia.Inventario": item } })
}

/** Deshace una entrega (solo se usa si algo falla a mitad del pago). */
async function retirarObjeto(characterId, obj, cantidad) {
    await personajes.updateOne(
        { _id: characterId, "economia.Inventario": { $elemMatch: { ID: obj.ID, Region: obj.region } } },
        { $inc: { "economia.Inventario.$.Cantidad": -cantidad } }
    )
    await personajes.updateOne({ _id: characterId }, { $pull: { "economia.Inventario": { Cantidad: { $lte: 0 } } } })
}

/**
 * Cobra y entrega el pedido. Edita el mismo mensaje efímero: primero con los botones desactivados
 * (evita el doble clic y el límite de 3 s), y al final con el recibo o con el pedido y el motivo.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {{ userId: string, shopId: string, character: Object, totalMostrado: number }} p
 */
async function procesarPago(interaction, { userId, shopId, character, totalMostrado }) {
    await interaction.update({ components: desactivarComponentes(interaction.message.components.map(c => c.toJSON())) })
    const responder = (components) => interaction.editReply({ components })
    const redibujar = (avisos, personaje = character) => construirPedido({ userId, shopId, character: personaje, avisos }).then(responder)

    let tienda
    try {
        tienda = await tiendaAbierta(shopId)
    } catch (err) {
        if (err instanceof ErrorTienda) return responder(menus.mensajeLugar(null, err.message))
        throw err
    }

    const pedido = obtenerPedido(userId, shopId, character._id)
    if (!pedido?.items.size) return responder(menus.pedidoDesvanecido({ tienda, ids: { userId, characterId: character._id } }))

    // Todo se relee: estantería, límites y saldo pueden haber cambiado desde el último render
    const fresco = await personajes.findOne({ _id: character._id })
    if (!fresco) return responder(menus.mensajeLugar(tienda, "No encuentro a tu personaje (╥﹏╥)"))
    const { lineas, total, avisos } = resolverLineas(pedido, await objetosDeTienda(tienda.tienda.lugar))
    if (avisos.length) return redibujar(avisos, fresco)

    for (const l of lineas) {
        const motivo = motivoLimite(l.obj, l.cantidad, fresco)
        if (motivo) return redibujar([motivo], fresco)
    }
    if (total !== totalMostrado) return redibujar(["Los precios cambiaron mientras elegías; revisa el total antes de pagar."], fresco)

    // 1. Cobro atómico: solo descuenta si el saldo alcanza en este instante
    const lugar = tienda.tienda.lugar
    const items = lineas.map(l => ({ itemId: l.obj.ID, qty: l.cantidad, total: l.subtotal }))
    const cobro = await moverLumens({
        personajeId: fresco._id, userId, delta: -total, motivo: "tienda", opId: `pedido:${interaction.id}`,
        ref: { shopId, lugar, items },
    })
    if (!cobro.ok) return redibujar(["No te alcanzan los Lumens para esto."], fresco)

    const stockDescontado = []
    const entregados = []
    try {
        // 2. Existencias: se descuentan con condición para no vender más de las que quedan
        for (const l of lineas) {
            if (l.obj.stock === null) continue
            const r = await objetosGlobales.updateOne(
                { _id: l.obj.region, Objetos: { $elemMatch: { ID: l.obj.ID, Cantidad: { $gte: l.cantidad } } } },
                { $inc: { "Objetos.$.Cantidad": -l.cantidad } }
            )
            if (r.modifiedCount === 0) throw new ErrorTienda(`**${l.nombre}** se agotó justo ahora.`)
            stockDescontado.push(l)
        }

        // 3. Entrega
        for (const l of lineas) {
            await entregarObjeto(fresco._id, l.obj, l.cantidad)
            entregados.push(l)
        }
    } catch (err) {
        // Reembolso: se deshace en orden inverso todo lo que llegó a aplicarse
        await moverLumens({
            personajeId: fresco._id, userId, delta: total, motivo: "reembolso", opId: `reembolso:${interaction.id}`,
            ref: { shopId, lugar, items },
        }).catch(e => console.error("[Tiendas] Reembolso fallido:", e))
        for (const l of entregados) await retirarObjeto(fresco._id, l.obj, l.cantidad).catch(() => null)
        for (const l of stockDescontado) {
            await objetosGlobales.updateOne({ _id: l.obj.region, "Objetos.ID": l.obj.ID }, { $inc: { "Objetos.$.Cantidad": l.cantidad } }).catch(() => null)
        }
        if (!(err instanceof ErrorTienda)) console.error(`[Tiendas] Error entregando el pedido de ${userId} en ${shopId}:`, err)
        const motivo = err instanceof ErrorTienda ? err.message : "Algo salió mal al entregarte el pedido; te devolví los Lumens."
        return redibujar([motivo], await personajes.findOne({ _id: fresco._id }) || fresco)
    }

    // Estadística de ventas; si falla no afecta a la compra
    for (const l of lineas) {
        objetosGlobales.updateOne({ _id: l.obj.region, "Objetos.ID": l.obj.ID }, { $inc: { "Objetos.$.vendido": l.cantidad } }).catch(() => null)
    }

    cerrarPedido(userId, shopId)
    console.log(`[Tiendas] ${userId} (pj ${fresco._id}) compró en ${shopId}: ${lineas.map(l => `${l.nombre} x${l.cantidad}`).join(", ")} por ${total}`)
    return responder(menus.reciboTienda({
        tienda,
        lineas,
        total,
        saldoFinal: (Number(fresco.economia?.Lumens) || 0) - total,
        ids: { userId, characterId: fresco._id }
    }))
}

module.exports = {
    ErrorTienda,
    obtenerPedido,
    construirPedido,
    modalAgregar,
    modalQuitar,
    agregarAlPedido,
    quitarDelPedido,
    vaciarPedido,
    procesarPago,
    tiendaAbierta
}
