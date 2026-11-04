// functions/Tiendas/limitesCompra.js
// Límites de compra compartidos por todas las formas de comprar (panel de tiendas y /rol comprar).
//
//   stock          Objetos.Cantidad (null = infinito)
//   porCompra      max_por_compra (o maxStock): unidades en una sola compra
//   porPersona     max_por_persona: compras TOTALES del personaje, aunque ya no las tenga (social.compras)
//   porInventario  max_inventario: unidades que tiene AHORA entre inventario y mochila
//
// motivoLimite() es la comprobación previa (con el personaje recién leído). Al pagar, el contador por persona
// se reserva con una actualización condicionada y el inventario se vuelve a contar tras entregar, así dos
// compras simultáneas no pueden pasar del límite.

const clientdb = require("../../Server")
const personajes = clientdb.db("Rol_db").collection("Personajes")

/** Límites de una definición de Objetos_globales, con los nombres antiguos como respaldo. */
function limitesDe(def) {
    const entero = (v) => {
        const n = Number(v)
        return v !== null && v !== undefined && Number.isInteger(n) && n > 0 ? n : null
    }
    return {
        stock: def.Cantidad === null || def.Cantidad === undefined ? null : Number(def.Cantidad),
        porCompra: entero(def.max_por_compra ?? def.maxStock),
        porPersona: entero(def.max_por_persona),
        porInventario: entero(def.max_inventario ?? def.limite_por_personaje ?? (def.maximoUnoPorPersona ? 1 : null))
    }
}

/* ── Contador de compras: Personajes.social.compras["REGION:ID"] ──
 * Solo sube al pagar; no baja al vender, regalar o gastar el objeto. */
const claveCompras = (obj) => `${String(obj.region).replace(/[.$]/g, "_")}:${obj.ID}`
const campoCompras = (obj) => `social.compras.${claveCompras(obj)}`

function unidadesCompradas(character, obj) {
    return Math.max(0, Number(character?.social?.compras?.[claveCompras(obj)]) || 0)
}

/** Suma `cantidad` al contador solo si no pasa del máximo por persona. */
async function reservarCompra(characterId, obj, cantidad) {
    const campo = campoCompras(obj)
    const tope = obj.porPersona - cantidad
    if (tope < 0) return false
    const r = await personajes.updateOne(
        { _id: characterId, $or: [{ [campo]: { $lte: tope } }, { [campo]: { $exists: false } }] },
        { $inc: { [campo]: cantidad } }
    )
    return r.modifiedCount > 0
}

async function liberarCompra(characterId, obj, cantidad) {
    await personajes.updateOne({ _id: characterId }, { $inc: { [campoCompras(obj)]: -cantidad } })
}

/** Unidades de ese objeto que el personaje tiene ahora entre inventario y mochila. */
function unidadesPoseidas(character, obj) {
    let total = 0
    for (const lista of [character?.economia?.Inventario || [], character?.economia?.Mochila || []]) {
        for (const i of lista) {
            if (Number(i.ID) !== obj.ID) continue
            if (i.Region && i.Region !== obj.region) continue
            total += Number(i.Cantidad ?? i.cantidad ?? 1)
        }
    }
    return total
}

/**
 * ¿Se pueden comprar `cantidad` unidades? Devuelve el motivo si no.
 * @param {{ region: string, ID: number, Nombre: string, stock, porCompra, porPersona, porInventario }} obj
 */
function motivoLimite(obj, cantidad, character) {
    if (obj.stock !== null && obj.stock !== undefined && cantidad > obj.stock) {
        return obj.stock <= 0 ? `**${obj.Nombre}** se agotó.` : `Solo quedan ${obj.stock} de **${obj.Nombre}**.`
    }
    if (obj.porCompra && cantidad > obj.porCompra) return `No puedes llevar más de ${obj.porCompra} de **${obj.Nombre}** por compra.`
    if (obj.porPersona) {
        const compradas = unidadesCompradas(character, obj)
        if (compradas + cantidad > obj.porPersona) {
            return compradas >= obj.porPersona
                ? `Ya compraste todas las **${obj.Nombre}** que se pueden (${obj.porPersona} por persona).`
                : `Solo se pueden comprar ${obj.porPersona} de **${obj.Nombre}** por persona (ya compraste ${compradas}).`
        }
    }
    if (obj.porInventario) {
        const tiene = unidadesPoseidas(character, obj)
        if (tiene + cantidad > obj.porInventario) {
            return tiene >= obj.porInventario
                ? `Ya tienes **${obj.Nombre}**; solo se puede tener ${obj.porInventario}.`
                : `Solo puedes tener ${obj.porInventario} de **${obj.Nombre}** (ya tienes ${tiene}).`
        }
    }
    return null
}

/**
 * Tras entregar, vuelve a contar el inventario real. Si otra compra simultánea hizo que se pasara del
 * máximo, devuelve el motivo para que quien llama deshaga su compra.
 */
async function excedeInventarioTrasEntrega(characterId, obj) {
    if (!obj.porInventario) return null
    const pj = await personajes.findOne({ _id: characterId }, { projection: { "economia.Inventario": 1, "economia.Mochila": 1 } })
    const tiene = unidadesPoseidas(pj, obj)
    return tiene > obj.porInventario ? `Solo puedes tener ${obj.porInventario} de **${obj.Nombre}**.` : null
}

module.exports = {
    limitesDe,
    campoCompras,
    unidadesCompradas,
    reservarCompra,
    liberarCompra,
    unidadesPoseidas,
    motivoLimite,
    excedeInventarioTrasEntrega
}
