// functions/Tiendas/ventas.js
// Ventas a las tiendas: el pedido de compras al revés. Eliges objetos de tu inventario, ves el total y lo
// que te queda del tope diario, y confirmas.
//
// Igual que en pedidos.js, el estado en memoria solo guarda { clave: cantidad }; inventario, precios y tope
// se releen de la base de datos en cada render y otra vez al cobrar.
//
// Al confirmar: 1) se reserva el tope diario (social.ventas) con una actualización condicionada,
// 2) se retiran los objetos con un decremento atómico condicionado a la cantidad, y 3) se acredita con
// moverLumens. Si algo falla se deshace en orden inverso, así nunca se cobra lo que ya no tienes.

const clientdb = require("../../Server")
const dbRol = clientdb.db("Rol_db")
const dbServer = clientdb.db("Server_db")
const personajes = dbRol.collection("Personajes")
const objetosGlobales = dbRol.collection("Objetos_globales")
const { obtenerTienda } = require("../mensajesServidor")
const menus = require("../../data/UI_ComponentsV2/menusTienda")
const { moverLumens, fechaMx } = require("../Economia/lumens")
const { ErrorTienda, desactivarComponentes } = require("./pedidos")
const { TOPE_VENTAS_DIARIO, precioVentaItem, estaContaminado } = require("./formulaVenta")
const { durabilidadActual, durabilidadMaxima, estaRoto } = require("../Objetos/durabilidad")

const CADUCIDAD_MS = 15 * 60 * 1000
const MAX_CANTIDAD = 99
const MAX_LINEAS = 25

/** @type {Map<string, { characterId: number|string, items: Map<string, number>, expira: number }>} */
const ventas = new Map()

setInterval(() => {
    const ahora = Date.now()
    for (const [clave, venta] of ventas) if (venta.expira < ahora) ventas.delete(clave)
}, 5 * 60 * 1000).unref()

function obtenerVenta(userId, shopId, characterId, { crear = false } = {}) {
    const clave = `${userId}*${shopId}`
    let venta = ventas.get(clave)
    if (venta && (venta.expira < Date.now() || String(venta.characterId) !== String(characterId))) {
        ventas.delete(clave)
        venta = null
    }
    if (!venta && crear) {
        venta = { characterId, items: new Map(), expira: 0 }
        ventas.set(clave, venta)
    }
    if (venta) venta.expira = Date.now() + CADUCIDAD_MS
    return venta || null
}

function cerrarVenta(userId, shopId) {
    ventas.delete(`${userId}*${shopId}`)
}

async function tiendaCompradora(shopId) {
    const tienda = await obtenerTienda(dbServer, shopId)
    if (!tienda) throw new ErrorTienda("Esta tienda ya cerró sus puertas.")
    if (!tienda.tienda.acciones.includes("vender")) throw new ErrorTienda("Aquí ya no compran nada por ahora.")
    return tienda
}

/* ── Tope diario ── */

/** Lo vendido hoy (día de México, 00:00) y lo que queda del tope. */
function topeDe(character) {
    const v = character?.social?.ventas
    const vendidoHoy = v?.fecha === fechaMx() ? Math.max(0, Number(v.total) || 0) : 0
    return { vendidoHoy, restante: Math.max(0, TOPE_VENTAS_DIARIO - vendidoHoy) }
}

/** Suma `monto` a lo vendido hoy solo si cabe en el tope. Atómico: dos ventas a la vez no lo rebasan. */
async function reservarTope(characterId, monto) {
    const hoy = fechaMx()
    if (monto > TOPE_VENTAS_DIARIO) return null
    const sumarHoy = () => personajes.updateOne(
        { _id: characterId, "social.ventas.fecha": hoy, "social.ventas.total": { $lte: TOPE_VENTAS_DIARIO - monto } },
        { $inc: { "social.ventas.total": monto } }
    )
    if ((await sumarHoy()).modifiedCount > 0) return hoy
    // Primer venta del día (o nunca había vendido): se reinicia el contador
    const nuevoDia = await personajes.updateOne(
        { _id: characterId, "social.ventas.fecha": { $ne: hoy } },
        { $set: { "social.ventas": { fecha: hoy, total: monto } } }
    )
    if (nuevoDia.modifiedCount > 0) return hoy
    // Otra venta abrió el día justo ahora: se reintenta sumando
    return (await sumarHoy()).modifiedCount > 0 ? hoy : null
}

async function liberarTope(characterId, monto, fecha) {
    await personajes.updateOne({ _id: characterId, "social.ventas.fecha": fecha }, { $inc: { "social.ventas.total": -monto } })
}

/* ── Lo que se puede vender ── */

/** Definiciones actuales de los objetos del inventario, por "región::ID". */
async function definicionesDe(inventario) {
    const ids = [...new Set(inventario.map(i => Number(i.ID)).filter(n => !Number.isNaN(n)))]
    if (!ids.length) return new Map()
    const filas = await objetosGlobales.aggregate([
        { $unwind: "$Objetos" },
        { $match: { "Objetos.ID": { $in: ids } } }
    ]).toArray()
    const defs = new Map()
    for (const { _id: region, Objetos: o } of filas) defs.set(`${region}::${Number(o.ID)}`, { ...o, Region: region })
    return defs
}

/** Filtro de $elemMatch que identifica esa pila del inventario (sin la cantidad). */
function filtroPila(item) {
    const f = { ID: item.ID }
    f.Region = item.Region ? item.Region : { $exists: false }
    // Los mismos valores que tiene guardados la pila (o que no los tenga)
    for (const campo of ["contaminado", "contaminable", "durabilidad"]) {
        f[campo] = item[campo] === undefined || item[campo] === null ? { $exists: false } : item[campo]
    }
    return f
}

/** ¿Esta tienda compra ese objeto? Las marcadas «Todos» compran cualquier vendible; las demás, solo si su lugar está en `vender_en`. */
function tiendaCompra(tienda, def) {
    if (!def?.vendible) return false
    if (tienda?.tienda?.compra_todo) return true
    const lugar = String(tienda?.tienda?.lugar || "").toLowerCase()
    return Boolean(lugar) && (def.vender_en || []).some(l => String(l).toLowerCase() === lugar)
}

/**
 * Pilas del inventario que esta tienda compraría ahora, con su precio unitario.
 * Las pilas idénticas se agrupan; la cantidad vendible es la de la pila más grande, para que cada línea
 * se retire con un único decremento atómico.
 */
async function vendiblesDe(character, tienda) {
    const inventario = (character?.economia?.Inventario || []).filter(i => Number(i.Cantidad ?? 1) > 0)
    const defs = await definicionesDe(inventario)
    const porClave = new Map()
    const descartados = { rotos: 0, sinValor: 0 }

    for (const item of inventario) {
        const def = defs.get(`${item.Region || "TOB-01"}::${Number(item.ID)}`)
        if (!tiendaCompra(tienda, def)) continue
        if (estaRoto(item, def)) { descartados.rotos++; continue }
        const unitario = precioVentaItem(item, def)
        if (unitario <= 0) { descartados.sinValor++; continue }

        const contaminado = estaContaminado(item)
        const durActual = durabilidadActual(item, def)
        const clave = [item.Region || "", Number(item.ID), contaminado ? "c" : "l", item.durabilidad ?? ""].join("::")
        const cantidad = Number(item.Cantidad ?? 1)
        const previa = porClave.get(clave)
        if (previa && previa.cantidad >= cantidad) continue
        porClave.set(clave, {
            clave,
            nombre: def.Nombre || item.Nombre || "Objeto",
            cantidad,
            unitario,
            contaminado,
            durabilidad: durActual === null ? null : { actual: Math.floor(durActual), max: durabilidadMaxima(def) },
            item
        })
    }
    const lista = [...porClave.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    return { lista, descartados }
}

/** Cruza la venta con el inventario actual; quita lo que ya no está y recorta lo que ya no alcanza. */
function resolverLineas(venta, vendibles) {
    const lineas = []
    const avisos = []
    let total = 0
    for (const [clave, cantidad] of [...(venta?.items || [])]) {
        const v = vendibles.find(x => x.clave === clave)
        if (!v) {
            venta.items.delete(clave)
            avisos.push("Algo que ibas a vender ya no está en tu inventario (o la tienda dejó de comprarlo), así que lo saqué de la venta.")
            continue
        }
        let qty = cantidad
        if (qty > v.cantidad) {
            qty = v.cantidad
            venta.items.set(clave, qty)
            avisos.push(`Solo tienes ${v.cantidad} de **${v.nombre}**; ajusté la cantidad.`)
        }
        const subtotal = v.unitario * qty
        total += subtotal
        lineas.push({ clave, nombre: v.nombre, cantidad: qty, subtotal, v })
    }
    return { lineas, total, avisos }
}

function avisosDescartes({ rotos, sinValor }) {
    const a = []
    if (rotos) a.push(`${rotos === 1 ? "Un objeto roto no se puede" : `${rotos} objetos rotos no se pueden`} vender hasta repararlo.`)
    if (sinValor) a.push(`${sinValor === 1 ? "Un objeto vale" : `${sinValor} objetos valen`} tan poco que aquí no te darían nada.`)
    return a
}

/* ── Vistas ── */

async function construirVenta({ userId, shopId, character, avisos = [], bloqueado = false }) {
    const ids = { userId, characterId: character._id }
    let tienda
    try {
        tienda = await tiendaCompradora(shopId)
    } catch (err) {
        if (err instanceof ErrorTienda) return menus.mensajeLugar(null, err.message)
        throw err
    }
    const venta = obtenerVenta(userId, shopId, character._id, { crear: true })
    const { lista, descartados } = await vendiblesDe(character, tienda)
    const r = resolverLineas(venta, lista)
    const { vendidoHoy, restante } = topeDe(character)
    return menus.ventaTienda({
        tienda,
        lineas: r.lineas,
        saldo: Number(character.economia?.Lumens) || 0,
        total: r.total,
        vendidoHoy,
        restante,
        tope: TOPE_VENTAS_DIARIO,
        hayVendibles: lista.length > 0,
        avisos: [...r.avisos, ...(r.lineas.length ? [] : avisosDescartes(descartados)), ...avisos],
        ids,
        bloqueado
    })
}

async function modalAgregar({ userId, shopId, character }) {
    const tienda = await tiendaCompradora(shopId)
    const { lista } = await vendiblesDe(character, tienda)
    if (!lista.length) return null
    return menus.modalAgregarVenta({ tienda, ids: { userId, characterId: character._id }, vendibles: lista })
}

async function modalQuitar({ userId, shopId, character }) {
    const venta = obtenerVenta(userId, shopId, character._id)
    if (!venta?.items.size) return null
    const tienda = await tiendaCompradora(shopId)
    const { lineas } = resolverLineas(venta, (await vendiblesDe(character, tienda)).lista)
    return lineas.length ? menus.modalQuitarVenta({ tienda, ids: { userId, characterId: character._id }, lineas }) : null
}

function leerCantidad(texto) {
    const n = Number(String(texto ?? "").trim())
    if (!Number.isInteger(n) || n <= 0) throw new ErrorTienda("La cantidad tiene que ser un número entero mayor que 0.")
    if (n > MAX_CANTIDAD) throw new ErrorTienda(`Como mucho ${MAX_CANTIDAD} de una vez.`)
    return n
}

async function agregarAVenta({ userId, shopId, character, clave, cantidadTexto }) {
    const cantidad = leerCantidad(cantidadTexto)
    const tienda = await tiendaCompradora(shopId)
    const v = (await vendiblesDe(character, tienda)).lista.find(x => x.clave === clave)
    if (!v) throw new ErrorTienda("Esta tienda no compra ese objeto, o ya no está en tu inventario.")
    const venta = obtenerVenta(userId, shopId, character._id, { crear: true })
    if (!venta.items.has(clave) && venta.items.size >= MAX_LINEAS) throw new ErrorTienda(`No caben más de ${MAX_LINEAS} objetos distintos en una venta.`)
    const nueva = (venta.items.get(clave) || 0) + cantidad
    if (nueva > v.cantidad) throw new ErrorTienda(`Solo tienes ${v.cantidad} de **${v.nombre}**.`)
    venta.items.set(clave, nueva)
}

function quitarDeVenta({ userId, shopId, character, clave, cantidadTexto }) {
    const venta = obtenerVenta(userId, shopId, character._id)
    if (!venta?.items.has(clave)) return false
    const resto = venta.items.get(clave) - leerCantidad(cantidadTexto)
    if (resto > 0) venta.items.set(clave, resto)
    else venta.items.delete(clave)
    return true
}

function vaciarVenta({ userId, shopId, character }) {
    const venta = obtenerVenta(userId, shopId, character._id)
    if (!venta) return false
    venta.items.clear()
    return true
}

/* ── Cobro ── */

/** Retira `cantidad` de esa pila solo si todavía las tiene. */
async function retirarDelInventario(characterId, item, cantidad) {
    const r = await personajes.updateOne(
        { _id: characterId, "economia.Inventario": { $elemMatch: { ...filtroPila(item), Cantidad: { $gte: cantidad } } } },
        { $inc: { "economia.Inventario.$.Cantidad": -cantidad } }
    )
    return r.modifiedCount > 0
}

/** Deshace un retiro: si la pila sigue ahí se suma, si se vació y se limpió se vuelve a poner. */
async function devolverAlInventario(characterId, item, cantidad) {
    const r = await personajes.updateOne(
        { _id: characterId, "economia.Inventario": { $elemMatch: filtroPila(item) } },
        { $inc: { "economia.Inventario.$.Cantidad": cantidad } }
    )
    if (r.matchedCount === 0) await personajes.updateOne({ _id: characterId }, { $push: { "economia.Inventario": { ...item, Cantidad: cantidad } } })
}

/**
 * Confirma la venta. Igual que procesarPago: primero desactiva los botones, al final recibo o venta con el motivo.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function procesarVenta(interaction, { userId, shopId, character, totalMostrado }) {
    await interaction.update({ components: desactivarComponentes(interaction.message.components.map(c => c.toJSON())) })
    const responder = (components) => interaction.editReply({ components })
    const redibujar = (avisos, personaje = character) => construirVenta({ userId, shopId, character: personaje, avisos }).then(responder)

    let tienda
    try {
        tienda = await tiendaCompradora(shopId)
    } catch (err) {
        if (err instanceof ErrorTienda) return responder(menus.mensajeLugar(null, err.message))
        throw err
    }

    const venta = obtenerVenta(userId, shopId, character._id)
    if (!venta?.items.size) return responder(menus.ventaDesvanecida({ tienda, ids: { userId, characterId: character._id } }))

    const fresco = await personajes.findOne({ _id: character._id })
    if (!fresco) return responder(menus.mensajeLugar(tienda, "No encuentro a tu personaje (╥﹏╥)"))
    const { lineas, total, avisos } = resolverLineas(venta, (await vendiblesDe(fresco, tienda)).lista)
    if (avisos.length) return redibujar(avisos, fresco)
    if (total !== totalMostrado) return redibujar(["Los precios cambiaron mientras elegías; revisa el total antes de confirmar."], fresco)
    if (total <= 0) return redibujar(["No hay nada que vender."], fresco)

    const { restante } = topeDe(fresco)
    if (total > restante) return redibujar([`Hoy solo puedes vender ${restante} Lumens más; quita algo de la venta.`], fresco)

    // 1. Tope diario
    const fechaTope = await reservarTope(fresco._id, total)
    if (!fechaTope) return redibujar(["Ya alcanzaste el tope de ventas de hoy."], await personajes.findOne({ _id: fresco._id }) || fresco)

    const lugar = tienda.tienda.lugar
    const items = lineas.map(l => ({ itemId: l.v.item.ID, region: l.v.item.Region || null, qty: l.cantidad, total: l.subtotal, contaminado: l.v.contaminado }))
    const retirados = []
    try {
        // 2. Retiro atómico condicionado a la cantidad
        for (const l of lineas) {
            if (!(await retirarDelInventario(fresco._id, l.v.item, l.cantidad))) throw new ErrorTienda(`Ya no tienes ${l.cantidad} de **${l.nombre}**.`)
            retirados.push(l)
        }
        await personajes.updateOne({ _id: fresco._id }, { $pull: { "economia.Inventario": { Cantidad: { $lte: 0 } } } })

        // 3. Pago
        const pago = await moverLumens({
            personajeId: fresco._id, userId, delta: total, motivo: "venta", opId: `venta:${interaction.id}`,
            ref: { shopId, lugar, items },
        })
        if (!pago.ok) throw new Error(`moverLumens: ${pago.motivo}`)
    } catch (err) {
        for (const l of retirados.reverse()) await devolverAlInventario(fresco._id, l.v.item, l.cantidad).catch(e => console.error("[Tiendas] No se pudo devolver un objeto:", e))
        await liberarTope(fresco._id, total, fechaTope).catch(() => null)
        if (!(err instanceof ErrorTienda)) console.error(`[Tiendas] Error en la venta de ${userId} en ${shopId}:`, err)
        const motivo = err instanceof ErrorTienda ? err.message : "Algo salió mal con la venta; te devolví tus objetos."
        return redibujar([motivo], await personajes.findOne({ _id: fresco._id }) || fresco)
    }

    cerrarVenta(userId, shopId)
    console.log(`[Tiendas] ${userId} (pj ${fresco._id}) vendió en ${shopId}: ${lineas.map(l => `${l.nombre} x${l.cantidad}`).join(", ")} por ${total}`)
    return responder(menus.reciboVenta({
        tienda,
        lineas,
        total,
        saldoFinal: (Number(fresco.economia?.Lumens) || 0) + total,
        restante: restante - total,
        ids: { userId, characterId: fresco._id }
    }))
}

module.exports = {
    obtenerVenta,
    construirVenta,
    modalAgregar,
    modalQuitar,
    agregarAVenta,
    quitarDeVenta,
    vaciarVenta,
    procesarVenta,
    tiendaCompradora,
    // Para pruebas
    _interno: { topeDe, filtroPila, resolverLineas, tiendaCompra }
}
